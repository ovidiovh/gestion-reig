import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Este endpoint puede tardar varios minutos — se llama UNA VEZ tras el deploy
export const maxDuration = 300;

/**
 * POST /api/crm/precalcular
 * Crea y rellena las tablas resumen precalculadas desde la tabla ventas.
 * Ejecutar UNA VEZ tras cada carga masiva de datos.
 *
 * Columnas reales en ventas:
 *   fecha, hora, num_doc, vendedor_nombre, tipo, tipo_pago,
 *   codigo, descripcion, unidades, pvp, imp_neto, es_cabecera, hash_linea
 *
 * Tablas creadas:
 *   - crm_resumen_mensual       (una fila por mes)
 *   - crm_vendedores_mensual    (una fila por mes × vendedor)
 *   - crm_productos_mensual     (una fila por mes × código de producto)
 *   - crm_segmentacion_mensual  (una fila por mes × tipo_pago)
 */
export async function POST() {
  const log: string[] = [];
  const t0 = Date.now();

  try {
    // ── 1. Crear tablas ────────────────────────────────────────────────────
    await db.execute(`
      CREATE TABLE IF NOT EXISTS crm_resumen_mensual (
        anio         INTEGER NOT NULL,
        mes          INTEGER NOT NULL,
        facturacion  REAL    DEFAULT 0,
        tickets      INTEGER DEFAULT 0,
        unidades     REAL    DEFAULT 0,
        ticket_medio REAL    DEFAULT 0,
        PRIMARY KEY (anio, mes)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS crm_vendedores_mensual (
        anio         INTEGER NOT NULL,
        mes          INTEGER NOT NULL,
        vendedor     TEXT    NOT NULL,
        tickets      INTEGER DEFAULT 0,
        facturacion  REAL    DEFAULT 0,
        ticket_medio REAL    DEFAULT 0,
        unidades     REAL    DEFAULT 0,
        PRIMARY KEY (anio, mes, vendedor)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS crm_productos_mensual (
        anio        INTEGER NOT NULL,
        mes         INTEGER NOT NULL,
        codigo      TEXT    NOT NULL,
        descripcion TEXT    DEFAULT '',
        unidades    REAL    DEFAULT 0,
        facturacion REAL    DEFAULT 0,
        tickets     INTEGER DEFAULT 0,
        pvp_medio   REAL    DEFAULT 0,
        PRIMARY KEY (anio, mes, codigo)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS crm_segmentacion_mensual (
        anio        INTEGER NOT NULL,
        mes         INTEGER NOT NULL,
        tipo_pago   TEXT    NOT NULL,
        tickets     INTEGER DEFAULT 0,
        facturacion REAL    DEFAULT 0,
        PRIMARY KEY (anio, mes, tipo_pago)
      )
    `);

    log.push(`[${elapsed(t0)}s] Tablas creadas/verificadas`);

    // ── 2. Vaciar tablas ───────────────────────────────────────────────────
    await db.execute(`DELETE FROM crm_resumen_mensual`);
    await db.execute(`DELETE FROM crm_vendedores_mensual`);
    await db.execute(`DELETE FROM crm_productos_mensual`);
    await db.execute(`DELETE FROM crm_segmentacion_mensual`);

    log.push(`[${elapsed(t0)}s] Tablas vaciadas`);

    // ── 3. crm_resumen_mensual ─────────────────────────────────────────────
    // Columnas reales: es_cabecera, imp_neto, unidades, vendedor_nombre
    await db.execute(`
      INSERT INTO crm_resumen_mensual (anio, mes, facturacion, tickets, unidades, ticket_medio)
      SELECT
        CAST(strftime('%Y', fecha) AS INTEGER)  AS anio,
        CAST(strftime('%m', fecha) AS INTEGER)  AS mes,
        ROUND(
          SUM(CASE WHEN es_cabecera = 1 THEN ABS(imp_neto) ELSE 0 END), 2
        )                                        AS facturacion,
        SUM(CASE WHEN es_cabecera = 1 THEN 1 ELSE 0 END)
                                                 AS tickets,
        COALESCE(
          SUM(CASE WHEN es_cabecera = 0 THEN unidades ELSE 0 END), 0
        )                                        AS unidades,
        ROUND(
          SUM(CASE WHEN es_cabecera = 1 THEN ABS(imp_neto) ELSE 0 END) /
          NULLIF(SUM(CASE WHEN es_cabecera = 1 THEN 1 ELSE 0 END), 0), 2
        )                                        AS ticket_medio
      FROM ventas
      GROUP BY
        CAST(strftime('%Y', fecha) AS INTEGER),
        CAST(strftime('%m', fecha) AS INTEGER)
    `);

    const r1 = await db.execute(`SELECT COUNT(*) AS n FROM crm_resumen_mensual`);
    log.push(`[${elapsed(t0)}s] crm_resumen_mensual: ${r1.rows[0]?.[0]} filas`);

    // ── 4. crm_vendedores_mensual ──────────────────────────────────────────
    await db.execute(`
      INSERT INTO crm_vendedores_mensual
             (anio, mes, vendedor, tickets, facturacion, ticket_medio, unidades)
      SELECT
        CAST(strftime('%Y', fecha) AS INTEGER)    AS anio,
        CAST(strftime('%m', fecha) AS INTEGER)    AS mes,
        COALESCE(vendedor_nombre, 'Sin asignar')  AS vendedor,
        COUNT(*)                                  AS tickets,
        ROUND(COALESCE(SUM(ABS(imp_neto)), 0), 2) AS facturacion,
        ROUND(
          COALESCE(SUM(ABS(imp_neto)), 0) / NULLIF(COUNT(*), 0), 2
        )                                         AS ticket_medio,
        0                                         AS unidades
      FROM ventas
      WHERE es_cabecera = 1
        AND vendedor_nombre IS NOT NULL
        AND vendedor_nombre != ''
      GROUP BY
        CAST(strftime('%Y', fecha) AS INTEGER),
        CAST(strftime('%m', fecha) AS INTEGER),
        vendedor_nombre
    `);

    const r2 = await db.execute(`SELECT COUNT(*) AS n FROM crm_vendedores_mensual`);
    log.push(`[${elapsed(t0)}s] crm_vendedores_mensual: ${r2.rows[0]?.[0]} filas`);

    // ── 5. crm_productos_mensual ───────────────────────────────────────────
    await db.execute(`
      INSERT INTO crm_productos_mensual
             (anio, mes, codigo, descripcion, unidades, facturacion, tickets, pvp_medio)
      SELECT
        CAST(strftime('%Y', fecha) AS INTEGER)        AS anio,
        CAST(strftime('%m', fecha) AS INTEGER)        AS mes,
        codigo,
        COALESCE(MAX(descripcion), 'Sin descripción') AS descripcion,
        COALESCE(SUM(unidades), 0)                    AS unidades,
        ROUND(COALESCE(SUM(pvp * unidades), 0), 2)    AS facturacion,
        COUNT(DISTINCT hash_linea)                    AS tickets,
        ROUND(COALESCE(AVG(pvp), 0), 2)               AS pvp_medio
      FROM ventas
      WHERE es_cabecera = 0
        AND codigo      IS NOT NULL AND codigo      != ''
        AND descripcion IS NOT NULL AND descripcion != ''
      GROUP BY
        CAST(strftime('%Y', fecha) AS INTEGER),
        CAST(strftime('%m', fecha) AS INTEGER),
        codigo
    `);

    const r3 = await db.execute(`SELECT COUNT(*) AS n FROM crm_productos_mensual`);
    log.push(`[${elapsed(t0)}s] crm_productos_mensual: ${r3.rows[0]?.[0]} filas`);

    // ── 6. crm_segmentacion_mensual ────────────────────────────────────────
    await db.execute(`
      INSERT INTO crm_segmentacion_mensual (anio, mes, tipo_pago, tickets, facturacion)
      SELECT
        CAST(strftime('%Y', fecha) AS INTEGER)     AS anio,
        CAST(strftime('%m', fecha) AS INTEGER)     AS mes,
        COALESCE(tipo_pago, 'Otros')               AS tipo_pago,
        COUNT(*)                                   AS tickets,
        ROUND(COALESCE(SUM(ABS(imp_neto)), 0), 2)  AS facturacion
      FROM ventas
      WHERE es_cabecera = 1
      GROUP BY
        CAST(strftime('%Y', fecha) AS INTEGER),
        CAST(strftime('%m', fecha) AS INTEGER),
        tipo_pago
    `);

    const r4 = await db.execute(`SELECT COUNT(*) AS n FROM crm_segmentacion_mensual`);
    log.push(`[${elapsed(t0)}s] crm_segmentacion_mensual: ${r4.rows[0]?.[0]} filas`);

    log.push(`[${elapsed(t0)}s] COMPLETADO`);

    return NextResponse.json({ ok: true, log });
  } catch (e) {
    console.error("[crm/precalcular]", e);
    return NextResponse.json({ ok: false, error: String(e), log }, { status: 500 });
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

function elapsed(t0: number) {
  return ((Date.now() - t0) / 1000).toFixed(1);
}
