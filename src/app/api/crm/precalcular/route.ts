import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const maxDuration = 300;

/**
 * GET /api/crm/precalcular              → estado de las tablas resumen
 * GET /api/crm/precalcular?debug=columns → PRAGMA table_info(ventas) + muestra
 * GET /api/crm/precalcular?debug=sample  → 3 filas de ventas para ver formato de fecha
 *
 * POST /api/crm/precalcular?step=index       → crea tablas e índice (1-2s)
 * POST /api/crm/precalcular?step=data&year=N → inserta un año concreto (5-15s con índice)
 * POST /api/crm/precalcular?step=data        → inserta todos los años
 * POST /api/crm/precalcular?step=all         → crea tablas y inserta todos los años
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
  return NextResponse.json({ ok: true, counts });
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

  try {
    if (step === "all" || step === "index") {
      await runIndex(log, t0);
    }
    if (step === "all" || step === "data") {
      if (yearParam) {
        await runYear(parseInt(yearParam), log, errors, t0);
      } else {
        await runData(log, errors, t0);
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

    const ok = errors.length === 0;
    return NextResponse.json({ ok, step, counts, log, errors });
  } catch (err) {
    console.error("[crm/precalcular]", err);
    return NextResponse.json(
      { ok: false, step, error: String(err), log, errors },
      { status: 500 }
    );
  }
}

// ── Creación de tablas e índice ──────────────────────────────────────────────

async function runIndex(log: string[], t0: number) {
  // Crear tablas
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
    `CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha)`,
  ]) {
    await db.execute(sql);
  }
  log.push(`[${e(t0)}s] Tablas e índice creados`);

  // Vaciar tablas
  for (const sql of [
    `DELETE FROM crm_resumen_mensual`,
    `DELETE FROM crm_vendedores_mensual`,
    `DELETE FROM crm_productos_mensual`,
    `DELETE FROM crm_segmentacion_mensual`,
  ]) {
    const r = await db.execute(sql);
    log.push(`[${e(t0)}s] DELETE ${sql.split(' ')[2]}: ${r.rowsAffected} filas eliminadas`);
  }
}

// ── Inserción por año ────────────────────────────────────────────────────────

async function runYear(
  anio: number,
  log: string[],
  errors: string[],
  t0: number
) {
  const d0 = `${anio}-01-01`;
  const d1 = `${anio + 1}-01-01`;

  // Pre-check: cuántas filas hay para este año
  const precheck = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM ventas WHERE fecha >= ? AND fecha < ?`,
    args: [d0, d1],
  });
  const rowsInYear = Number(precheck.rows[0]?.[0] ?? 0);
  log.push(`[${e(t0)}s] Año ${anio}: ${rowsInYear} filas en ventas`);

  if (rowsInYear === 0) {
    log.push(`[${e(t0)}s] Año ${anio}: sin datos, saltando`);
    return;
  }

  const stmts: { label: string; sql: string; args: string[] }[] = [
    {
      label: "crm_resumen_mensual",
      sql: `INSERT OR REPLACE INTO crm_resumen_mensual
             (anio, mes, facturacion, tickets, unidades, ticket_medio)
            SELECT
              CAST(strftime('%Y',fecha) AS INTEGER),
              CAST(strftime('%m',fecha) AS INTEGER),
              ROUND(SUM(CASE WHEN es_cabecera=1 THEN ABS(imp_neto) ELSE 0 END),2),
              SUM(CASE WHEN es_cabecera=1 THEN 1 ELSE 0 END),
              COALESCE(SUM(CASE WHEN es_cabecera=0 THEN unidades ELSE 0 END),0),
              ROUND(SUM(CASE WHEN es_cabecera=1 THEN ABS(imp_neto) ELSE 0 END)/
                NULLIF(SUM(CASE WHEN es_cabecera=1 THEN 1 ELSE 0 END),0),2)
            FROM ventas
            WHERE fecha >= ? AND fecha < ?
            GROUP BY CAST(strftime('%Y',fecha) AS INTEGER),
                     CAST(strftime('%m',fecha) AS INTEGER)`,
      args: [d0, d1],
    },
    {
      label: "crm_vendedores_mensual",
      sql: `INSERT OR REPLACE INTO crm_vendedores_mensual
             (anio, mes, vendedor, tickets, facturacion, ticket_medio, unidades)
            SELECT
              CAST(strftime('%Y',fecha) AS INTEGER),
              CAST(strftime('%m',fecha) AS INTEGER),
              COALESCE(vendedor_nombre,'Sin asignar'),
              COUNT(*),
              ROUND(COALESCE(SUM(ABS(imp_neto)),0),2),
              ROUND(COALESCE(SUM(ABS(imp_neto)),0)/NULLIF(COUNT(*),0),2),
              0
            FROM ventas
            WHERE fecha >= ? AND fecha < ?
              AND es_cabecera = 1
              AND vendedor_nombre IS NOT NULL AND vendedor_nombre != ''
            GROUP BY CAST(strftime('%Y',fecha) AS INTEGER),
                     CAST(strftime('%m',fecha) AS INTEGER),
                     vendedor_nombre`,
      args: [d0, d1],
    },
    {
      label: "crm_productos_mensual",
      sql: `INSERT OR REPLACE INTO crm_productos_mensual
             (anio, mes, codigo, descripcion, unidades, facturacion, tickets, pvp_medio)
            SELECT
              CAST(strftime('%Y',fecha) AS INTEGER),
              CAST(strftime('%m',fecha) AS INTEGER),
              codigo,
              COALESCE(MAX(descripcion),'Sin descripción'),
              COALESCE(SUM(unidades),0),
              ROUND(COALESCE(SUM(pvp*unidades),0),2),
              COUNT(DISTINCT hash_linea),
              ROUND(COALESCE(AVG(pvp),0),2)
            FROM ventas
            WHERE fecha >= ? AND fecha < ?
              AND codigo IS NOT NULL AND codigo != ''
              AND descripcion IS NOT NULL AND descripcion != ''
            GROUP BY CAST(strftime('%Y',fecha) AS INTEGER),
                     CAST(strftime('%m',fecha) AS INTEGER),
                     codigo`,
      args: [d0, d1],
    },
    {
      label: "crm_segmentacion_mensual",
      sql: `INSERT OR REPLACE INTO crm_segmentacion_mensual
             (anio, mes, tipo_pago, tickets, facturacion)
            SELECT
              CAST(strftime('%Y',fecha) AS INTEGER),
              CAST(strftime('%m',fecha) AS INTEGER),
              COALESCE(tipo_pago,'Otros'),
              COUNT(*),
              ROUND(COALESCE(SUM(ABS(imp_neto)),0),2)
            FROM ventas
            WHERE fecha >= ? AND fecha < ?
              AND es_cabecera = 1
            GROUP BY CAST(strftime('%Y',fecha) AS INTEGER),
                     CAST(strftime('%m',fecha) AS INTEGER),
                     tipo_pago`,
      args: [d0, d1],
    },
  ];

  for (const stmt of stmts) {
    try {
      const r = await db.execute({ sql: stmt.sql, args: stmt.args });
      log.push(`[${e(t0)}s] ${stmt.label} año ${anio}: ${r.rowsAffected} filas insertadas`);
    } catch (err) {
      const msg = `ERROR ${stmt.label} año ${anio}: ${String(err)}`;
      log.push(`[${e(t0)}s] ${msg}`);
      errors.push(msg);
    }
  }
}

async function runData(log: string[], errors: string[], t0: number) {
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  for (const anio of years) {
    await runYear(anio, log, errors, t0);
  }
  log.push(`[${e(t0)}s] Todos los años procesados`);
}

function e(t0: number) {
  return ((Date.now() - t0) / 1000).toFixed(1);
}
