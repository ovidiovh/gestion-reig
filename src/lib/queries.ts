import { query } from "./db";

// ============================================================
// REGLAS DE NEGOCIO FARMACIA REIG
// ============================================================
// Facturación = Σ(PVP × Unidades) de líneas detalle
//   WHERE tipo IN ('Contado','Credito')
//   AND num_doc NOT starts with W (pagos de créditos anteriores)
//   AND rp != 'Anulada'
//   AND descripcion NOT LIKE '%TRASPASO ENTRE CAJAS%'
//   AND descripcion NOT LIKE '%Entrega A Cuenta%'
// Docs W = pagos de créditos anteriores → NO suman a facturación
// tipo IN ('Pago','Depósito') → NO son facturación
// Prefijos válidos: B (contado), C (crédito), D, N, K, Y, Z y cualquier otro que no sea W
// Cross-sell = ticket con al menos 1 receta (ta != '') Y al menos 1 libre (ta = '' or null)

const FACTURACION_WHERE = `
  tipo IN ('Contado', 'Credito')
  AND UPPER(SUBSTR(num_doc, 1, 1)) != 'W'
  AND (rp IS NULL OR rp != 'Anulada')
  AND (descripcion NOT LIKE '%TRASPASO ENTRE CAJAS%')
  AND (descripcion NOT LIKE '%Entrega A Cuenta%')
  AND es_cabecera = 0
`;

export interface Filters {
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD
  vendedor?: string;
  tipoVenta?: "receta" | "libre" | "todas";
  tipoPago?: string;
  diaSemana?: number; // 0=domingo, 1=lunes...
  franjaHoraria?: "manana" | "tarde" | "guardia";
}

function buildWhere(f: Filters): { clause: string; params: (string | number)[] } {
  const conditions: string[] = [FACTURACION_WHERE, "fecha >= ?", "fecha <= ?"];
  const params: (string | number)[] = [f.desde, f.hasta];

  if (f.vendedor) {
    conditions.push("vendedor_nombre = ?");
    params.push(f.vendedor);
  }
  if (f.tipoVenta === "receta") {
    conditions.push("es_receta = 1");
  } else if (f.tipoVenta === "libre") {
    conditions.push("es_receta = 0");
  }
  if (f.tipoPago) {
    conditions.push("tipo_pago = ?");
    params.push(f.tipoPago);
  }
  if (f.diaSemana !== undefined) {
    conditions.push("dia_semana = ?");
    params.push(f.diaSemana);
  }
  if (f.franjaHoraria === "manana") {
    conditions.push("hora >= '08:30' AND hora < '14:00'");
  } else if (f.franjaHoraria === "tarde") {
    conditions.push("hora >= '14:00' AND hora <= '20:30'");
  } else if (f.franjaHoraria === "guardia") {
    // Fuera de L-V 8:30-20:30
    conditions.push(
      "(dia_semana IN (0, 6) OR hora < '08:30' OR hora > '20:30')"
    );
  }

  return { clause: conditions.join(" AND "), params };
}

// ============================================================
// KPIs
// ============================================================
export interface KpiResult {
  facturacion: number;
  tickets: number;
  ticketMedio: number;
  unidades: number;
  crossSellPct: number;
  ticketsReceta: number;
  ticketsCross: number;
}

export async function getKpis(filters: Filters): Promise<KpiResult> {
  const { clause, params } = buildWhere(filters);

  // Facturación y unidades
  const [row] = await query<{
    facturacion: number;
    unidades: number;
    tickets: number;
  }>(
    `SELECT
      COALESCE(SUM(pvp * unidades), 0) as facturacion,
      COALESCE(SUM(unidades), 0) as unidades,
      COUNT(DISTINCT num_doc) as tickets
    FROM ventas
    WHERE ${clause}`,
    params
  );

  // Cross-sell: tickets con receta que también tienen línea libre
  const [cs] = await query<{
    tickets_receta: number;
    tickets_cross: number;
  }>(
    `SELECT
      COUNT(DISTINCT num_doc) as tickets_receta,
      COUNT(DISTINCT CASE
        WHEN num_doc IN (
          SELECT DISTINCT num_doc FROM ventas
          WHERE ${clause} AND es_receta = 0
        ) THEN num_doc
      END) as tickets_cross
    FROM ventas
    WHERE ${clause} AND es_receta = 1`,
    [...params, ...params]
  );

  const ticketsReceta = cs?.tickets_receta || 0;
  const ticketsCross = cs?.tickets_cross || 0;
  const facturacion = row?.facturacion || 0;
  const tickets = row?.tickets || 0;

  return {
    facturacion,
    tickets,
    ticketMedio: tickets > 0 ? facturacion / tickets : 0,
    unidades: row?.unidades || 0,
    crossSellPct: ticketsReceta > 0 ? (ticketsCross / ticketsReceta) * 100 : 0,
    ticketsReceta,
    ticketsCross,
  };
}

// ============================================================
// SERIE TEMPORAL (para gráfico)
// ============================================================
export interface TimeSeriesPoint {
  periodo: string;
  facturacion: number;
  tickets: number;
  ticketMedio: number;
}

export async function getTimeSeries(
  filters: Filters,
  agrupacion: "mes" | "semana" | "dia" = "mes"
): Promise<TimeSeriesPoint[]> {
  const { clause, params } = buildWhere(filters);

  let groupExpr: string;
  if (agrupacion === "mes") {
    groupExpr = "strftime('%Y-%m', fecha)";
  } else if (agrupacion === "semana") {
    groupExpr = "strftime('%Y-W%W', fecha)";
  } else {
    groupExpr = "fecha";
  }

  return query<TimeSeriesPoint>(
    `SELECT
      ${groupExpr} as periodo,
      ROUND(COALESCE(SUM(pvp * unidades), 0), 2) as facturacion,
      COUNT(DISTINCT num_doc) as tickets,
      ROUND(COALESCE(SUM(pvp * unidades), 0) / MAX(COUNT(DISTINCT num_doc), 1), 2) as ticketMedio
    FROM ventas
    WHERE ${clause}
    GROUP BY ${groupExpr}
    ORDER BY periodo`,
    params
  );
}

// ============================================================
// DRILL-DOWN: Día → vendedores
// ============================================================
export interface VendedorDia {
  vendedor: string;
  facturacion: number;
  tickets: number;
  ticketMedio: number;
  unidades: number;
}

export async function getVendedoresDia(
  fecha: string,
  filters: Omit<Filters, "desde" | "hasta">
): Promise<VendedorDia[]> {
  const fullFilters: Filters = { ...filters, desde: fecha, hasta: fecha };
  const { clause, params } = buildWhere(fullFilters);

  return query<VendedorDia>(
    `SELECT
      COALESCE(vendedor_nombre, 'Sin asignar') as vendedor,
      ROUND(SUM(pvp * unidades), 2) as facturacion,
      COUNT(DISTINCT num_doc) as tickets,
      ROUND(SUM(pvp * unidades) / MAX(COUNT(DISTINCT num_doc), 1), 2) as ticketMedio,
      SUM(unidades) as unidades
    FROM ventas
    WHERE ${clause}
    GROUP BY vendedor_nombre
    ORDER BY facturacion DESC`,
    params
  );
}

// ============================================================
// DRILL-DOWN: Vendedor+Día → tickets
// ============================================================
export interface TicketResumen {
  numDoc: string;
  hora: string;
  lineas: number;
  facturacion: number;
  tipoPago: string;
  tieneReceta: number;
  tieneLibre: number;
}

export async function getTicketsVendedor(
  fecha: string,
  vendedor: string
): Promise<TicketResumen[]> {
  return query<TicketResumen>(
    `SELECT
      num_doc as numDoc,
      MIN(hora) as hora,
      COUNT(*) as lineas,
      ROUND(SUM(pvp * unidades), 2) as facturacion,
      MAX(tipo_pago) as tipoPago,
      MAX(es_receta) as tieneReceta,
      MAX(CASE WHEN es_receta = 0 THEN 1 ELSE 0 END) as tieneLibre
    FROM ventas
    WHERE fecha = ? AND vendedor_nombre = ? AND ${FACTURACION_WHERE}
    GROUP BY num_doc
    ORDER BY hora`,
    [fecha, vendedor]
  );
}

// ============================================================
// DRILL-DOWN: Ticket → líneas
// ============================================================
export interface LineaTicket {
  codigo: string;
  descripcion: string;
  unidades: number;
  pvp: number;
  importe: number;
  ta: string;
  esReceta: number;
}

export async function getLineasTicket(numDoc: string): Promise<LineaTicket[]> {
  return query<LineaTicket>(
    `SELECT
      COALESCE(codigo, '') as codigo,
      COALESCE(descripcion, '') as descripcion,
      unidades,
      pvp,
      ROUND(pvp * unidades, 2) as importe,
      COALESCE(ta, '') as ta,
      es_receta as esReceta
    FROM ventas
    WHERE num_doc = ? AND es_cabecera = 0
    ORDER BY id`,
    [numDoc]
  );
}

// ============================================================
// LISTAS para filtros
// ============================================================
export async function getVendedores(): Promise<string[]> {
  const rows = await query<{ v: string }>(
    `SELECT DISTINCT vendedor_nombre as v FROM ventas
     WHERE vendedor_nombre IS NOT NULL
     ORDER BY vendedor_nombre`
  );
  return rows.map((r) => r.v);
}

export async function getRangoFechas(): Promise<{ min: string; max: string }> {
  const [row] = await query<{ min: string; max: string }>(
    `SELECT MIN(fecha) as min, MAX(fecha) as max FROM ventas`
  );
  return row;
}
