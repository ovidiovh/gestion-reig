import { query } from "./db";

// ============================================================
// CRM QUERIES — Análisis de clientes desde tabla ventas
// ============================================================
// Los clientes de crédito tienen num_doc que empieza por C
// Los de contado por B. Otros prefijos: D, N, K, Y, Z
// Campo vendedor_nombre identifica quién vendió

// CAB_WHERE: usa es_cabecera=1 (una fila por ticket) — idx_ventas_crm(tipo,es_cabecera,fecha)
// ABS(imp_neto) = importe neto del ticket. ~2-3s vs 15-17s con filas de detalle.
const CAB_WHERE = `tipo IN ('Contado', 'Credito') AND es_cabecera = 1`;

// DET_WHERE: para funciones que necesitan columnas de detalle (codigo, descripcion, pvp, unidades)
const DET_WHERE = `tipo IN ('Contado', 'Credito') AND es_cabecera = 0`;

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
      COUNT(*) as total_ventas,
      MIN(fecha) as fecha_min,
      MAX(fecha) as fecha_max,
      COUNT(DISTINCT vendedor_nombre) as total_vendedores
    FROM ventas
    WHERE ${CAB_WHERE}
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
      COUNT(*) as tickets,
      ROUND(COALESCE(SUM(ABS(imp_neto)), 0), 2) as facturacion,
      ROUND(COALESCE(SUM(ABS(imp_neto)), 0) / NULLIF(COUNT(*), 0), 2) as ticket_medio
    FROM ventas
    WHERE ${CAB_WHERE}
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
      COUNT(*) as tickets,
      ROUND(COALESCE(SUM(ABS(imp_neto)), 0), 2) as facturacion
    FROM ventas
    WHERE ${CAB_WHERE}
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
      COUNT(*) as tickets,
      ROUND(COALESCE(SUM(ABS(imp_neto)), 0), 2) as facturacion
    FROM ventas
    WHERE ${CAB_WHERE}
      AND hora IS NOT NULL
    GROUP BY franja
    ORDER BY MIN(CAST(SUBSTR(hora, 1, 2) AS INTEGER))
  `);
  return rows;
}

/* ── Últimas ventas (muestra reciente) — necesita detalle de producto ── */
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
    WHERE ${DET_WHERE}
    ORDER BY fecha DESC, rowid DESC
    LIMIT ?
  `, [limit]);
  return rows;
}

/* ── Top productos por unidades vendidas — necesita detalle de producto ── */
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
    WHERE ${DET_WHERE}
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

/* ── KPIs resumen — usa cabecera (1 fila por ticket) → ~2-3s ── */
export async function getCrmResumen(desde: string, hasta: string) {
  const [row] = await query<{
    facturacion: number;
    tickets: number;
    ticket_medio: number;
  }>(`
    SELECT
      ROUND(COALESCE(SUM(ABS(imp_neto)), 0), 2) AS facturacion,
      COUNT(*) AS tickets,
      ROUND(COALESCE(SUM(ABS(imp_neto)), 0) / NULLIF(COUNT(*), 0), 2) AS ticket_medio
    FROM ventas
    WHERE ${CAB_WHERE} AND fecha >= ? AND fecha <= ?
  `, [desde, hasta]);

  return {
    facturacion:    Number(row?.facturacion    || 0),
    tickets:        Number(row?.tickets        || 0),
    ticket_medio:   Number(row?.ticket_medio   || 0),
    unidades:       0,
    pct_receta:     0,
    tickets_receta: 0,
    tickets_cross:  0,
    pct_cross:      0,
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
      ROUND(COALESCE(SUM(ABS(imp_neto)), 0), 2) as facturacion,
      COUNT(*) as tickets,
      ROUND(COALESCE(SUM(ABS(imp_neto)), 0) / NULLIF(COUNT(*), 0), 2) as ticket_medio
    FROM ventas
    WHERE ${CAB_WHERE} AND fecha >= ? AND fecha <= ?
    GROUP BY strftime('%Y-%m', fecha)
    ORDER BY mes
  `, [desde, hasta]);
}

/* ── Comparativa YoY: 2024-2026 mes a mes ── */
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
      ROUND(COALESCE(SUM(ABS(imp_neto)), 0), 2) as facturacion,
      COUNT(*) as tickets
    FROM ventas
    WHERE ${CAB_WHERE}
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
      COUNT(*) as tickets,
      ROUND(COALESCE(SUM(ABS(imp_neto)), 0), 2) as facturacion,
      ROUND(COALESCE(SUM(ABS(imp_neto)), 0) / NULLIF(COUNT(*), 0), 2) as ticket_medio,
      0 as unidades,
      0.0 as pct_receta
    FROM ventas
    WHERE ${CAB_WHERE} AND fecha >= ? AND fecha <= ?
      AND vendedor_nombre IS NOT NULL AND vendedor_nombre != ''
    GROUP BY vendedor_nombre
    ORDER BY facturacion DESC
  `, [desde, hasta]);
}

/* ── Top productos por facturación o unidades — necesita detalle ── */
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
    WHERE ${DET_WHERE} AND fecha >= ? AND fecha <= ?
      AND codigo IS NOT NULL AND codigo != ''
      AND descripcion IS NOT NULL AND descripcion != ''
    GROUP BY codigo, descripcion
    ORDER BY ${order}
    LIMIT ?
  `, [desde, hasta, limit]);
}

/* ── Cronograma: tickets por día de semana × hora — simplificado sin rp ni UPPER ── */
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
    WHERE ${CAB_WHERE}
      AND hora IS NOT NULL
      AND dia_semana BETWEEN 1 AND 6
      AND fecha >= ? AND fecha <= ?
    GROUP BY dia_semana, hora_num
    ORDER BY dia_semana, hora_num
  `, [desde, hasta]);
}

/* ── Segmentación por tipo, pago — una sola pasada con CAB ── */
export async function getCrmSegmentacion(desde: string, hasta: string) {
  const rows = await query<{
    tipo: string;
    tipo_pago: string;
    es_receta_flag: number;
    tickets: number;
    facturacion: number;
  }>(`
    SELECT
      tipo,
      COALESCE(tipo_pago, 'Otros') AS tipo_pago,
      0 AS es_receta_flag,
      COUNT(*) AS tickets,
      ROUND(COALESCE(SUM(ABS(imp_neto)), 0), 2) AS facturacion
    FROM ventas
    WHERE ${CAB_WHERE} AND fecha >= ? AND fecha <= ?
    GROUP BY tipo, tipo_pago
    ORDER BY facturacion DESC
  `, [desde, hasta]);

  const tipoMap = new Map<string, { tickets: number; facturacion: number }>();
  const pagoMap = new Map<string, { tickets: number; facturacion: number }>();

  for (const r of rows) {
    const t = tipoMap.get(r.tipo) ?? { tickets: 0, facturacion: 0 };
    tipoMap.set(r.tipo, { tickets: t.tickets + r.tickets, facturacion: t.facturacion + r.facturacion });
    const p = pagoMap.get(r.tipo_pago) ?? { tickets: 0, facturacion: 0 };
    pagoMap.set(r.tipo_pago, { tickets: p.tickets + r.tickets, facturacion: p.facturacion + r.facturacion });
  }

  const byTipo = [...tipoMap.entries()]
    .map(([tipo, v]) => ({ tipo, ...v }))
    .sort((a, b) => b.facturacion - a.facturacion);

  const byPago = [...pagoMap.entries()]
    .map(([tipo_pago, v]) => ({ tipo_pago, ...v }))
    .sort((a, b) => b.facturacion - a.facturacion)
    .slice(0, 8);

  // byReceta no disponible con cabecera rows — retorna vacío para compatibilidad
  const byReceta = [
    { tipo: "Venta libre", tickets: 0, facturacion: 0 },
  ];

  return { byTipo, byPago, byReceta };
}
