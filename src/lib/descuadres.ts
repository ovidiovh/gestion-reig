/**
 * ============================================================
 * Módulo Descuadres de Caja — Turso queries
 * ============================================================
 * Gestiona la tabla descuadres_cierre donde se registran los
 * cierres diarios de cada caja, parseados desde los emails
 * automáticos de Farmatic.
 *
 * Reglas de negocio:
 *   - María cierra las cajas en orden: 0 (cambio), 1–9, 11 (óptica).
 *     La caja 10 NO EXISTE.
 *   - El campo "Retirado" del email = tarjetas del día anterior.
 *   - Descuadre positivo = FALTA dinero. Negativo = SOBRA.
 *   - Los emails llegan desde info@farmatic.es (reply-to info@farmaciareig.net).
 *   - La fecha relevante es la del CIERRE (dentro del email), no la de envío.
 *   - Los descuadres de un día pueden compensarse al día siguiente.
 *     → El acumulado neto es más relevante que el dato diario.
 */
import { getTurso, query, batch } from "./db";

/* ───── Constantes ───── */

/** Orden de cajas tal como María las cierra. La 10 no existe. */
export const CAJAS_ORDEN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11] as const;
export const TOTAL_CAJAS = CAJAS_ORDEN.length; // 11

/** Etiquetas legibles por caja */
export const CAJA_LABEL: Record<number, string> = {
  0: "Caja 0 (Cambio)",
  1: "Caja 1", 2: "Caja 2", 3: "Caja 3", 4: "Caja 4",
  5: "Caja 5", 6: "Caja 6", 7: "Caja 7", 8: "Caja 8",
  9: "Caja 9",
  11: "Caja 11 (Óptica)",
};

/* ───── Tipos ───── */

export interface CierreInput {
  fecha_cierre: string;       // YYYY-MM-DD (fecha del cierre, no del email)
  hora_cierre: string;        // HH:MM
  caja: number;               // 0-9, 11
  saldo: number;              // € total en caja al cerrar
  tarjetas_dia_anterior: number; // € "Retirado" en el email
  descuadre: number;          // € positivo=falta, negativo=sobra
  importe_apertura: number;   // € con lo que abrió
  email_id?: string;          // Gmail message ID (evita duplicados)
  email_fecha_envio?: string; // ISO timestamp del email
}

export interface CierreRow {
  id: number;
  fecha_cierre: string;
  hora_cierre: string;
  caja: number;
  saldo: number;
  tarjetas_dia_anterior: number;
  descuadre: number;
  importe_apertura: number;
  email_id: string | null;
  email_fecha_envio: string | null;
  created_at: string;
}

/** Resumen de un día completo */
export interface ResumenDia {
  fecha: string;
  cierres: CierreRow[];
  total_descuadre: number;        // suma algebraica (neto)
  total_descuadre_abs: number;    // suma |valores| (bruto)
  cajas_con_descuadre: number;
  cajas_total: number;
}

/** Agregado por periodo */
export interface Agregado {
  clave: string;            // fecha, "Sem 15", "2026-04", "Lunes", etc.
  descuadre_neto: number;   // suma algebraica
  descuadre_bruto: number;  // suma |valores|
  dias: number;
  cierres: number;
}

/* ───── Init tabla ───── */

export async function initDescuadres(): Promise<void> {
  await batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS descuadres_cierre (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha_cierre TEXT NOT NULL,
        hora_cierre TEXT NOT NULL,
        caja INTEGER NOT NULL,
        saldo REAL NOT NULL DEFAULT 0,
        tarjetas_dia_anterior REAL NOT NULL DEFAULT 0,
        descuadre REAL NOT NULL DEFAULT 0,
        importe_apertura REAL NOT NULL DEFAULT 0,
        email_id TEXT,
        email_fecha_envio TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_descuadres_fecha ON descuadres_cierre(fecha_cierre)`,
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_descuadres_caja ON descuadres_cierre(caja)`,
    },
    {
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_descuadres_email_id ON descuadres_cierre(email_id) WHERE email_id IS NOT NULL`,
    },
    {
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_descuadres_fecha_caja ON descuadres_cierre(fecha_cierre, caja)`,
    },
  ]);
}

/* ───── Guardar cierre ───── */

export async function guardarCierre(input: CierreInput): Promise<{ id: number }> {
  await initDescuadres();

  const turso = getTurso();
  const result = await turso.execute({
    sql: `INSERT INTO descuadres_cierre
            (fecha_cierre, hora_cierre, caja, saldo, tarjetas_dia_anterior, descuadre, importe_apertura, email_id, email_fecha_envio)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.fecha_cierre,
      input.hora_cierre,
      input.caja,
      input.saldo,
      input.tarjetas_dia_anterior,
      input.descuadre,
      input.importe_apertura,
      input.email_id || null,
      input.email_fecha_envio || null,
    ],
  });

  return { id: Number(result.lastInsertRowid) };
}

/* ───── Guardar batch (para ingesta múltiple) ───── */

export async function guardarCierresBatch(inputs: CierreInput[]): Promise<{ insertados: number; duplicados: number }> {
  await initDescuadres();

  let insertados = 0;
  let duplicados = 0;
  const turso = getTurso();

  for (const input of inputs) {
    try {
      await turso.execute({
        sql: `INSERT INTO descuadres_cierre
                (fecha_cierre, hora_cierre, caja, saldo, tarjetas_dia_anterior, descuadre, importe_apertura, email_id, email_fecha_envio)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          input.fecha_cierre,
          input.hora_cierre,
          input.caja,
          input.saldo,
          input.tarjetas_dia_anterior,
          input.descuadre,
          input.importe_apertura,
          input.email_id || null,
          input.email_fecha_envio || null,
        ],
      });
      insertados++;
    } catch (e: unknown) {
      const msg = String(e);
      // Duplicado por email_id o fecha+caja → skip
      if (msg.includes("UNIQUE constraint")) {
        duplicados++;
      } else {
        throw e;
      }
    }
  }

  return { insertados, duplicados };
}

/* ───── Comprobar duplicado ───── */

export async function existeEmailId(emailId: string): Promise<boolean> {
  await initDescuadres();
  const rows = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM descuadres_cierre WHERE email_id = ?`,
    [emailId]
  );
  return (rows[0]?.cnt || 0) > 0;
}

/* ───── Listar cierres de un día ───── */

export async function cierresDelDia(fecha: string): Promise<CierreRow[]> {
  await initDescuadres();
  return query<CierreRow>(
    `SELECT * FROM descuadres_cierre WHERE fecha_cierre = ? ORDER BY caja ASC`,
    [fecha]
  );
}

/* ───── Listar cierres por rango ───── */

export async function cierresPorRango(desde: string, hasta: string): Promise<CierreRow[]> {
  await initDescuadres();
  return query<CierreRow>(
    `SELECT * FROM descuadres_cierre
     WHERE fecha_cierre >= ? AND fecha_cierre <= ?
     ORDER BY fecha_cierre ASC, caja ASC`,
    [desde, hasta]
  );
}

/* ───── Agregados por día ───── */

export async function agregadoPorDia(desde: string, hasta: string): Promise<Agregado[]> {
  await initDescuadres();
  return query<Agregado>(
    `SELECT
       fecha_cierre as clave,
       SUM(descuadre) as descuadre_neto,
       SUM(ABS(descuadre)) as descuadre_bruto,
       1 as dias,
       COUNT(*) as cierres
     FROM descuadres_cierre
     WHERE fecha_cierre >= ? AND fecha_cierre <= ?
     GROUP BY fecha_cierre
     ORDER BY fecha_cierre ASC`,
    [desde, hasta]
  );
}

/* ───── Agregados por semana (ISO week) ───── */

export async function agregadoPorSemana(desde: string, hasta: string): Promise<Agregado[]> {
  await initDescuadres();
  return query<Agregado>(
    `SELECT
       'Sem ' || CAST(strftime('%W', fecha_cierre) AS INTEGER) as clave,
       SUM(descuadre) as descuadre_neto,
       SUM(ABS(descuadre)) as descuadre_bruto,
       COUNT(DISTINCT fecha_cierre) as dias,
       COUNT(*) as cierres
     FROM descuadres_cierre
     WHERE fecha_cierre >= ? AND fecha_cierre <= ?
     GROUP BY strftime('%Y-%W', fecha_cierre)
     ORDER BY MIN(fecha_cierre) ASC`,
    [desde, hasta]
  );
}

/* ───── Agregados por mes ───── */

export async function agregadoPorMes(desde: string, hasta: string): Promise<Agregado[]> {
  await initDescuadres();
  return query<Agregado>(
    `SELECT
       strftime('%Y-%m', fecha_cierre) as clave,
       SUM(descuadre) as descuadre_neto,
       SUM(ABS(descuadre)) as descuadre_bruto,
       COUNT(DISTINCT fecha_cierre) as dias,
       COUNT(*) as cierres
     FROM descuadres_cierre
     WHERE fecha_cierre >= ? AND fecha_cierre <= ?
     GROUP BY strftime('%Y-%m', fecha_cierre)
     ORDER BY clave ASC`,
    [desde, hasta]
  );
}

/* ───── Agregados por caja ───── */

export async function agregadoPorCaja(desde: string, hasta: string): Promise<Agregado[]> {
  await initDescuadres();
  return query<Agregado>(
    `SELECT
       CASE caja
         WHEN 0 THEN 'Caja 0 (Cambio)'
         WHEN 11 THEN 'Caja 11 (Óptica)'
         ELSE 'Caja ' || caja
       END as clave,
       SUM(descuadre) as descuadre_neto,
       SUM(ABS(descuadre)) as descuadre_bruto,
       COUNT(DISTINCT fecha_cierre) as dias,
       COUNT(*) as cierres
     FROM descuadres_cierre
     WHERE fecha_cierre >= ? AND fecha_cierre <= ?
     GROUP BY caja
     ORDER BY caja ASC`,
    [desde, hasta]
  );
}

/* ───── Agregados por día de la semana ───── */

export async function agregadoPorDiaSemana(desde: string, hasta: string): Promise<Agregado[]> {
  await initDescuadres();
  // strftime('%w') → 0=domingo, 1=lunes, ..., 6=sábado
  return query<Agregado>(
    `SELECT
       CASE CAST(strftime('%w', fecha_cierre) AS INTEGER)
         WHEN 0 THEN 'Domingo'
         WHEN 1 THEN 'Lunes'
         WHEN 2 THEN 'Martes'
         WHEN 3 THEN 'Miércoles'
         WHEN 4 THEN 'Jueves'
         WHEN 5 THEN 'Viernes'
         WHEN 6 THEN 'Sábado'
       END as clave,
       SUM(descuadre) as descuadre_neto,
       SUM(ABS(descuadre)) as descuadre_bruto,
       COUNT(DISTINCT fecha_cierre) as dias,
       COUNT(*) as cierres
     FROM descuadres_cierre
     WHERE fecha_cierre >= ? AND fecha_cierre <= ?
     GROUP BY strftime('%w', fecha_cierre)
     ORDER BY CAST(strftime('%w', fecha_cierre) AS INTEGER) ASC`,
    [desde, hasta]
  );
}

/* ───── Agregados por número de semana del mes (para detectar patrón principio/final) ───── */

export async function agregadoPorSemanaDelMes(desde: string, hasta: string): Promise<Agregado[]> {
  await initDescuadres();
  return query<Agregado>(
    `SELECT
       'Semana ' || (((CAST(strftime('%d', fecha_cierre) AS INTEGER) - 1) / 7) + 1) as clave,
       SUM(descuadre) as descuadre_neto,
       SUM(ABS(descuadre)) as descuadre_bruto,
       COUNT(DISTINCT fecha_cierre) as dias,
       COUNT(*) as cierres
     FROM descuadres_cierre
     WHERE fecha_cierre >= ? AND fecha_cierre <= ?
     GROUP BY ((CAST(strftime('%d', fecha_cierre) AS INTEGER) - 1) / 7) + 1
     ORDER BY ((CAST(strftime('%d', fecha_cierre) AS INTEGER) - 1) / 7) + 1 ASC`,
    [desde, hasta]
  );
}

/* ───── Estadísticas generales del periodo ───── */

export async function estadisticasPeriodo(desde: string, hasta: string): Promise<{
  total_neto: number;
  total_bruto: number;
  total_tarjetas: number;
  total_saldo: number;
  dias: number;
  cierres: number;
  peor_caja: string | null;
  peor_caja_neto: number;
  peor_dia: string | null;
  peor_dia_neto: number;
  media_diaria_neto: number;
  media_diaria_bruto: number;
  racha_actual: { caja: number; dias: number; desde: string } | null;
}> {
  await initDescuadres();

  // Totales
  const totales = await query<{ neto: number; bruto: number; tarjetas: number; saldo: number; dias: number; cierres: number }>(
    `SELECT
       COALESCE(SUM(descuadre), 0) as neto,
       COALESCE(SUM(ABS(descuadre)), 0) as bruto,
       COALESCE(SUM(tarjetas_dia_anterior), 0) as tarjetas,
       COALESCE(SUM(saldo), 0) as saldo,
       COUNT(DISTINCT fecha_cierre) as dias,
       COUNT(*) as cierres
     FROM descuadres_cierre
     WHERE fecha_cierre >= ? AND fecha_cierre <= ?`,
    [desde, hasta]
  );

  // Peor caja (mayor descuadre neto positivo = más falta)
  const peorCaja = await query<{ caja_label: string; neto: number }>(
    `SELECT
       CASE caja WHEN 0 THEN 'Caja 0 (Cambio)' WHEN 11 THEN 'Caja 11 (Óptica)' ELSE 'Caja ' || caja END as caja_label,
       SUM(descuadre) as neto
     FROM descuadres_cierre
     WHERE fecha_cierre >= ? AND fecha_cierre <= ?
     GROUP BY caja
     ORDER BY SUM(descuadre) DESC
     LIMIT 1`,
    [desde, hasta]
  );

  // Peor día (mayor descuadre neto positivo)
  const peorDia = await query<{ fecha: string; neto: number }>(
    `SELECT
       fecha_cierre as fecha,
       SUM(descuadre) as neto
     FROM descuadres_cierre
     WHERE fecha_cierre >= ? AND fecha_cierre <= ?
     GROUP BY fecha_cierre
     ORDER BY SUM(descuadre) DESC
     LIMIT 1`,
    [desde, hasta]
  );

  // Racha: caja que más días seguidos descuadra (solo descuadre != 0)
  // Esto se calcula en el frontend para simplificar la query

  const dias = totales[0]?.dias || 0;

  return {
    total_neto: totales[0]?.neto || 0,
    total_bruto: totales[0]?.bruto || 0,
    total_tarjetas: totales[0]?.tarjetas || 0,
    total_saldo: totales[0]?.saldo || 0,
    dias,
    cierres: totales[0]?.cierres || 0,
    peor_caja: peorCaja[0]?.caja_label || null,
    peor_caja_neto: peorCaja[0]?.neto || 0,
    peor_dia: peorDia[0]?.fecha || null,
    peor_dia_neto: peorDia[0]?.neto || 0,
    media_diaria_neto: dias > 0 ? (totales[0]?.neto || 0) / dias : 0,
    media_diaria_bruto: dias > 0 ? (totales[0]?.bruto || 0) / dias : 0,
    racha_actual: null, // se calcula client-side
  };
}

/* ───── Actualizar caja de un cierre ───── */

export async function actualizarCaja(id: number, caja: number): Promise<boolean> {
  await initDescuadres();
  const turso = getTurso();
  const result = await turso.execute({
    sql: `UPDATE descuadres_cierre SET caja = ? WHERE id = ?`,
    args: [caja, id],
  });
  return (result.rowsAffected ?? 0) > 0;
}

/* ───── Eliminar un cierre ───── */

export async function eliminarCierre(id: number): Promise<boolean> {
  await initDescuadres();
  const turso = getTurso();
  const result = await turso.execute({
    sql: `DELETE FROM descuadres_cierre WHERE id = ?`,
    args: [id],
  });
  return (result.rowsAffected ?? 0) > 0;
}

/* ───── Resetear tabla (para arranque limpio) ───── */

export async function resetDescuadres(): Promise<void> {
  await initDescuadres();
  const turso = getTurso();
  await turso.execute({ sql: `DELETE FROM descuadres_cierre`, args: [] });
}

/* ───── Parseador de emails de Farmatic ───── */

/**
 * Parsea el body de un email de cierre de caja de Farmatic.
 * Formato esperado (texto plano extraído del HTML):
 *   "9/Abr./2611:19194,200,000,05194,15Cierre de caja al 9/Abr./26 11:19.
 *    Saldo: 194,20 € Retirado: 0,00 € Diferencias: 0,05 € Importe apertura: 194,15 €"
 *
 * Extraemos los datos de la parte legible tras "Cierre de caja al..."
 */
export function parsearEmailCierre(body: string): {
  fecha: string;   // YYYY-MM-DD
  hora: string;    // HH:MM
  saldo: number;
  retirado: number;
  diferencias: number;
  importe_apertura: number;
} | null {
  try {
    // Buscar la parte legible: "Cierre de caja al DD/Mes./AA HH:MM."
    const matchCierre = body.match(
      /Cierre de caja al\s+(\d{1,2})\/([\wáéíóúÁÉÍÓÚ.]+)\/(\d{2,4})\s+(\d{1,2}):(\d{2})/i
    );
    if (!matchCierre) return null;

    const dia = matchCierre[1].padStart(2, "0");
    const mesRaw = matchCierre[2].replace(/\./g, "").toLowerCase();
    const yearRaw = matchCierre[3];
    const hora = `${matchCierre[4].padStart(2, "0")}:${matchCierre[5]}`;

    // Mapear nombre de mes a número
    const meses: Record<string, string> = {
      ene: "01", feb: "02", mar: "03", abr: "04",
      may: "05", jun: "06", jul: "07", ago: "08",
      sep: "09", oct: "10", nov: "11", dic: "12",
    };
    const mes = meses[mesRaw.slice(0, 3)] || "01";
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    const fecha = `${year}-${mes}-${dia}`;

    // Extraer valores numéricos
    const parseNum = (label: string): number => {
      const re = new RegExp(`${label}:\\s*([\\d.,]+)\\s*€`, "i");
      const m = body.match(re);
      if (!m) return 0;
      // Formato español: 1.234,56 → 1234.56
      return parseFloat(m[1].replace(/\./g, "").replace(",", "."));
    };

    const saldo = parseNum("Saldo");
    const retirado = parseNum("Retirado");
    const diferencias = parseNum("Diferencias");
    const importe_apertura = parseNum("Importe apertura");

    // Ojo: "Diferencias" en el email es negativo si sobra.
    // Pero en el email puede venir como "-0,05" directamente.
    // Vamos a re-parsear por si el signo está fuera del regex.
    const matchDif = body.match(/Diferencias:\s*(-?[\d.,]+)\s*€/i);
    let difFinal = diferencias;
    if (matchDif) {
      difFinal = parseFloat(matchDif[1].replace(/\./g, "").replace(",", "."));
    }

    return { fecha, hora, saldo, retirado, diferencias: difFinal, importe_apertura };
  } catch {
    return null;
  }
}
