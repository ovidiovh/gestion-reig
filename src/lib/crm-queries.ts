import { query } from "./db";

// ============================================================
// CRM QUERIES — Análisis de clientes desde tabla ventas
// ============================================================
// Los clientes de crédito tienen num_doc que empieza por C
// Los de contado por B. Otros prefijos: D, N, K, Y, Z
// Campo vendedor_nombre identifica quién vendió

// BASE_WHERE simplificado: solo usa columnas cubiertas por idx_ventas_crm(tipo,es_cabecera,fecha)
// Los filtros de rp/descripcion se eliminaron — requieren row-fetch y hacen lentas las queries de año completo
const BASE_WHERE = `
  tipo IN ('Contado', 'Credito')
  AND es_cabecera = 0
`;

/* ── Resumen general de la base ── */
export async function getResumenBase() {
  const rows = await query<{
    total_filas: number;
    total_ventas: number;
    fecha_min: string;
    fecha_max: string;
    total_vendedores: number;
  }>(`
    SELECT
      COUNT(*) as total_filas,
      COUNT(DISTINCT num_doc) as total_ventas,
      MIN(fecha) as fecha_min,
      MAX(fecha) as fecha_max,
      COUNT(DISTINCT vendedor_nombre) as total_vendedores
    FROM ventas
    WHERE ${BASE_WHERE}
  `);
  return rows[0];
}

/* ── KPIs de clientes (crédito vs contado) ── */
export async function getClienteKpis() {
  const rows = await query<{
    tipo: string;
    tickets: number;
    facturacion: number;
    ticket_medio: number;
  }>(`
    SELECT
      tipo,
      COUNT(DISTINCT num_doc) as tickets,
      ROUND(SUM(pvp * unidades), 2) as facturacion,
      ROUND(SUM(pvp * unidades) / MAX(COUNT(DISTINCT num_doc), 1), 2) as ticket_medio
    FROM ventas
    WHERE ${BASE_WHERE}
    GROUP BY tipo
    ORDER BY facturacion DESC
  `);
  return rows;
}

/* ── Top vendedores por facturación ── */
export async function getTopVendedores(limit = 10) {
  const rows = await query<{
    vendedor: string;
    tickets: number;
    facturacion: number;
    ticket_medio: number;
    unidades: number;
  }>(`
    SELECT
      vendedor_nombre as vendedor,
      COUNT(DISTINCT num_doc) as tickets,
      ROUND(SUM(pvp * unidades), 2) as facturacion,
      ROUND(SUM(pvp * unidades) / MAX(COUNT(DISTINCT num_doc), 1), 2) as ticket_medio,
      SUM(unidades) as unidades
    FROM ventas
    WHERE ${BASE_WHERE}
      AND vendedor_nombre IS NOT NULL
      AND vendedor_nombre != ''
    GROUP BY vendedor_nombre
    ORDER BY facturacion DESC
    LIMIT ?
  `, [limit]);
  return rows;
}

/* ── Ventas por día de la semana ── */
export async function getVentasPorDia() {
  const rows = await query<{
    dia: number;
    dia_nombre: string;
    tickets: number;
    facturacion: number;
  }>(`
    SELECT
      dia_semana as dia,
      CASE dia_semana
        WHEN 0 THEN 'Domingo'
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sábado'
      END as dia_nombre,
      COUNT(DISTINCT num_doc) as tickets,
      ROUND(SUM(pvp * unidades), 2) as facturacion
    FROM ventas
    WHERE ${BASE_WHERE}
    GROUP BY dia_semana
    ORDER BY dia_semana
  `);
  return rows;
}

/* ── Ventas por franja horaria ── */
export async function getVentasPorHora() {
  const rows = await query<{
    franja: string;
    tickets: number;
    facturacion: number;
  }>(`
    SELECT
      CASE
        WHEN CAST(SUBSTR(hora, 1, 2) AS INTEGER) < 9 THEN 'Guardia (antes 9h)'
        WHEN CAST(SUBSTR(hora, 1, 2) AS INTEGER) < 14 THEN 'Mañana (9-14h)'
        WHEN CAST(SUBSTR(hora, 1, 2) AS INTEGER) < 17 THEN 'Tarde (14-17h)'
        WHEN CAST(SUBSTR(hora, 1, 2) AS INTEGER) < 21 THEN 'Tarde-noche (17-21h)'
        ELSE 'Guardia (21h+)'
      END as franja,
      COUNT(DISTINCT num_doc) as tickets,
      ROUND(SUM(pvp * unidades), 2) as facturacion
    FROM ventas
    WHERE ${BASE_WHERE}
      AND hora IS NOT NULL
    GROUP BY franja
    ORDER BY MIN(CAST(SUBSTR(hora, 1, 2) AS INTEGER))
  `);
  return rows;
}

/* ── Últimas ventas (muestra reciente) ── */
export async function getUltimasVentas(limit = 20) {
  const rows = await query<{
    fecha: string;
    num_doc: string;
    tipo: string;
    vendedor: string;
    descripcion: string;
    pvp: number;
    unidades: number;
    total: number;
  }>(`
    SELECT
      fecha,
      num_doc,
      tipo,
      vendedor_nombre as vendedor,
      descripcion,
      pvp,
      unidades,
      ROUND(pvp * unidades, 2) as total
    FROM ventas
    WHERE ${BASE_WHERE}
    ORDER BY fecha DESC, rowid DESC
    LIMIT ?
  `, [limit]);
  return rows;
}

/* ── Top productos por unidades vendidas ── */
export async function getTopProductos(limit = 15) {
  const rows = await query<{
    codigo: string;
    descripcion: string;
    unidades: number;
    facturacion: number;
    tickets: number;
  }>(`
    SELECT
      codigo,
      descripcion,
      SUM(unidades) as unidades,
      ROUND(SUM(pvp * unidades), 2) as facturacion,
      COUNT(DISTINCT num_doc) as tickets
    FROM ventas
    WHERE ${BASE_WHERE}
      AND codigo IS NOT NULL
      AND codigo != ''
    GROUP BY codigo, descripcion
    ORDER BY unidades DESC
    LIMIT ?
  `, [limit]);
  return rows;
}

/* ── Resumen tablas en la base de datos ── */
export async function getTablasInfo() {
  const rows = await query<{
    name: string;
  }>(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);

  const info = [];
  for (const row of rows) {
    const count = await query<{ total: number }>(
      `SELECT COUNT(*) as total FROM "${row.name}"`
    );
    info.push({ tabla: row.name, filas: count[0]?.total ?? 0 });
  }
  return info;
}

// ============================================================
// CRM AVANZADO — Funciones para el dashboard CRM completo
// ============================================================

/* ── KPIs resumen — CTE de una sola pasada, sin subquery IN() ── */
export async function getCrmResumen(desde: string, hasta: string) {
  // Una sola query: agrupa por num_doc, luego agrega.
  // Evita el lento IN (SELECT DISTINCT ...) que causaba timeout en 472K filas.
  const [row] = await query<{
    facturacion: number;
    tickets: number;
    ticket_medio: number;
    unidades: number;
    pct_receta: number;
    tickets_receta: number;
    tickets_cross: number;
  }>(`
    WITH tf AS (
      SELECT
        num_doc,
        SUM(pvp * unidades)                                        AS total,
        SUM(unidades)                                              AS uds,
        MAX(CASE WHEN es_receta = 1 THEN 1 ELSE 0 END)            AS hr,
        MAX(CASE WHEN es_receta = 0 THEN 1 ELSE 0 END)            AS hl,
        SUM(CASE WHEN es_receta = 1 THEN pvp * unidades ELSE 0 END) AS total_rx
      FROM ventas
      WHERE ${BASE_WHERE} AND fecha >= ? AND fecha <= ?
      GROUP BY num_doc
    )
    SELECT
      ROUND(COALESCE(SUM(total),    0), 2)  AS facturacion,
      COUNT(*)                               AS tickets,
      ROUND(COALESCE(SUM(total), 0) / NULLIF(COUNT(*), 0), 2) AS ticket_medio,
      COALESCE(SUM(uds), 0)                  AS unidades,
      ROUND(100.0 * COALESCE(SUM(total_rx), 0) / NULLIF(SUM(total), 0), 1) AS pct_receta,
      COALESCE(SUM(hr), 0)                   AS tickets_receta,
      COALESCE(SUM(CASE WHEN hr = 1 AND hl = 1 THEN 1 ELSE 0 END), 0) AS tickets_cross
    FROM tf
  `, [desde, hasta]);

  const tickets_receta = Number(row?.tickets_receta || 0);
  const tickets_cross  = Number(row?.tickets_cross  || 0);

  return {
    facturacion:    Number(row?.facturacion    || 0),
    tickets:        Number(row?.tickets        || 0),
    ticket_medio:   Number(row?.ticket_medio   || 0),
    unidades:       Number(row?.unidades       || 0),
    pct_receta:     Number(row?.pct_receta     || 0),
    tickets_receta,
    tickets_cross,
    pct_cross: tickets_receta > 0
      ? Math.round((tickets_cross / tickets_receta) * 1000) / 10
      : 0,
  };
}

/* ── Tendencia mensual (para gráfico de líneas) ── */
export async function getCrmTendencia(desde: string, hasta: string) {
  return query<{
    mes: string;
    facturacion: number;
    tickets: number;
    ticket_medio: number;
  }>(`
    SELECT
      strftime('%Y-%m', fecha) as mes,
      ROUND(COALESCE(SUM(pvp * unidades), 0), 2) as facturacion,
      COUNT(DISTINCT num_doc) as tickets,
      ROUND(COALESCE(SUM(pvp * unidades), 0) / MAX(COUNT(DISTINCT num_doc), 1), 2) as ticket_medio
    FROM ventas
    WHERE ${BASE_WHERE} AND fecha >= ? AND fecha <= ?
    GROUP BY strftime('%Y-%m', fecha)
    ORDER BY mes
  `, [desde, hasta]);
}

/* ── Comparativa YoY: 2024-2026 mes a mes (fecha acotada para velocidad) ── */
export async function getCrmComparativa() {
  return query<{
    anio: string;
    mes_num: string;
    facturacion: number;
    tickets: number;
  }>(`
    SELECT
      strftime('%Y', fecha) as anio,
      strftime('%m', fecha) as mes_num,
      ROUND(COALESCE(SUM(pvp * unidades), 0), 2) as facturacion,
      COUNT(DISTINCT num_doc) as tickets
    FROM ventas
    WHERE ${BASE_WHERE}
      AND fecha >= '2024-01-01' AND fecha <= '2026-12-31'
    GROUP BY anio, mes_num
    ORDER BY anio, mes_num
  `);
}

/* ── Ranking de vendedores con métricas completas ── */
export async function getCrmVendedores(desde: string, hasta: string) {
  return query<{
    vendedor: string;
    tickets: number;
    facturacion: number;
    ticket_medio: number;
    unidades: number;
    pct_receta: number;
  }>(`
    SELECT
      vendedor_nombre as vendedor,
      COUNT(DISTINCT num_doc) as tickets,
      ROUND(COALESCE(SUM(pvp * unidades), 0), 2) as facturacion,
      ROUND(COALESCE(SUM(pvp * unidades), 0) / MAX(COUNT(DISTINCT num_doc), 1), 2) as ticket_medio,
      COALESCE(SUM(unidades), 0) as unidades,
      ROUND(100.0 * COALESCE(SUM(CASE WHEN es_receta = 1 THEN pvp * unidades ELSE 0 END), 0)
        / NULLIF(SUM(pvp * unidades), 0), 1) as pct_receta
    FROM ventas
    WHERE ${BASE_WHERE} AND fecha >= ? AND fecha <= ?
      AND vendedor_nombre IS NOT NULL AND vendedor_nombre != ''
    GROUP BY vendedor_nombre
    ORDER BY facturacion DESC
  `, [desde, hasta]);
}

/* ── Top productos por facturación o unidades ── */
export async function getCrmProductos(
  desde: string,
  hasta: string,
  limit = 20,
  orderBy: "facturacion" | "unidades" = "facturacion"
) {
  const order = orderBy === "unidades" ? "unidades DESC" : "facturacion DESC";
  return query<{
    codigo: string;
    descripcion: string;
    unidades: number;
    facturacion: number;
    tickets: number;
    pvp_medio: number;
  }>(`
    SELECT
      COALESCE(codigo, '') as codigo,
      COALESCE(descripcion, 'Sin descripción') as descripcion,
      COALESCE(SUM(unidades), 0) as unidades,
      ROUND(COALESCE(SUM(pvp * unidades), 0), 2) as facturacion,
      COUNT(DISTINCT num_doc) as tickets,
      ROUND(COALESCE(AVG(pvp), 0), 2) as pvp_medio
    FROM ventas
    WHERE ${BASE_WHERE} AND fecha >= ? AND fecha <= ?
      AND codigo IS NOT NULL AND codigo != ''
      AND descripcion IS NOT NULL AND descripcion != ''
    GROUP BY codigo, descripcion
    ORDER BY ${order}
    LIMIT ?
  `, [desde, hasta, limit]);
}

/* ── Cronograma: tickets por día de semana × hora ── */
// Usa es_cabecera=1 (una fila por ticket) para evitar COUNT(DISTINCT) lento en 472K filas
export async function getCrmCronograma(desde: string, hasta: string) {
  return query<{
    dia_semana: number;
    hora_num: number;
    tickets: number;
    facturacion: number;
  }>(`
    SELECT
      dia_semana,
      CAST(SUBSTR(hora, 1, 2) AS INTEGER) as hora_num,
      COUNT(*) as tickets,
      ROUND(COALESCE(SUM(ABS(imp_neto)), 0), 2) as facturacion
    FROM ventas
    WHERE tipo IN ('Contado', 'Credito')
      AND UPPER(SUBSTR(num_doc, 1, 1)) != 'W'
      AND (rp IS NULL OR rp != 'Anulada')
      AND es_cabecera = 1
      AND hora IS NOT NULL
      AND dia_semana BETWEEN 1 AND 6
      AND fecha >= ? AND fecha <= ?
    GROUP BY dia_semana, hora_num
    ORDER BY dia_semana, hora_num
  `, [desde, hasta]);
}

/* ── Segmentación: una sola query CTE → 3 dimensiones sin viajes extra a Turso ── */
export async function getCrmSegmentacion(desde: string, hasta: string) {
  // Calcular todo en una pasada por num_doc
  const rows = await query<{
    tipo: string;
    tipo_pago: string;
    es_receta_flag: number;
    tickets: number;
    facturacion: number;
  }>(`
    WITH base AS (
      SELECT
        tipo,
        COALESCE(tipo_pago, 'Otros')                AS tipo_pago,
        MAX(CASE WHEN es_receta = 1 THEN 1 ELSE 0 END) AS tiene_receta,
        num_doc,
        SUM(pvp * unidades) AS total
      FROM ventas
      WHERE ${BASE_WHERE} AND fecha >= ? AND fecha <= ?
      GROUP BY num_doc, tipo, tipo_pago
    )
    SELECT tipo, tipo_pago,
           MAX(tiene_receta) AS es_receta_flag,
           COUNT(DISTINCT num_doc) AS tickets,
           ROUND(COALESCE(SUM(total), 0), 2) AS facturacion
    FROM base
    GROUP BY tipo, tipo_pago
    ORDER BY facturacion DESC
  `, [desde, hasta]);

  // Agregar en JS (evita más queries a Turso)
  const tipoMap = new Map<string, { tickets: number; facturacion: number }>();
  const pagoMap = new Map<string, { tickets: number; facturacion: number }>();
  const recetaMap = new Map<number, { tickets: number; facturacion: number }>();

  for (const r of rows) {
    // byTipo
    const t = tipoMap.get(r.tipo) ?? { tickets: 0, facturacion: 0 };
    tipoMap.set(r.tipo, { tickets: t.tickets + r.tickets, facturacion: t.facturacion + r.facturacion });
    // byPago
    const p = pagoMap.get(r.tipo_pago) ?? { tickets: 0, facturacion: 0 };
    pagoMap.set(r.tipo_pago, { tickets: p.tickets + r.tickets, facturacion: p.facturacion + r.facturacion });
    // byReceta (flag 0 o 1)
    const flag = r.es_receta_flag;
    const rx = recetaMap.get(flag) ?? { tickets: 0, facturacion: 0 };
    recetaMap.set(flag, { tickets: rx.tickets + r.tickets, facturacion: rx.facturacion + r.facturacion });
  }

  const byTipo = [...tipoMap.entries()]
    .map(([tipo, v]) => ({ tipo, ...v }))
    .sort((a, b) => b.facturacion - a.facturacion);

  const byPago = [...pagoMap.entries()]
    .map(([tipo_pago, v]) => ({ tipo_pago, ...v }))
    .sort((a, b) => b.facturacion - a.facturacion)
    .slice(0, 8);

  const byReceta = [...recetaMap.entries()]
    .map(([flag, v]) => ({ tipo: flag === 1 ? "Receta" : "Venta libre", ...v }))
    .sort((a, b) => b.facturacion - a.facturacion);

  return { byTipo, byPago, byReceta };
}
