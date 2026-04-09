/**
 * ============================================================
 * Módulo Tarjetas — Consultas de agregación
 * ============================================================
 * Lee los datos de tarjetas (campo tarjetas_dia_anterior) de
 * la tabla descuadres_cierre y los agrega por día real, semana,
 * mes y día de la semana para detectar patrones.
 *
 * Lógica de fecha real de la tarjeta:
 *   - El campo "Retirado" del email Farmatic = tarjetas cobradas.
 *   - Si hora_cierre < 14:00 → las tarjetas son del DÍA ANTERIOR.
 *   - Si hora_cierre >= 14:00 → las tarjetas son de ESE MISMO DÍA.
 *   - Esto es porque María cierra las cajas por la mañana (cierre
 *     del día anterior) o por la noche (cierre del día en curso).
 *
 * Orden de cajas: mismo que descuadres (0, 1-9, 11). Caja 12 aparte.
 * La caja 10 NO existe.
 */
import { query } from "./db";
import { initDescuadres, CAJA_LABEL } from "./descuadres";

/* ───── Tipos ───── */

export interface TarjetasCierreRow {
  id: number;
  fecha_cierre: string;      // fecha del cierre (email)
  hora_cierre: string;       // HH:MM
  caja: number;
  tarjetas_dia_anterior: number;
  fecha_real_tarjetas: string; // fecha calculada (día real de cobro)
}

export interface TarjetasDia {
  fecha: string;             // fecha real de cobro
  total: number;             // suma de todas las cajas
  por_caja: { caja: number; label: string; importe: number }[];
  num_cajas: number;
}

export interface TarjetasAgregado {
  clave: string;             // fecha, "Sem 15", "2026-04", "Lunes", etc.
  total: number;
  media: number;
  dias: number;
  min: number;
  max: number;
}

export interface TarjetasPatronDiaSemana {
  dia_semana: number;        // 0=lunes ... 6=domingo
  dia_nombre: string;
  total: number;
  media: number;
  dias: number;
  min: number;
  max: number;
}

export interface TarjetasEstadisticas {
  total_periodo: number;
  media_diaria: number;
  mejor_dia: { fecha: string; total: number } | null;
  peor_dia: { fecha: string; total: number } | null;
  dias_con_datos: number;
  total_por_caja: { caja: number; label: string; total: number; media: number }[];
}

/* ───── Helpers ───── */

const HORA_CORTE = 14; // Si cierre < 14:00 → tarjetas del día anterior

/**
 * Calcula la fecha real de cobro de las tarjetas según la hora de cierre.
 * SQLite expression: si hora_cierre < '14:00' → date(fecha_cierre, '-1 day') else fecha_cierre
 */
const SQL_FECHA_REAL = `
  CASE
    WHEN hora_cierre < '14:00' THEN date(fecha_cierre, '-1 day')
    ELSE fecha_cierre
  END
`;

/* ───── Detalle por día (con fecha real calculada) ───── */

export async function tarjetasPorDia(desde: string, hasta: string): Promise<TarjetasDia[]> {
  await initDescuadres();

  // Obtener todos los cierres del periodo con fecha real
  const rows = await query<{
    fecha_real: string;
    caja: number;
    tarjetas_dia_anterior: number;
  }>(
    `SELECT
       ${SQL_FECHA_REAL} as fecha_real,
       caja,
       tarjetas_dia_anterior
     FROM descuadres_cierre
     WHERE ${SQL_FECHA_REAL} >= ? AND ${SQL_FECHA_REAL} <= ?
       AND tarjetas_dia_anterior > 0
     ORDER BY fecha_real DESC, caja ASC`,
    [desde, hasta]
  );

  // Agrupar por fecha real
  const mapa = new Map<string, { caja: number; importe: number }[]>();
  for (const r of rows) {
    if (!mapa.has(r.fecha_real)) mapa.set(r.fecha_real, []);
    mapa.get(r.fecha_real)!.push({ caja: r.caja, importe: r.tarjetas_dia_anterior });
  }

  return Array.from(mapa.entries())
    .sort((a, b) => b[0].localeCompare(a[0])) // DESC
    .map(([fecha, cajas]) => ({
      fecha,
      total: cajas.reduce((s, c) => s + c.importe, 0),
      por_caja: cajas.map((c) => ({
        caja: c.caja,
        label: CAJA_LABEL[c.caja] || `Caja ${c.caja}`,
        importe: c.importe,
      })),
      num_cajas: cajas.length,
    }));
}

/* ───── Agregado por semana ───── */

export async function tarjetasPorSemana(desde: string, hasta: string): Promise<TarjetasAgregado[]> {
  await initDescuadres();

  const rows = await query<{
    semana: string;
    total: number;
    media: number;
    dias: number;
    min_dia: number;
    max_dia: number;
  }>(
    `SELECT
       'Sem ' || strftime('%W', fecha_real) as semana,
       SUM(dia_total) as total,
       AVG(dia_total) as media,
       COUNT(*) as dias,
       MIN(dia_total) as min_dia,
       MAX(dia_total) as max_dia
     FROM (
       SELECT
         ${SQL_FECHA_REAL} as fecha_real,
         SUM(tarjetas_dia_anterior) as dia_total
       FROM descuadres_cierre
       WHERE ${SQL_FECHA_REAL} >= ? AND ${SQL_FECHA_REAL} <= ?
       GROUP BY ${SQL_FECHA_REAL}
       HAVING SUM(tarjetas_dia_anterior) > 0
     )
     GROUP BY strftime('%W', fecha_real)
     ORDER BY MIN(fecha_real) DESC`,
    [desde, hasta]
  );

  return rows.map((r) => ({
    clave: r.semana,
    total: r.total,
    media: Math.round(r.media * 100) / 100,
    dias: r.dias,
    min: r.min_dia,
    max: r.max_dia,
  }));
}

/* ───── Agregado por mes ───── */

export async function tarjetasPorMes(desde: string, hasta: string): Promise<TarjetasAgregado[]> {
  await initDescuadres();

  const MESES_ES: Record<string, string> = {
    "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
    "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
  };

  const rows = await query<{
    mes: string;
    total: number;
    media: number;
    dias: number;
    min_dia: number;
    max_dia: number;
  }>(
    `SELECT
       strftime('%Y-%m', fecha_real) as mes,
       SUM(dia_total) as total,
       AVG(dia_total) as media,
       COUNT(*) as dias,
       MIN(dia_total) as min_dia,
       MAX(dia_total) as max_dia
     FROM (
       SELECT
         ${SQL_FECHA_REAL} as fecha_real,
         SUM(tarjetas_dia_anterior) as dia_total
       FROM descuadres_cierre
       WHERE ${SQL_FECHA_REAL} >= ? AND ${SQL_FECHA_REAL} <= ?
       GROUP BY ${SQL_FECHA_REAL}
       HAVING SUM(tarjetas_dia_anterior) > 0
     )
     GROUP BY strftime('%Y-%m', fecha_real)
     ORDER BY mes DESC`,
    [desde, hasta]
  );

  return rows.map((r) => {
    const [, mm] = r.mes.split("-");
    return {
      clave: `${MESES_ES[mm] || mm} ${r.mes.slice(0, 4)}`,
      total: r.total,
      media: Math.round(r.media * 100) / 100,
      dias: r.dias,
      min: r.min_dia,
      max: r.max_dia,
    };
  });
}

/* ───── Patrón por día de la semana ───── */

export async function tarjetasPorDiaSemana(desde: string, hasta: string): Promise<TarjetasPatronDiaSemana[]> {
  await initDescuadres();

  const DIAS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  // SQLite strftime('%w') = 0(dom)..6(sáb) → convertir a 0(lun)..6(dom)
  const rows = await query<{
    dow: number;
    total: number;
    media: number;
    dias: number;
    min_dia: number;
    max_dia: number;
  }>(
    `SELECT
       CAST(strftime('%w', fecha_real) AS INTEGER) as dow,
       SUM(dia_total) as total,
       AVG(dia_total) as media,
       COUNT(*) as dias,
       MIN(dia_total) as min_dia,
       MAX(dia_total) as max_dia
     FROM (
       SELECT
         ${SQL_FECHA_REAL} as fecha_real,
         SUM(tarjetas_dia_anterior) as dia_total
       FROM descuadres_cierre
       WHERE ${SQL_FECHA_REAL} >= ? AND ${SQL_FECHA_REAL} <= ?
       GROUP BY ${SQL_FECHA_REAL}
       HAVING SUM(tarjetas_dia_anterior) > 0
     )
     GROUP BY CAST(strftime('%w', fecha_real) AS INTEGER)
     ORDER BY CASE CAST(strftime('%w', fecha_real) AS INTEGER)
       WHEN 0 THEN 7 ELSE CAST(strftime('%w', fecha_real) AS INTEGER)
     END ASC`,
    [desde, hasta]
  );

  return rows.map((r) => {
    // Convertir: 0=dom → 6, 1=lun → 0, 2=mar → 1, etc.
    const diaSemana = r.dow === 0 ? 6 : r.dow - 1;
    return {
      dia_semana: diaSemana,
      dia_nombre: DIAS_ES[diaSemana] || `Día ${diaSemana}`,
      total: r.total,
      media: Math.round(r.media * 100) / 100,
      dias: r.dias,
      min: r.min_dia,
      max: r.max_dia,
    };
  });
}

/* ───── Estadísticas generales ───── */

export async function tarjetasEstadisticas(desde: string, hasta: string): Promise<TarjetasEstadisticas> {
  await initDescuadres();

  // Total y media
  const totales = await query<{ total: number; dias: number }>(
    `SELECT
       SUM(dia_total) as total,
       COUNT(*) as dias
     FROM (
       SELECT SUM(tarjetas_dia_anterior) as dia_total
       FROM descuadres_cierre
       WHERE ${SQL_FECHA_REAL} >= ? AND ${SQL_FECHA_REAL} <= ?
       GROUP BY ${SQL_FECHA_REAL}
       HAVING SUM(tarjetas_dia_anterior) > 0
     )`,
    [desde, hasta]
  );

  // Mejor día (más tarjetas)
  const mejor = await query<{ fecha: string; total: number }>(
    `SELECT fecha_real as fecha, SUM(tarjetas_dia_anterior) as total
     FROM (
       SELECT ${SQL_FECHA_REAL} as fecha_real, tarjetas_dia_anterior
       FROM descuadres_cierre
       WHERE ${SQL_FECHA_REAL} >= ? AND ${SQL_FECHA_REAL} <= ?
     )
     GROUP BY fecha_real
     HAVING SUM(tarjetas_dia_anterior) > 0
     ORDER BY total DESC LIMIT 1`,
    [desde, hasta]
  );

  // Peor día (menos tarjetas, pero > 0)
  const peor = await query<{ fecha: string; total: number }>(
    `SELECT fecha_real as fecha, SUM(tarjetas_dia_anterior) as total
     FROM (
       SELECT ${SQL_FECHA_REAL} as fecha_real, tarjetas_dia_anterior
       FROM descuadres_cierre
       WHERE ${SQL_FECHA_REAL} >= ? AND ${SQL_FECHA_REAL} <= ?
     )
     GROUP BY fecha_real
     HAVING SUM(tarjetas_dia_anterior) > 0
     ORDER BY total ASC LIMIT 1`,
    [desde, hasta]
  );

  // Total por caja
  const porCaja = await query<{ caja: number; total: number; dias: number }>(
    `SELECT
       caja,
       SUM(tarjetas_dia_anterior) as total,
       COUNT(DISTINCT ${SQL_FECHA_REAL}) as dias
     FROM descuadres_cierre
     WHERE ${SQL_FECHA_REAL} >= ? AND ${SQL_FECHA_REAL} <= ?
       AND tarjetas_dia_anterior > 0
     GROUP BY caja
     ORDER BY total DESC`,
    [desde, hasta]
  );

  const dias = totales[0]?.dias || 0;
  const total = totales[0]?.total || 0;

  return {
    total_periodo: total,
    media_diaria: dias > 0 ? Math.round((total / dias) * 100) / 100 : 0,
    mejor_dia: mejor[0] || null,
    peor_dia: peor[0] || null,
    dias_con_datos: dias,
    total_por_caja: porCaja.map((r) => ({
      caja: r.caja,
      label: CAJA_LABEL[r.caja] || `Caja ${r.caja}`,
      total: r.total,
      media: r.dias > 0 ? Math.round((r.total / r.dias) * 100) / 100 : 0,
    })),
  };
}
