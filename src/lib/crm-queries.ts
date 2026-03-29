import { query } from "./db";

// ============================================================
// CRM QUERIES — Análisis de clientes desde tabla ventas
// ============================================================
// Columnas reales en Turso:
//   fecha, vendedor, codigo, descripcion, imp_bruto, imp_neto,
//   pvp, cantidad, es_cabecera, tipo_pago, hash
//
// CAB_WHERE (es_cabecera=1): una fila por ticket
//   - Facturación: SUM(ABS(imp_neto))
//   - Tickets:     COUNT(*)
// DET_WHERE (es_cabecera=0): una fila por línea de producto
//   - unidades:    SUM(cantidad)
//   - total línea: pvp * cantidad

const CAB_WHERE = `es_cabecera = 1`;
const DET_WHERE = `es_cabecera = 0`;

// Timeout: rechaza si Turso tarda más de 25 s
function withTimeout<T>(p: Promise<T>, ms = 25_000): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`CRM query timeout (${ms}ms)`)), ms)
    ),
  ]);
}

/* ── Resumen general de la base ── */
export async function getResumenBase() {
  try {
    const rows = await withTimeout(query<{
      total_filas: number;
      total_ventas: number;
      fecha_min: string;
      fecha_max: string;
      total_vendedores: number;
    }>(`
      SELECT
        COUNT(*) as total_filas,
        COUNT(*) as total_ventas,
        MIN(fecha) as fecha_min,
        MAX(fecha) as fecha_max,
        COUNT(DISTINCT vendedor) as total_vendedores
      FROM ventas
      WHERE ${CAB_WHERE}
    `));
    return rows[0] ?? { total_filas: 0, total_ventas: 0, fecha_min: null, fecha_max: null, total_vendedores: 0 };
  } catch (e) {
    console.error("[crm] getResumenBase:", e);
    return { total_filas: 0, total_ventas: 0, fecha_min: null, fecha_max: null, total_vendedores: 0 };
  }
}

/* ── KPIs de clientes (agrupado por tipo_pago) ── */
export async function getClienteKpis() {
  try {
    return await withTimeout(query<{
      tipo: string;
      tickets: number;
      facturacion: number;
      ticket_medio: number;
    }>(`
      SELECT
        COALESCE(tipo_pago, 'Otros') as tipo,
        COUNT(*) as tickets,
        ROUND(COALESCE(SUM(ABS(imp_neto)), 0), 2) as facturacion,
        ROUND(COALESCE(SUM(ABS(imp_neto)), 0) / NULLIF(COUNT(*), 0), 2) as ticket_medio
      FROM ventas
      WHERE ${CAB_WHERE}
      GROUP BY tipo_pago
      ORDER BY facturacion DESC
    `));
  } catch (e) {
    console.error("[crm] getClienteKpis:", e);
    return [];
  }
}

/* ── Top vendedores por facturación ── */
export async function getTopVendedores(limit = 10) {
  try {
    return await withTimeout(query<{
      vendedor: string;
      tickets: number;
      facturacion: number;
      ticket_medio: number;
      unidades: number;
    }>(`
      SELECT
        vendedor_nombre AS vendedor,
        COUNT(*) as tickets,
        ROUND(COALESCE(SUM(ABS(imp_neto)), 0), 2) as facturacion,
        ROUND(COALESCE(SUM(ABS(imp_neto)), 0) / NULLIF(COUNT(*), 0), 2) as ticket_medio,
        0 as unidades
      FROM ventas
      WHERE ${CAB_WHERE}
        AND vendedor_nombre IS NOT NULL
        AND vendedor_nombre != ''
      GROUP BY vendedor_nombre
      ORDER BY facturacion DESC
      LIMIT ?
    `, [limit]));
  } catch (e) {
    console.error("[crm] getTopVendedores:", e);
    return [];
  }
}

/* ── Ventas por día de la semana (strftime '%w': 0=domingo) ── */
export async function getVentasPorDia() {
  try {
    return await withTimeout(query<{
      dia: number;
      dia_nombre: string;
      tickets: number;
      facturacion: number;
    }>(`
      SELECT
        CAST(strftime('%w', fecha) AS INTEGER) as dia,
        CASE CAST(strftime('%w', fecha) AS INTEGER)
          WHEN 0 THEN 'Domingo'
          WHEN 1 THEN 'Lunes'
          WHEN 2 THEN 'Martes'
          WHEN 3 THEN 'Miércoles'
          WHEN 4 THEN 'Jueves'
          WHEN 5 THEN 'Viernes'
          WHEN 6 THEN 'Sábado'
        END as dia_nombre,
        COUNT(*) as tickets,
        ROUND(COALESCE(SUM(ABS(imp_neto)), 0), 2) as facturacion
      FROM ventas
      WHERE ${CAB_WHERE}
      GROUP BY strftime('%w', fecha)
      ORDER BY dia
    `));
  } catch (e) {
    console.error("[crm] getVentasPorDia:", e);
    return [];
  }
}

/* ── Ventas por franja horaria — no hay columna hora, retorna vacío ── */
export async function getVentasPorHora() {
  return [] as { franja: string; tickets: number; facturacion: number }[];
}

/* ── Últimas ventas (muestra reciente, filas de detalle) ── */
export async function getUltimasVentas(limit = 20) {
  try {
    return await withTimeout(query<{
      fecha: string;
      hash: string;
      vendedor: string;
      descripcion: string;
      pvp: number;
      cantidad: number;
      total: number;
    }>(`
      SELECT
        fecha,
        COALESCE(hash, '') as hash,
        COALESCE(vendedor_nombre, '') as vendedor,
        COALESCE(descripcion, '') as descripcion,
        COALESCE(pvp, 0) as pvp,
        COALESCE(unidades, 0) as cantidad,
        ROUND(COALESCE(pvp * unidades, 0), 2) as total
      FROM ventas
      WHERE ${DET_WHERE}
      ORDER BY fecha DESC, rowid DESC
      LIMIT ?
    `, [limit]));
  } catch (e) {
    console.error("[crm] getUltimasVentas:", e);
    return [];
  }
}

/* ── Top productos por unidades vendidas ── */
export async function getTopProductos(limit = 15) {
  try {
    return await withTimeout(query<{
      codigo: string;
      descripcion: string;
      unidades: number;
      facturacion: number;
      tickets: number;
    }>(`
      SELECT
        codigo,
        descripcion,
        COALESCE(SUM(unidades), 0) as unidades,
        ROUND(COALESCE(SUM(pvp * unidades), 0), 2) as facturacion,
        COUNT(DISTINCT hash_linea) as tickets
      FROM ventas
      WHERE ${DET_WHERE}
        AND codigo IS NOT NULL
        AND codigo != ''
      GROUP BY codigo, descripcion
      ORDER BY unidades DESC
      LIMIT ?
    `, [limit]));
  } catch (e) {
    console.error("[crm] getTopProductos:", e);
    return [];
  }
}

/* ── Resumen tablas en la base de datos ── */
export async function getTablasInfo() {
  try {
    const rows = await withTimeout(query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    ));
    const info = [];
    for (const row of rows) {
      try {
        const count = await withTimeout(query<{ total: number }>(
          `SELECT COUNT(*) as total FROM "${row.name}"`
        ));
        info.push({ tabla: row.name, filas: count[0]?.total ?? 0 });
      } catch {
        info.push({ tabla: row.name, filas: 0 });
      }
    }
    return info;
  } catch (e) {
    console.error("[crm] getTablasInfo:", e);
    return [];
  }
}

// ============================================================
// CRM AVANZADO — Lee de tablas precalculadas (milisegundos)
// Poblar con: POST /api/crm/precalcular
// ============================================================

// Filtro de rango mes: printf('%04d-%02d', anio, mes) >= strftime('%Y-%m', ?)
const MES_RANGE = `
  printf('%04d-%02d', anio, mes) >= strftime('%Y-%m', ?)
  AND printf('%04d-%02d', anio, mes) <= strftime('%Y-%m', ?)
`;

/* ── KPIs resumen ── */
export async function getCrmResumen(desde: string, hasta: string) {
  try {
    const [row] = await withTimeout(query<{
      facturacion: number;
      tickets: number;
      unidades: number;
    }>(`
      SELECT
        ROUND(COALESCE(SUM(facturacion), 0), 2) AS facturacion,
        COALESCE(SUM(tickets), 0)               AS tickets,
        COALESCE(SUM(unidades), 0)              AS unidades
      FROM crm_resumen_mensual
      WHERE ${MES_RANGE}
    `, [desde, hasta]));

    const facturacion  = Number(row?.facturacion || 0);
    const tickets      = Number(row?.tickets     || 0);
    const unidades     = Number(row?.unidades    || 0);
    const ticket_medio = tickets > 0 ? Math.round((facturacion / tickets) * 100) / 100 : 0;

    return { facturacion, tickets, ticket_medio, unidades,
             pct_receta: 0, tickets_receta: 0, tickets_cross: 0, pct_cross: 0 };
  } catch (e) {
    console.error("[crm] getCrmResumen:", e);
    return { facturacion: 0, tickets: 0, ticket_medio: 0, unidades: 0,
             pct_receta: 0, tickets_receta: 0, tickets_cross: 0, pct_cross: 0 };
  }
}

/* ── Tendencia mensual ── */
export async function getCrmTendencia(desde: string, hasta: string) {
  try {
    return await withTimeout(query<{
      mes: string;
      facturacion: number;
      tickets: number;
      ticket_medio: number;
    }>(`
      SELECT
        printf('%04d-%02d', anio, mes)          AS mes,
        ROUND(COALESCE(facturacion, 0), 2)      AS facturacion,
        COALESCE(tickets, 0)                    AS tickets,
        ROUND(COALESCE(ticket_medio, 0), 2)     AS ticket_medio
      FROM crm_resumen_mensual
      WHERE ${MES_RANGE}
      ORDER BY anio, mes
    `, [desde, hasta]));
  } catch (e) {
    console.error("[crm] getCrmTendencia:", e);
    return [];
  }
}

/* ── Comparativa YoY: 2025-2026 mes a mes ── */
export async function getCrmComparativa() {
  try {
    return await withTimeout(query<{
      anio: string;
      mes_num: string;
      facturacion: number;
      tickets: number;
    }>(`
      SELECT
        CAST(anio AS TEXT)                      AS anio,
        printf('%02d', mes)                     AS mes_num,
        ROUND(COALESCE(facturacion, 0), 2)      AS facturacion,
        COALESCE(tickets, 0)                    AS tickets
      FROM crm_resumen_mensual
      WHERE anio IN (2025, 2026)
      ORDER BY anio, mes
    `));
  } catch (e) {
    console.error("[crm] getCrmComparativa:", e);
    return [];
  }
}

/* ── Ranking de vendedores ── */
export async function getCrmVendedores(desde: string, hasta: string) {
  try {
    return await withTimeout(query<{
      vendedor: string;
      tickets: number;
      facturacion: number;
      ticket_medio: number;
      unidades: number;
      pct_receta: number;
    }>(`
      SELECT
        vendedor,
        SUM(tickets)                                                    AS tickets,
        ROUND(COALESCE(SUM(facturacion), 0), 2)                        AS facturacion,
        ROUND(COALESCE(SUM(facturacion), 0) / NULLIF(SUM(tickets), 0), 2) AS ticket_medio,
        COALESCE(SUM(unidades), 0)                                     AS unidades,
        0.0                                                            AS pct_receta
      FROM crm_vendedores_mensual
      WHERE ${MES_RANGE}
      GROUP BY vendedor
      ORDER BY facturacion DESC
    `, [desde, hasta]));
  } catch (e) {
    console.error("[crm] getCrmVendedores:", e);
    return [];
  }
}

/* ── Top productos por facturación o unidades ── */
export async function getCrmProductos(
  desde: string,
  hasta: string,
  limit = 20,
  orderBy: "facturacion" | "unidades" = "facturacion"
) {
  try {
    const order = orderBy === "unidades" ? "unidades DESC" : "facturacion DESC";
    return await withTimeout(query<{
      codigo: string;
      descripcion: string;
      unidades: number;
      facturacion: number;
      tickets: number;
      pvp_medio: number;
    }>(`
      SELECT
        codigo,
        MAX(descripcion)                           AS descripcion,
        COALESCE(SUM(unidades), 0)                 AS unidades,
        ROUND(COALESCE(SUM(facturacion), 0), 2)    AS facturacion,
        SUM(tickets)                               AS tickets,
        ROUND(COALESCE(AVG(pvp_medio), 0), 2)      AS pvp_medio
      FROM crm_productos_mensual
      WHERE ${MES_RANGE}
      GROUP BY codigo
      ORDER BY ${order}
      LIMIT ?
    `, [desde, hasta, limit]));
  } catch (e) {
    console.error("[crm] getCrmProductos:", e);
    return [];
  }
}

/* ── Cronograma — pendiente de precalcular ── */
export async function getCrmCronograma(_desde: string, _hasta: string) {
  return [] as { dia_semana: number; hora_num: number; tickets: number; facturacion: number }[];
}

/* ── Segmentación por tipo_pago ── */
export async function getCrmSegmentacion(desde: string, hasta: string) {
  try {
    const rows = await withTimeout(query<{
      tipo_pago: string;
      tickets: number;
      facturacion: number;
    }>(`
      SELECT
        tipo_pago,
        SUM(tickets)                              AS tickets,
        ROUND(COALESCE(SUM(facturacion), 0), 2)   AS facturacion
      FROM crm_segmentacion_mensual
      WHERE ${MES_RANGE}
      GROUP BY tipo_pago
      ORDER BY facturacion DESC
    `, [desde, hasta]));

    const byTipo = rows.map(r => ({ tipo: r.tipo_pago, tickets: r.tickets, facturacion: r.facturacion }));
    const byPago = rows.slice(0, 8).map(r => ({ tipo_pago: r.tipo_pago, tickets: r.tickets, facturacion: r.facturacion }));
    const byReceta = [{ tipo: "Venta libre", tickets: 0, facturacion: 0 }];

    return { byTipo, byPago, byReceta };
  } catch (e) {
    console.error("[crm] getCrmSegmentacion:", e);
    return { byTipo: [], byPago: [], byReceta: [] };
  }
}
