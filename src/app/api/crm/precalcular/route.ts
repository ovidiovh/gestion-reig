import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Este endpoint puede tardar varios minutos — se llama UNA VEZ tras el deploy
export const maxDuration = 300;

/**
 * POST /api/crm/precalcular
 * 1. Crea índice en ventas(fecha) si no existe  → full scan → index range scan
 * 2. Vacía las tablas resumen
 * 3. Un solo db.batch() con todos los INSERTs (un año por statement × 4 tablas)
 *    WHERE fecha >= '20XX-01-01' AND fecha < '20YY-01-01'  ← usa el índice
 */
export async function POST() {
  const log: string[] = [];
  const t0 = Date.now();

  try {
    // ── 1. Crear tablas e índice ───────────────────────────────────────────
    await db.batch([
      {
        sql: `CREATE TABLE IF NOT EXISTS crm_resumen_mensual (
          anio INTEGER NOT NULL, mes INTEGER NOT NULL,
          facturacion REAL DEFAULT 0, tickets INTEGER DEFAULT 0,
          unidades REAL DEFAULT 0, ticket_medio REAL DEFAULT 0,
          PRIMARY KEY (anio, mes))`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS crm_vendedores_mensual (
          anio INTEGER NOT NULL, mes INTEGER NOT NULL, vendedor TEXT NOT NULL,
          tickets INTEGER DEFAULT 0, facturacion REAL DEFAULT 0,
          ticket_medio REAL DEFAULT 0, unidades REAL DEFAULT 0,
          PRIMARY KEY (anio, mes, vendedor))`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS crm_productos_mensual (
          anio INTEGER NOT NULL, mes INTEGER NOT NULL, codigo TEXT NOT NULL,
          descripcion TEXT DEFAULT '', unidades REAL DEFAULT 0,
          facturacion REAL DEFAULT 0, tickets INTEGER DEFAULT 0,
          pvp_medio REAL DEFAULT 0, PRIMARY KEY (anio, mes, codigo))`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS crm_segmentacion_mensual (
          anio INTEGER NOT NULL, mes INTEGER NOT NULL, tipo_pago TEXT NOT NULL,
          tickets INTEGER DEFAULT 0, facturacion REAL DEFAULT 0,
          PRIMARY KEY (anio, mes, tipo_pago))`,
      },
      // Índice en fecha para que los range queries sean instantáneos
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha)`,
      },
    ]);
    log.push(`[${e(t0)}s] Tablas e índice creados`);

    // ── 2. Vaciar tablas ───────────────────────────────────────────────────
    await db.batch([
      { sql: `DELETE FROM crm_resumen_mensual` },
      { sql: `DELETE FROM crm_vendedores_mensual` },
      { sql: `DELETE FROM crm_productos_mensual` },
      { sql: `DELETE FROM crm_segmentacion_mensual` },
    ]);
    log.push(`[${e(t0)}s] Tablas vaciadas`);

    // ── 3. INSERTs año a año en un solo batch (usa index range scan) ───────
    // fecha >= '20XX-01-01' AND fecha < '20YY-01-01' → usa idx_ventas_fecha
    const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
    const stmts: { sql: string; args: string[] }[] = [];

    for (const anio of years) {
      const d0 = `${anio}-01-01`;
      const d1 = `${anio + 1}-01-01`;
      const y = String(anio);

      stmts.push({
        sql: `INSERT OR REPLACE INTO crm_resumen_mensual
               (anio, mes, facturacion, tickets, unidades, ticket_medio)
              SELECT
                CAST(strftime('%Y', fecha) AS INTEGER),
                CAST(strftime('%m', fecha) AS INTEGER),
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
      });

      stmts.push({
        sql: `INSERT OR REPLACE INTO crm_vendedores_mensual
               (anio, mes, vendedor, tickets, facturacion, ticket_medio, unidades)
              SELECT
                CAST(strftime('%Y', fecha) AS INTEGER),
                CAST(strftime('%m', fecha) AS INTEGER),
                COALESCE(vendedor_nombre,'Sin asignar'),
                COUNT(*),
                ROUND(COALESCE(SUM(ABS(imp_neto)),0),2),
                ROUND(COALESCE(SUM(ABS(imp_neto)),0)/NULLIF(COUNT(*),0),2),
                0
              FROM ventas
              WHERE fecha >= ? AND fecha < ?
                AND es_cabecera=1
                AND vendedor_nombre IS NOT NULL AND vendedor_nombre != ''
              GROUP BY CAST(strftime('%Y',fecha) AS INTEGER),
                       CAST(strftime('%m',fecha) AS INTEGER),
                       vendedor_nombre`,
        args: [d0, d1],
      });

      stmts.push({
        sql: `INSERT OR REPLACE INTO crm_productos_mensual
               (anio, mes, codigo, descripcion, unidades, facturacion, tickets, pvp_medio)
              SELECT
                CAST(strftime('%Y', fecha) AS INTEGER),
                CAST(strftime('%m', fecha) AS INTEGER),
                codigo,
                COALESCE(MAX(descripcion),'Sin descripción'),
                COALESCE(SUM(unidades),0),
                ROUND(COALESCE(SUM(pvp*unidades),0),2),
                COUNT(DISTINCT hash_linea),
                ROUND(COALESCE(AVG(pvp),0),2)
              FROM ventas
              WHERE fecha >= ? AND fecha < ?
                AND es_cabecera=0
                AND codigo IS NOT NULL AND codigo != ''
                AND descripcion IS NOT NULL AND descripcion != ''
              GROUP BY CAST(strftime('%Y',fecha) AS INTEGER),
                       CAST(strftime('%m',fecha) AS INTEGER),
                       codigo`,
        args: [d0, d1],
      });

      stmts.push({
        sql: `INSERT OR REPLACE INTO crm_segmentacion_mensual
               (anio, mes, tipo_pago, tickets, facturacion)
              SELECT
                CAST(strftime('%Y', fecha) AS INTEGER),
                CAST(strftime('%m', fecha) AS INTEGER),
                COALESCE(tipo_pago,'Otros'),
                COUNT(*),
                ROUND(COALESCE(SUM(ABS(imp_neto)),0),2)
              FROM ventas
              WHERE fecha >= ? AND fecha < ?
                AND es_cabecera=1
              GROUP BY CAST(strftime('%Y',fecha) AS INTEGER),
                       CAST(strftime('%m',fecha) AS INTEGER),
                       tipo_pago`,
        args: [d0, d1],
      });

      log.push(`Año ${y} encolado`);
    }

    log.push(`[${e(t0)}s] Lanzando batch de ${stmts.length} statements...`);
    await db.batch(stmts);
    log.push(`[${e(t0)}s] Batch completado`);

    // ── 4. Verificar ──────────────────────────────────────────────────────
    const [r1, r2, r3, r4] = await Promise.all([
      db.execute(`SELECT COUNT(*) AS n FROM crm_resumen_mensual`),
      db.execute(`SELECT COUNT(*) AS n FROM crm_vendedores_mensual`),
      db.execute(`SELECT COUNT(*) AS n FROM crm_productos_mensual`),
      db.execute(`SELECT COUNT(*) AS n FROM crm_segmentacion_mensual`),
    ]);

    log.push(
      `[${e(t0)}s] COMPLETADO — resumen:${r1.rows[0]?.[0]} ` +
      `vendedores:${r2.rows[0]?.[0]} productos:${r3.rows[0]?.[0]} ` +
      `segmentacion:${r4.rows[0]?.[0]}`
    );

    return NextResponse.json({ ok: true, log });
  } catch (err) {
    console.error("[crm/precalcular]", err);
    return NextResponse.json({ ok: false, error: String(err), log }, { status: 500 });
  }
}

/** GET /api/crm/precalcular — estado de las tablas resumen */
export async function GET() {
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

function e(t0: number) {
  return ((Date.now() - t0) / 1000).toFixed(1);
}
