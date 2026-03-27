import { query } from "./db";

// ============================================================
// CRM QUERIES — Análisis de clientes desde tabla ventas
// ============================================================
// Los clientes de crédito tienen num_doc que empieza por C
// Los de contado por B. Otros prefijos: D, N, K, Y, Z
// Campo vendedor_nombre identifica quién vendió

const BASE_WHERE = `
  tipo IN ('Contado', 'Credito')
  AND UPPER(SUBSTR(num_doc, 1, 1)) != 'W'
  AND (rp IS NULL OR rp != 'Anulada')
  AND (descripcion NOT LIKE '%TRASPASO ENTRE CAJAS%')
  AND (descripcion NOT LIKE '%Entrega A Cuenta%')
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
