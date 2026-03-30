import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const maxDuration = 300;

/**
 * GET /api/crm/precalcular              → estado de las tablas resumen
 * GET /api/crm/precalcular?debug=columns → PRAGMA table_info(ventas) + muestra
 * GET /api/crm/precalcular?debug=sample  → 3 filas de ventas para ver formato de fecha
 *
 * POST /api/crm/precalcular?step=index             → crea tablas e índice (1-2s)
 * POST /api/crm/precalcular?step=data&year=N       → inserta un año concreto (5-15s con índice)
 * POST /api/crm/precalcular?step=data&year=N&month=M → inserta un solo mes concreto
 * POST /api/crm/precalcular?step=data               → inserta todos los años
 * POST /api/crm/precalcular?step=all                → crea tablas y inserta todos los años
 *
 * NOTA: El DELETE es siempre por año+mes, nunca global. Si el proceso falla
 *       a mitad, los meses ya calculados se conservan intactos.
 */

export async function GET(req: NextRequest) {
  const debug = req.nextUrl.searchParams.get("debug");

  // ── debug=columns: muestra esquema y muestra de ventas ──────────────────
  if (debug === "columns") {
    try {
      const cols = await db.execute(`PRAGMA table_info(ventas)`);
      const sample = await db.execute(
        `SELECT * FROM ventas LIMIT 3`
      );
      const countRow = await db.execute(`SELECT COUNT(*) AS n FROM ventas`);
      return NextResponse.json({
        ok: true,
        total_rows: countRow.rows[0]?.[0],
        columns: cols.rows.map((r) => ({
          cid: r[0],
          name: r[1],
          type: r[2],
          notnull: r[3],
          dflt_value: r[4],
          pk: r[5],
        })),
        sample_rows: sample.rows,
        sample_columns: sample.columns,
      });
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
  }

  // ── debug=sample: muestra fechas para verificar formato ─────────────────
  if (debug === "sample") {
    try {
      const r = await db.execute(
        `SELECT fecha, codigo, imp_neto, pvp, unidades, tipo_pago, vendedor_nombre
         FROM ventas LIMIT 10`
      );
      return NextResponse.json({ ok: true, columns: r.columns, rows: r.rows });
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
  }

  // ── debug=precheck: cuenta cuántas filas aportaría cada INSERT ───────────
  if (debug === "precheck") {
    try {
      const year = parseInt(req.nextUrl.searchParams.get("year") ?? "2025");
      const d0 = `${year}-01-01`;
      const d1 = `${year + 1}-01-01`;
      const checks = await Promise.all([
        db.execute({ sql: `SELECT COUNT(*) AS n FROM ventas WHERE fecha >= ? AND fecha < ?`, args: [d0, d1] }),
        db.execute({ sql: `SELECT COUNT(*) AS n FROM ventas WHERE fecha >= ? AND fecha < ? AND codigo IS NULL`, args: [d0, d1] }),
        db.execute({ sql: `SELECT COUNT(*) AS n FROM ventas WHERE fecha >= ? AND fecha < ? AND codigo IS NOT NULL`, args: [d0, d1] }),
        db.execute({ sql: `SELECT MIN(fecha) AS min_f, MAX(fecha) AS max_f FROM ventas`, args: [] }),
        db.execute({ sql: `SELECT strftime('%Y', fecha) AS anio, COUNT(*) AS n FROM ventas GROUP BY anio ORDER BY anio`, args: [] }),
      ]);
      return NextResponse.json({
        ok: true,
        year,
        total_en_rango: checks[0].rows[0]?.[0],
        cabeceras_en_rango: checks[1].rows[0]?.[0],
        detalle_en_rango: checks[2].rows[0]?.[0],
        fecha_min_max: checks[3].rows[0],
        filas_por_anio: checks[4].rows,
      });
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
  }

  // ── estado normal de las tablas resumen ─────────────────────────────────
  const tablas = [
    "crm_resumen_mensual",
    "crm_vendedores_mensual",
    "crm_productos_mensual",
    "crm_segmentacion_mensual",
  ] as const;

  const counts: Record<string, number | string> = {};
  for (const t of tablas) {
    try {
      const r = await db.execute(`SELECT COUNT(*) AS n FROM ${t}`);
      counts[t] = Number(r.rows[0]?.[0] ?? 0);
    } catch {
      counts[t] = "no existe";
    }
  }

  // Desglose por año en crm_resumen_mensual
  let porAnio: { anio: number; meses: number; facturacion: number }[] = [];
  try {
    const r = await db.execute(
      `SELECT anio, COUNT(*) AS meses, ROUND(SUM(facturacion),2) AS facturacion
       FROM crm_resumen_mensual GROUP BY anio ORDER BY anio`
    );
    porAnio = r.rows.map((row) => ({
      anio: Number(row[0]),
      meses: Number(row[1]),
      facturacion: Number(row[2]),
    }));
  } catch { /* tabla no existe */ }

  // Verificar qué años tienen datos en ventas
  let ventasPorAnio: { anio: string; filas: number }[] = [];
  try {
    const r = await db.execute(
      `SELECT strftime('%Y', fecha) AS anio, COUNT(*) AS n FROM ventas GROUP BY anio ORDER BY anio`
    );
    ventasPorAnio = r.rows.map((row) => ({
      anio: String(row[0]),
      filas: Number(row[1]),
    }));
  } catch { /* tabla no existe */ }

  return NextResponse.json({ ok: true, counts, resumen_por_anio: porAnio, ventas_por_anio: ventasPorAnio });
}

// ── Datos KPI verificados del JSON (fuente: programa gestión farmacia) ───
const KPI_DATA: Record<number, Array<{mes:number,facturacion:number,tickets:number,ticket_medio:number,pct_receta:number}>> = {
  2025: [
    {mes:1,facturacion:322852.93,tickets:9266,ticket_medio:34.84,pct_receta:77.4},
    {mes:2,facturacion:328588.73,tickets:8819,ticket_medio:37.26,pct_receta:71.2},
    {mes:3,facturacion:346528.67,tickets:9454,ticket_medio:36.65,pct_receta:72.9},
    {mes:4,facturacion:366139.57,tickets:9571,ticket_medio:38.26,pct_receta:70.7},
    {mes:5,facturacion:336224.31,tickets:8799,ticket_medio:38.21,pct_receta:72.7},
    {mes:6,facturacion:339697.87,tickets:8915,ticket_medio:38.10,pct_receta:73.1},
    {mes:7,facturacion:366041.75,tickets:9564,ticket_medio:38.27,pct_receta:72.2},
    {mes:8,facturacion:309528.22,tickets:8312,ticket_medio:37.24,pct_receta:75.0},
    {mes:9,facturacion:351277.83,tickets:8860,ticket_medio:39.65,pct_receta:69.6},
    {mes:10,facturacion:337590.47,tickets:9456,ticket_medio:35.70,pct_receta:76.8},
    {mes:11,facturacion:342945.74,tickets:8784,ticket_medio:39.04,pct_receta:68.1},
    {mes:12,facturacion:358603.17,tickets:9142,ticket_medio:39.23,pct_receta:71.2},
  ],
  2024: [
    {mes:1,facturacion:302273.62,tickets:9432,ticket_medio:32.05,pct_receta:75.8},
    {mes:2,facturacion:281765.51,tickets:8351,ticket_medio:33.74,pct_receta:77.9},
    {mes:3,facturacion:287179.14,tickets:7843,ticket_medio:36.62,pct_receta:70.7},
    {mes:4,facturacion:318270.22,tickets:8892,ticket_medio:35.79,pct_receta:78.5},
    {mes:5,facturacion:328919.31,tickets:9082,ticket_medio:36.22,pct_receta:73.1},
    {mes:6,facturacion:297585.70,tickets:8121,ticket_medio:36.64,pct_receta:75.0},
    {mes:7,facturacion:322586.46,tickets:9059,ticket_medio:35.61,pct_receta:73.7},
    {mes:8,facturacion:296223.34,tickets:8389,ticket_medio:35.31,pct_receta:76.7},
    {mes:9,facturacion:283735.38,tickets:8051,ticket_medio:35.24,pct_receta:77.2},
    {mes:10,facturacion:341705.49,tickets:9259,ticket_medio:36.91,pct_receta:72.9},
    {mes:11,facturacion:306629.29,tickets:8384,ticket_medio:36.57,pct_receta:75.9},
    {mes:12,facturacion:319809.96,tickets:8035,ticket_medio:39.80,pct_receta:70.8},
  ],
};

export async function POST(req: NextRequest) {
  const yearParam = req.nextUrl.searchParams.get("year");
  const source = req.nextUrl.searchParams.get("source");
  const defaultStep = yearParam ? "data" : "all";
  const step = req.nextUrl.searchParams.get("step") ?? defaultStep;
  const log: string[] = [];
  const errors: string[] = [];
  const t0 = Date.now();

  // ── source=json: importar datos verificados del JSON ──────────────────
  if (source === "json") {
    try {
      // Crear tablas si no existen
      await runIndex(log, t0);

      for (const [anioStr, meses] of Object.entries(KPI_DATA)) {
        const anio = parseInt(anioStr);
        // Borrar datos existentes de este año
        await db.execute({ sql: `DELETE FROM crm_resumen_mensual WHERE anio = ?`, args: [anio] });

        for (const m of meses) {
          await db.execute({
            sql: `INSERT INTO crm_resumen_mensual (anio, mes, facturacion, tickets, unidades, ticket_medio)
                  VALUES (?, ?, ?, ?, 0, ?)`,
            args: [anio, m.mes, m.facturacion, m.tickets, m.ticket_medio],
          });
        }
        log.push(`[${e(t0)}s] Año ${anio}: ${meses.length} meses importados desde JSON`);
      }

      const r = await db.execute(`SELECT COUNT(*) AS n FROM crm_resumen_mensual`);
      return NextResponse.json({ ok: true, source: "json", filas: Number(r.rows[0]?.[0] ?? 0), log });
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err), log }, { status: 500 });
    }
  }

  const monthParam = req.nextUrl.searchParams.get("month");
  const TIMEOUT_PER_MONTH_MS = 30_000; // 30s por mes

  try {
    // SIEMPRE asegurar que tablas e índices existen antes de procesar
    await ensureIndexes(log, t0);
    await runIndex(log, t0);
    if (step === "all" || step === "data") {
      if (yearParam && monthParam) {
        // Modo mes concreto: ?year=2026&month=3
        await runMonth(parseInt(yearParam), parseInt(monthParam), log, errors, t0, TIMEOUT_PER_MONTH_MS);
      } else if (yearParam) {
        // Modo año completo: ?year=2026 (mes a mes con timeout)
        const result = await runYear(parseInt(yearParam), log, errors, t0, TIMEOUT_PER_MONTH_MS);
        if (result.timedOut) {
          log.push(`[${e(t0)}s] ⚠ Timeout: se completaron ${result.completedMonths}/12 meses`);
        }
      } else {
        // Modo completo: todos los años
        const result = await runData(log, errors, t0, TIMEOUT_PER_MONTH_MS);
        if (result.timedOut) {
          log.push(`[${e(t0)}s] ⚠ Timeout: proceso incompleto, hay meses pendientes`);
        }
      }
    }

    // Verificar filas insertadas
    const [r1, r2, r3, r4] = await Promise.all([
      db.execute(`SELECT COUNT(*) AS n FROM crm_resumen_mensual`),
      db.execute(`SELECT COUNT(*) AS n FROM crm_vendedores_mensual`),
      db.execute(`SELECT COUNT(*) AS n FROM crm_productos_mensual`),
      db.execute(`SELECT COUNT(*) AS n FROM crm_segmentacion_mensual`),
    ]);
    const counts = {
      resumen: Number(r1.rows[0]?.[0] ?? 0),
      vendedores: Number(r2.rows[0]?.[0] ?? 0),
      productos: Number(r3.rows[0]?.[0] ?? 0),
      segmentacion: Number(r4.rows[0]?.[0] ?? 0),
    };
    log.push(
      `[${e(t0)}s] resumen:${counts.resumen} vendedores:${counts.vendedores} ` +
      `productos:${counts.productos} segmentacion:${counts.segmentacion}`
    );

    const hasTimeout = log.some((l) => l.includes("⚠ Timeout"));
    const ok = errors.length === 0 && !hasTimeout;
    return NextResponse.json({ ok, step, counts, log, errors, timedOut: hasTimeout });
  } catch (err) {
    console.error("[crm/precalcular]", err);
    return NextResponse.json(
      { ok: false, step, error: String(err), log, errors },
      { status: 500 }
    );
  }
}

// ── Índices en ventas (se ejecuta SIEMPRE antes de cualquier operación) ─────

async function ensureIndexes(log: string[], t0: number) {
  const indexes = [
    // Índice principal: fecha + es_cabecera — cubre resumen, vendedores, segmentación
    // Índice principal: cab/det split por fecha → cubre resumen, vendedores, segmentación
    `CREATE INDEX IF NOT EXISTS idx_ventas_fecha_cab ON ventas(fecha, es_cabecera)`,
    // Índice para cabeceras con tipo → filtra tipo IN ('Contado','Credito') sin scan
    `CREATE INDEX IF NOT EXISTS idx_ventas_cab_tipo ON ventas(es_cabecera, fecha, tipo)`,
    // Índice para productos: fecha + codigo
    `CREATE INDEX IF NOT EXISTS idx_ventas_fecha_cod ON ventas(fecha, codigo)`,
    // Índice simple por fecha (legacy)
    `CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha)`,
  ];
  for (const sql of indexes) {
    try {
      await db.execute(sql);
    } catch {
      // El índice ya puede existir — ignorar
    }
  }
  log.push(`[${e(t0)}s] Índices en ventas OK`);
}

// ── Creación de tablas resumen ──────────────────────────────────────────────

async function runIndex(log: string[], t0: number) {
  // Crear tablas (sin borrar datos — el DELETE se hace por mes)
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS crm_resumen_mensual (
      anio INTEGER NOT NULL, mes INTEGER NOT NULL,
      facturacion REAL DEFAULT 0, tickets INTEGER DEFAULT 0,
      unidades REAL DEFAULT 0, ticket_medio REAL DEFAULT 0,
      PRIMARY KEY (anio, mes))`,
    `CREATE TABLE IF NOT EXISTS crm_vendedores_mensual (
      anio INTEGER NOT NULL, mes INTEGER NOT NULL, vendedor TEXT NOT NULL,
      tickets INTEGER DEFAULT 0, facturacion REAL DEFAULT 0,
      ticket_medio REAL DEFAULT 0, unidades REAL DEFAULT 0,
      PRIMARY KEY (anio, mes, vendedor))`,
    `CREATE TABLE IF NOT EXISTS crm_productos_mensual (
      anio INTEGER NOT NULL, mes INTEGER NOT NULL, codigo TEXT NOT NULL,
      descripcion TEXT DEFAULT '', unidades REAL DEFAULT 0,
      facturacion REAL DEFAULT 0, tickets INTEGER DEFAULT 0,
      pvp_medio REAL DEFAULT 0, PRIMARY KEY (anio, mes, codigo))`,
    `CREATE TABLE IF NOT EXISTS crm_segmentacion_mensual (
      anio INTEGER NOT NULL, mes INTEGER NOT NULL, tipo_pago TEXT NOT NULL,
      tickets INTEGER DEFAULT 0, facturacion REAL DEFAULT 0,
      PRIMARY KEY (anio, mes, tipo_pago))`,
  ]) {
    await db.execute(sql);
  }
  log.push(`[${e(t0)}s] Tablas resumen OK`);
}

// ── Borrado seguro por año+mes (solo borra el mes que vamos a recalcular) ───

async function deleteMonth(anio: number, mes: number, log: string[], t0: number) {
  const tables = [
    "crm_resumen_mensual",
    "crm_vendedores_mensual",
    "crm_productos_mensual",
    "crm_segmentacion_mensual",
  ];
  for (const table of tables) {
    const r = await db.execute({
      sql: `DELETE FROM ${table} WHERE anio = ? AND mes = ?`,
      args: [anio, mes],
    });
    if (r.rowsAffected > 0) {
      log.push(`[${e(t0)}s] DELETE ${table} ${anio}-${String(mes).padStart(2, "0")}: ${r.rowsAffected} filas`);
    }
  }
}

// ── Filtro facturación (misma lógica que queries.ts FACTURACION_WHERE) ───────
// Condiciones ligeras (usan índice): tipo + es_cabecera + fecha
// Condiciones pesadas (full scan): SUBSTR, LIKE → aplicar solo donde sea necesario
const FACT_BASE = `tipo IN ('Contado', 'Credito')`;
const FACT_FULL = `
  tipo IN ('Contado', 'Credito')
  AND UPPER(SUBSTR(num_doc, 1, 1)) != 'W'
  AND (rp IS NULL OR rp != 'Anulada')
  AND descripcion NOT LIKE '%TRASPASO ENTRE CAJAS%'
  AND descripcion NOT LIKE '%Entrega A Cuenta%'
`;

// ── Precálculo de un solo mes ───────────────────────────────────────────────
// Estrategia: queries separadas cab/det para aprovechar idx(fecha, es_cabecera)
// - Cabeceras (es_cabecera=1): 1 fila por ticket → COUNT(*) para tickets
// - Detalle   (es_cabecera=0): 1 fila por línea  → SUM(pvp*unidades) para facturación
// Sin COUNT(DISTINCT) → mucho más rápido en Turso

async function runMonth(
  anio: number,
  mes: number,
  log: string[],
  errors: string[],
  t0: number,
  timeoutMs: number
): Promise<{ timedOut: boolean }> {
  const mStr = String(mes).padStart(2, "0");
  const d0 = `${anio}-${mStr}-01`;
  const nextMonth = mes === 12 ? 1 : mes + 1;
  const nextYear = mes === 12 ? anio + 1 : anio;
  const d1 = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const monthStart = Date.now();

  // Pre-check rápido (usa índice fecha)
  const precheck = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM ventas WHERE fecha >= ? AND fecha < ? AND es_cabecera = 1`,
    args: [d0, d1],
  });
  const cabRows = Number(precheck.rows[0]?.[0] ?? 0);

  if (cabRows === 0) {
    log.push(`[${e(t0)}s] ${anio}-${mStr}: sin datos, saltando`);
    return { timedOut: false };
  }
  log.push(`[${e(t0)}s] ${anio}-${mStr}: ${cabRows} tickets (cabeceras)`);

  // Borrar datos existentes de este mes concreto
  await deleteMonth(anio, mes, log, t0);

  // Helper para ejecutar un step con timeout check
  const runStep = async (label: string, fn: () => Promise<void>): Promise<boolean> => {
    if (Date.now() - monthStart > timeoutMs) {
      const msg = `TIMEOUT ${label} ${anio}-${mStr}: superó ${timeoutMs / 1000}s`;
      log.push(`[${e(t0)}s] ${msg}`);
      errors.push(msg);
      return false; // timedOut
    }
    try {
      await fn();
    } catch (err) {
      const msg = `ERROR ${label} ${anio}-${mStr}: ${String(err)}`;
      log.push(`[${e(t0)}s] ${msg}`);
      errors.push(msg);
    }
    return true; // ok, continue
  };

  // ── 1. RESUMEN MENSUAL (cab → tickets, det → facturación) ────────────────
  if (!await runStep("resumen", async () => {
    // Tickets desde cabeceras (COUNT(*), no COUNT(DISTINCT))
    const cabR = await db.execute({
      sql: `SELECT COUNT(*) AS tickets
            FROM ventas
            WHERE fecha >= ? AND fecha < ? AND es_cabecera = 1
              AND ${FACT_BASE}`,
      args: [d0, d1],
    });
    const tickets = Number(cabR.rows[0]?.[0] ?? 0);

    // Facturación + unidades desde líneas de detalle
    const detR = await db.execute({
      sql: `SELECT
              ROUND(COALESCE(SUM(pvp * unidades), 0), 2) AS facturacion,
              COALESCE(SUM(unidades), 0) AS unidades
            FROM ventas
            WHERE fecha >= ? AND fecha < ? AND es_cabecera = 0
              AND ${FACT_FULL}`,
      args: [d0, d1],
    });
    const facturacion = Number(detR.rows[0]?.[0] ?? 0);
    const unidades = Number(detR.rows[0]?.[1] ?? 0);
    const ticket_medio = tickets > 0 ? Math.round((facturacion / tickets) * 100) / 100 : 0;

    await db.execute({
      sql: `INSERT OR REPLACE INTO crm_resumen_mensual
            (anio, mes, facturacion, tickets, unidades, ticket_medio)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [anio, mes, facturacion, tickets, unidades, ticket_medio],
    });
    log.push(`[${e(t0)}s] resumen ${anio}-${mStr}: ${facturacion}€, ${tickets} tickets`);
  })) return { timedOut: true };

  // ── 2. VENDEDORES (cab → tickets por vendedor, det → facturación) ────────
  if (!await runStep("vendedores", async () => {
    // Tickets por vendedor desde cabeceras
    const cabR = await db.execute({
      sql: `SELECT COALESCE(vendedor_nombre,'Sin asignar') AS vendedor, COUNT(*) AS tickets
            FROM ventas
            WHERE fecha >= ? AND fecha < ? AND es_cabecera = 1
              AND ${FACT_BASE}
              AND vendedor_nombre IS NOT NULL AND vendedor_nombre != ''
            GROUP BY vendedor_nombre`,
      args: [d0, d1],
    });
    const ticketsMap: Record<string, number> = {};
    for (const row of cabR.rows) {
      ticketsMap[String(row[0])] = Number(row[1]);
    }

    // Facturación por vendedor desde detalle
    const detR = await db.execute({
      sql: `SELECT COALESCE(vendedor_nombre,'Sin asignar') AS vendedor,
              ROUND(COALESCE(SUM(pvp * unidades), 0), 2) AS facturacion,
              COALESCE(SUM(unidades), 0) AS unidades
            FROM ventas
            WHERE fecha >= ? AND fecha < ? AND es_cabecera = 0
              AND ${FACT_FULL}
              AND vendedor_nombre IS NOT NULL AND vendedor_nombre != ''
            GROUP BY vendedor_nombre`,
      args: [d0, d1],
    });

    let inserted = 0;
    for (const row of detR.rows) {
      const vendedor = String(row[0]);
      const facturacion = Number(row[1]);
      const unidades = Number(row[2]);
      const tickets = ticketsMap[vendedor] || 0;
      const ticket_medio = tickets > 0 ? Math.round((facturacion / tickets) * 100) / 100 : 0;
      await db.execute({
        sql: `INSERT OR REPLACE INTO crm_vendedores_mensual
              (anio, mes, vendedor, tickets, facturacion, ticket_medio, unidades)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [anio, mes, vendedor, tickets, facturacion, ticket_medio, unidades],
      });
      inserted++;
    }
    log.push(`[${e(t0)}s] vendedores ${anio}-${mStr}: ${inserted} vendedores`);
  })) return { timedOut: true };

  // ── 3. PRODUCTOS (solo detalle, es_cabecera=0) ───────────────────────────
  if (!await runStep("productos", async () => {
    const r = await db.execute({
      sql: `INSERT OR REPLACE INTO crm_productos_mensual
             (anio, mes, codigo, descripcion, unidades, facturacion, tickets, pvp_medio)
            SELECT
              ?, ?,
              codigo,
              COALESCE(MAX(descripcion),'Sin descripción'),
              COALESCE(SUM(unidades), 0),
              ROUND(COALESCE(SUM(pvp * unidades), 0), 2),
              COUNT(*),
              ROUND(COALESCE(AVG(pvp), 0), 2)
            FROM ventas
            WHERE fecha >= ? AND fecha < ? AND es_cabecera = 0
              AND ${FACT_FULL}
              AND codigo IS NOT NULL AND codigo != ''
            GROUP BY codigo`,
      args: [anio, mes, d0, d1],
    });
    log.push(`[${e(t0)}s] productos ${anio}-${mStr}: ${r.rowsAffected} productos`);
  })) return { timedOut: true };

  // ── 4. SEGMENTACIÓN POR TIPO_PAGO (cab → tickets, det → facturación) ─────
  if (!await runStep("segmentacion", async () => {
    // Tickets por tipo_pago desde cabeceras
    const cabR = await db.execute({
      sql: `SELECT COALESCE(tipo_pago,'Otros') AS tp, COUNT(*) AS tickets
            FROM ventas
            WHERE fecha >= ? AND fecha < ? AND es_cabecera = 1
              AND ${FACT_BASE}
            GROUP BY tipo_pago`,
      args: [d0, d1],
    });
    const ticketsMap: Record<string, number> = {};
    for (const row of cabR.rows) {
      ticketsMap[String(row[0])] = Number(row[1]);
    }

    // Facturación por tipo_pago desde detalle
    const detR = await db.execute({
      sql: `SELECT COALESCE(tipo_pago,'Otros') AS tp,
              ROUND(COALESCE(SUM(pvp * unidades), 0), 2) AS facturacion
            FROM ventas
            WHERE fecha >= ? AND fecha < ? AND es_cabecera = 0
              AND ${FACT_FULL}
            GROUP BY tipo_pago`,
      args: [d0, d1],
    });

    let inserted = 0;
    for (const row of detR.rows) {
      const tp = String(row[0]);
      const facturacion = Number(row[1]);
      const tickets = ticketsMap[tp] || 0;
      await db.execute({
        sql: `INSERT OR REPLACE INTO crm_segmentacion_mensual
              (anio, mes, tipo_pago, tickets, facturacion)
              VALUES (?, ?, ?, ?, ?)`,
        args: [anio, mes, tp, tickets, facturacion],
      });
      inserted++;
    }
    log.push(`[${e(t0)}s] segmentacion ${anio}-${mStr}: ${inserted} tipos`);
  })) return { timedOut: true };

  // ── 5. RECETA VS LIBRE (det → facturación por es_receta) ─────────────────
  if (!await runStep("receta", async () => {
    const r = await db.execute({
      sql: `SELECT
              CASE WHEN es_receta = 1 THEN '__receta__' ELSE '__libre__' END AS tp,
              COUNT(*) AS tickets,
              ROUND(COALESCE(SUM(pvp * unidades), 0), 2) AS facturacion
            FROM ventas
            WHERE fecha >= ? AND fecha < ? AND es_cabecera = 0
              AND ${FACT_FULL}
            GROUP BY CASE WHEN es_receta = 1 THEN '__receta__' ELSE '__libre__' END`,
      args: [d0, d1],
    });
    for (const row of r.rows) {
      await db.execute({
        sql: `INSERT OR REPLACE INTO crm_segmentacion_mensual
              (anio, mes, tipo_pago, tickets, facturacion)
              VALUES (?, ?, ?, ?, ?)`,
        args: [anio, mes, String(row[0]), Number(row[1]), Number(row[2])],
      });
    }
    log.push(`[${e(t0)}s] receta ${anio}-${mStr}: ${r.rows.length} categorías`);
  })) return { timedOut: true };

  log.push(`[${e(t0)}s] ${anio}-${mStr} completado en ${((Date.now() - monthStart) / 1000).toFixed(1)}s`);
  return { timedOut: false };
}

// ── Inserción por año (mes a mes) ───────────────────────────────────────────

async function runYear(
  anio: number,
  log: string[],
  errors: string[],
  t0: number,
  timeoutMs: number
): Promise<{ timedOut: boolean; completedMonths: number }> {
  // Pre-check: cuántas filas hay para este año
  const d0 = `${anio}-01-01`;
  const d1 = `${anio + 1}-01-01`;
  const precheck = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM ventas WHERE fecha >= ? AND fecha < ?`,
    args: [d0, d1],
  });
  const rowsInYear = Number(precheck.rows[0]?.[0] ?? 0);
  log.push(`[${e(t0)}s] Año ${anio}: ${rowsInYear} filas totales en ventas`);

  if (rowsInYear === 0) {
    log.push(`[${e(t0)}s] Año ${anio}: sin datos, saltando`);
    return { timedOut: false, completedMonths: 0 };
  }

  let completedMonths = 0;
  for (let mes = 1; mes <= 12; mes++) {
    // Check timeout global (maxDuration - margen de seguridad)
    if (Date.now() - t0 > 250_000) {
      log.push(`[${e(t0)}s] ⚠ Timeout global alcanzado en año ${anio}, mes ${mes}`);
      return { timedOut: true, completedMonths };
    }

    const result = await runMonth(anio, mes, log, errors, t0, timeoutMs);
    if (result.timedOut) {
      return { timedOut: true, completedMonths };
    }
    completedMonths++;
  }

  log.push(`[${e(t0)}s] Año ${anio}: 12 meses completados`);
  return { timedOut: false, completedMonths };
}

async function runData(
  log: string[],
  errors: string[],
  t0: number,
  timeoutMs: number
): Promise<{ timedOut: boolean }> {
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  for (const anio of years) {
    const result = await runYear(anio, log, errors, t0, timeoutMs);
    if (result.timedOut) {
      return { timedOut: true };
    }
  }
  log.push(`[${e(t0)}s] Todos los años procesados`);
  return { timedOut: false };
}

function e(t0: number) {
  return ((Date.now() - t0) / 1000).toFixed(1);
}
