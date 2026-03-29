"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ─── Helpers de formato ───────────────────────────────────────────────────────

const eur = (v: number) =>
  v.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }) + " €";

const eurDec = (v: number) =>
  v.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";

const num = (v: number) => v.toLocaleString("es-ES");

const pct = (v: number) => v.toFixed(1) + "%";

const MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HORAS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

// Paleta coherente con el diseño de gestion.vidalreig.com
const C = {
  verde: "#1a8c3a",
  verdeDark: "#14702e",
  verdeLight: "#e8f5ec",
  verdeMid: "#4caf6f",
  amarillo: "#f59e0b",
  rojo: "#ef4444",
  azul: "#3b82f6",
  gris: "#5a615c",
  fondo: "#f8faf9",
  borde: "#e5e7eb",
};

const COLORES_PIE = [C.verde, C.azul, C.amarillo, "#8b5cf6", "#ec4899", "#14b8a6"];
const COLORES_ANIO: Record<string, string> = {
  "2024": "#3b82f6",
  "2025": "#1a8c3a",
  "2026": "#f59e0b",
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Resumen {
  facturacion: number;
  tickets: number;
  ticket_medio: number;
  unidades: number;
  pct_receta: number;
  tickets_receta: number;
  tickets_cross: number;
  pct_cross: number;
}

interface TendenciaMes {
  mes: string;
  facturacion: number;
  tickets: number;
  ticket_medio: number;
}

interface ComparativaRow {
  anio: string;
  mes_num: string;
  facturacion: number;
  tickets: number;
}

interface Vendedor {
  vendedor: string;
  tickets: number;
  facturacion: number;
  ticket_medio: number;
  unidades: number;
  pct_receta: number;
}

interface Producto {
  codigo: string;
  descripcion: string;
  unidades: number;
  facturacion: number;
  tickets: number;
  pvp_medio: number;
}

interface CronogramaRow {
  dia_semana: number;
  hora_num: number;
  tickets: number;
  facturacion: number;
}

interface SegItem {
  tipo?: string;
  tipo_pago?: string;
  tickets: number;
  facturacion: number;
}

interface Segmentacion {
  byTipo: SegItem[];
  byPago: SegItem[];
  byReceta: SegItem[];
}

// ─── Sub-componentes de UI ────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  subtitle,
  color = C.verde,
  loading = false,
}: {
  label: string;
  value: string;
  subtitle?: string;
  color?: string;
  loading?: boolean;
}) {
  return (
    <div
      className="bg-white rounded-xl p-4 border"
      style={{ borderColor: C.borde, borderLeftWidth: 3, borderLeftColor: color }}
    >
      <p
        className="text-xs font-medium uppercase tracking-wider mb-1"
        style={{ color: C.gris }}
      >
        {label}
      </p>
      {loading ? (
        <div className="h-7 w-24 rounded animate-pulse" style={{ background: "#e5e7eb" }} />
      ) : (
        <p
          className="text-xl font-semibold"
          style={{ color, fontFamily: "'JetBrains Mono', monospace" }}
        >
          {value}
        </p>
      )}
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: C.gris }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border p-5" style={{ borderColor: C.borde }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2
            className="text-base font-semibold"
            style={{ color: "#2a2e2b", fontFamily: "'DM Serif Display', serif" }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: C.gris }}>
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Skeleton({ h = "h-48" }: { h?: string }) {
  return (
    <div className={`${h} rounded-lg animate-pulse`} style={{ background: "#f3f4f6" }} />
  );
}

// ─── Heatmap de cronograma ────────────────────────────────────────────────────

function CronogramaHeatmap({
  data,
  loading,
}: {
  data: CronogramaRow[];
  loading: boolean;
}) {
  if (loading) return <Skeleton h="h-52" />;
  if (!data.length) return <p className="text-sm text-center py-8" style={{ color: C.gris }}>Sin datos</p>;

  const maxTickets = Math.max(...data.map((d) => d.tickets), 1);

  function getCell(dia: number, hora: number): CronogramaRow | null {
    return data.find((d) => d.dia_semana === dia && d.hora_num === hora) || null;
  }

  function cellColor(tickets: number): string {
    const ratio = tickets / maxTickets;
    if (ratio === 0) return "#f9fafb";
    if (ratio < 0.15) return "#dcfce7";
    if (ratio < 0.3) return "#bbf7d0";
    if (ratio < 0.5) return "#86efac";
    if (ratio < 0.7) return "#4ade80";
    if (ratio < 0.85) return "#22c55e";
    return "#16a34a";
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: C.gris }}>
        <span>Menos</span>
        {["#f9fafb", "#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#22c55e", "#16a34a"].map((bg) => (
          <div key={bg} className="w-5 h-3 rounded-sm" style={{ background: bg, border: "1px solid #e5e7eb" }} />
        ))}
        <span>Más tickets</span>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 520 }}>
          {/* Cabecera horas */}
          <div className="flex mb-0.5">
            <div className="w-10 shrink-0" />
            {HORAS.map((h) => (
              <div
                key={h}
                className="flex-1 text-center text-xs pb-1"
                style={{ color: C.gris, fontFamily: "'JetBrains Mono', monospace" }}
              >
                {h}h
              </div>
            ))}
          </div>

          {/* Filas días */}
          {DIAS.map((dia, idx) => {
            const diaNum = idx + 1; // 1=Lun...6=Sáb
            return (
              <div key={dia} className="flex items-center gap-0.5 mb-0.5">
                <div
                  className="w-10 text-xs font-medium shrink-0"
                  style={{ color: C.gris }}
                >
                  {dia}
                </div>
                {HORAS.map((h) => {
                  const cell = getCell(diaNum, h);
                  const tickets = cell?.tickets || 0;
                  return (
                    <div
                      key={h}
                      className="flex-1 h-8 rounded-sm flex items-center justify-center cursor-default transition-transform hover:scale-110"
                      style={{
                        background: cellColor(tickets),
                        fontFamily: "'JetBrains Mono', monospace",
                        color: tickets > maxTickets * 0.5 ? "white" : "#374151",
                        fontSize: "0.65rem",
                      }}
                      title={`${dia} ${h}h: ${num(tickets)} tickets · ${eurDec(cell?.facturacion || 0)}`}
                    >
                      {tickets > 0 ? num(tickets) : ""}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tooltip personalizado para gráficos ─────────────────────────────────────

function TooltipVentas({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border p-3 text-xs" style={{ borderColor: C.borde }}>
      <p className="font-semibold mb-1" style={{ color: "#2a2e2b" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-mono">{eur(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Selector de periodo ──────────────────────────────────────────────────────

type Periodo = "2024" | "2025" | "2026" | "todo" | "custom";

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "2026", label: "2026" },
  { key: "2025", label: "2025" },
  { key: "2024", label: "2024" },
  { key: "todo", label: "Todo" },
  { key: "custom", label: "Personalizado" },
];

function periodoToRange(p: Periodo): { desde: string; hasta: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (p === "2024") return { desde: "2024-01-01", hasta: "2024-12-31" };
  if (p === "2025") return { desde: "2025-01-01", hasta: "2025-12-31" };
  if (p === "2026") return { desde: "2026-01-01", hasta: today };
  if (p === "todo") return { desde: "2024-01-01", hasta: today };
  return { desde: "", hasta: "" };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CrmPage() {
  const [periodo, setPeriodo] = useState<Periodo>("2025");
  const [customDesde, setCustomDesde] = useState("");
  const [customHasta, setCustomHasta] = useState("");
  const [productoTab, setProductoTab] = useState<"facturacion" | "unidades">("facturacion");

  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [resumenLoading, setResumenLoading] = useState(false);
  const [tendencia, setTendencia] = useState<TendenciaMes[]>([]);
  const [tendenciaLoading, setTendenciaLoading] = useState(false);
  const [comparativa, setComparativa] = useState<ComparativaRow[]>([]);
  const [comparativaLoaded, setComparativaLoaded] = useState(false);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedoresLoading, setVendedoresLoading] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productosLoading, setProductosLoading] = useState(false);
  const [cronograma, setCronograma] = useState<CronogramaRow[]>([]);
  const [cronogramaLoading, setCronogramaLoading] = useState(false);
  const [segmentacion, setSegmentacion] = useState<Segmentacion | null>(null);
  const [segmentacionLoading, setSegmentacionLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const activeRange = useCallback((): { desde: string; hasta: string } => {
    if (periodo === "custom") return { desde: customDesde, hasta: customHasta };
    return periodoToRange(periodo);
  }, [periodo, customDesde, customHasta]);

  // Helper seguro para fetch JSON
  const safeFetch = useCallback(async <T>(url: string, setter: (d: T) => void, setLoading: (v: boolean) => void) => {
    setLoading(true);
    try {
      const r = await fetch(url);
      const d = await r.json();
      if (!r.ok) {
        setFetchError(`Error ${r.status}: ${d?.error ?? url}`);
        return;
      }
      setter(d as T);
    } catch (e) {
      setFetchError(String(e));
      console.error("[crm fetch]", url, e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar datos dependientes del rango
  useEffect(() => {
    const { desde, hasta } = activeRange();
    if (!desde || !hasta) return;
    setFetchError(null);

    const qs = `desde=${desde}&hasta=${hasta}`;
    safeFetch(`/api/crm/resumen?${qs}`, setResumen, setResumenLoading);
    safeFetch(`/api/crm/tendencia?${qs}`, setTendencia, setTendenciaLoading);
    safeFetch(`/api/crm/vendedores?${qs}`, setVendedores, setVendedoresLoading);
    safeFetch(`/api/crm/cronograma?${qs}`, setCronograma, setCronogramaLoading);
    safeFetch(`/api/crm/segmentacion?${qs}`, setSegmentacion, setSegmentacionLoading);
  }, [activeRange, safeFetch]);

  // Productos: recarga también al cambiar tab
  useEffect(() => {
    const { desde, hasta } = activeRange();
    if (!desde || !hasta) return;
    const qs = `desde=${desde}&hasta=${hasta}`;
    safeFetch(`/api/crm/productos?${qs}&orderBy=${productoTab}&limit=20`, setProductos, setProductosLoading);
  }, [activeRange, productoTab, safeFetch]);

  // Comparativa YoY: carga única (datos históricos completos)
  useEffect(() => {
    if (comparativaLoaded) return;
    safeFetch("/api/crm/comparativa", (d: ComparativaRow[]) => { setComparativa(d); setComparativaLoaded(true); }, () => {});
  }, [comparativaLoaded, safeFetch]);

  // Preparar datos para gráficos
  const comparativaChartData = MESES.map((nombre, i) => {
    const mesNum = String(i + 1).padStart(2, "0");
    const row: Record<string, string | number> = { mes: nombre };
    ["2024", "2025", "2026"].forEach((anio) => {
      const found = comparativa.find((r) => r.anio === anio && r.mes_num === mesNum);
      row[anio] = found?.facturacion || 0;
    });
    return row;
  });

  const tendenciaChartData = tendencia.map((t) => ({
    label: MESES[parseInt(t.mes.slice(5), 10) - 1] + " " + t.mes.slice(0, 4),
    facturacion: t.facturacion,
    tickets: t.tickets,
    ticket_medio: t.ticket_medio,
  }));

  const vendedoresMax = vendedores[0]?.facturacion || 1;
  const { desde: rDesde, hasta: rHasta } = activeRange();

  return (
    <div className="space-y-6">

      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <h1
            className="text-2xl md:text-3xl font-semibold"
            style={{ fontFamily: "'DM Serif Display', serif", color: "#2a2e2b" }}
          >
            CRM — Análisis de Ventas
          </h1>
          <p className="text-sm mt-0.5" style={{ color: C.gris }}>
            Farmacia Reig · Vecindario, Gran Canaria
            {rDesde && rHasta && (
              <span className="ml-2 font-mono text-xs" style={{ color: C.verde }}>
                {rDesde} → {rHasta}
              </span>
            )}
          </p>
        </div>

        {/* Selector de periodo */}
        <div className="flex flex-wrap gap-1.5">
          {PERIODOS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: periodo === p.key ? C.verde : "white",
                color: periodo === p.key ? "white" : C.gris,
                border: `1px solid ${periodo === p.key ? C.verde : C.borde}`,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rango personalizado */}
      {periodo === "custom" && (
        <div
          className="flex flex-wrap items-center gap-3 bg-white rounded-xl border p-4"
          style={{ borderColor: C.borde }}
        >
          <label className="text-sm font-medium" style={{ color: C.gris }}>Desde</label>
          <input
            type="date"
            value={customDesde}
            onChange={(e) => setCustomDesde(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: C.borde }}
          />
          <label className="text-sm font-medium" style={{ color: C.gris }}>Hasta</label>
          <input
            type="date"
            value={customHasta}
            onChange={(e) => setCustomHasta(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: C.borde }}
          />
        </div>
      )}

      {/* ─── ERROR BANNER ─────────────────────────────────────────────── */}
      {fetchError && (
        <div className="rounded-lg p-3 text-sm flex items-start gap-2" style={{ background: "#fef2f2", color: "#c0392b", border: "1px solid #fecaca" }}>
          <span style={{ fontWeight: 700 }}>Error al cargar datos:</span>
          <span style={{ fontFamily: "monospace", fontSize: 12 }}>{fetchError}</span>
        </div>
      )}

      {/* ─── KPI CARDS ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard
          label="Facturación"
          value={resumen ? eur(resumen.facturacion) : "—"}
          loading={resumenLoading}
        />
        <KpiCard
          label="Tickets"
          value={resumen ? num(resumen.tickets) : "—"}
          loading={resumenLoading}
        />
        <KpiCard
          label="Ticket medio"
          value={resumen ? eurDec(resumen.ticket_medio) : "—"}
          loading={resumenLoading}
        />
        <KpiCard
          label="Unidades"
          value={resumen ? num(resumen.unidades) : "—"}
          loading={resumenLoading}
        />
        <KpiCard
          label="Uds / ticket"
          value={resumen && resumen.tickets > 0
            ? (resumen.unidades / resumen.tickets).toFixed(1)
            : "—"}
          loading={resumenLoading}
        />
        <KpiCard
          label="% Receta"
          value={resumen ? pct(resumen.pct_receta) : "—"}
          subtitle="sobre facturación"
          loading={resumenLoading}
          color={resumen ? (resumen.pct_receta >= 30 ? C.azul : C.verde) : C.verde}
        />
        <KpiCard
          label="Cross-sell"
          value={resumen ? pct(resumen.pct_cross) : "—"}
          subtitle={resumen
            ? `${num(resumen.tickets_cross)} / ${num(resumen.tickets_receta)}`
            : undefined}
          loading={resumenLoading}
          color={resumen
            ? resumen.pct_cross >= 25 ? C.verde
              : resumen.pct_cross >= 20 ? C.amarillo
              : C.rojo
            : C.verde}
        />
        <KpiCard
          label="Vendedores"
          value={!vendedoresLoading && vendedores.length > 0 ? String(vendedores.length) : "—"}
          loading={vendedoresLoading}
        />
      </div>

      {/* ─── TENDENCIA MENSUAL ────────────────────────────────────────────── */}
      <SectionCard
        title="Evolución mensual"
        subtitle={`Facturación mes a mes ${periodo !== "todo" && periodo !== "custom" ? "— " + periodo : ""}`}
        action={
          !tendenciaLoading && tendencia.length > 0 ? (
            <span
              className="text-xs px-2 py-1 rounded-full font-mono"
              style={{ background: C.verdeLight, color: C.verdeDark }}
            >
              {tendencia.length} meses
            </span>
          ) : undefined
        }
      >
        {tendenciaLoading ? (
          <Skeleton h="h-64" />
        ) : tendenciaChartData.length === 0 ? (
          <p className="text-sm text-center py-12" style={{ color: C.gris }}>
            Sin datos para el periodo seleccionado
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={tendenciaChartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: C.gris }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: C.gris, fontFamily: "'JetBrains Mono', monospace" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as typeof tendenciaChartData[0];
                  return (
                    <div
                      className="bg-white rounded-lg shadow-lg border p-3 text-xs"
                      style={{ borderColor: C.borde }}
                    >
                      <p className="font-semibold mb-1.5" style={{ color: "#2a2e2b" }}>{label}</p>
                      <p style={{ color: C.verde }}>
                        Facturación: <span className="font-mono font-bold">{eur(d.facturacion)}</span>
                      </p>
                      <p style={{ color: C.azul }}>
                        Tickets: <span className="font-mono">{num(d.tickets)}</span>
                      </p>
                      <p style={{ color: C.gris }}>
                        Ticket medio: <span className="font-mono">{eurDec(d.ticket_medio)}</span>
                      </p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="facturacion"
                stroke={C.verde}
                strokeWidth={2.5}
                dot={{ fill: C.verde, r: 3 }}
                activeDot={{ r: 5 }}
                name="Facturación"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* ─── COMPARATIVA YoY ─────────────────────────────────────────────── */}
      <SectionCard
        title="Comparativa anual"
        subtitle="Facturación mes a mes · 2024 vs 2025 vs 2026"
      >
        {!comparativaLoaded ? (
          <Skeleton h="h-64" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={comparativaChartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 10, fill: C.gris }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: C.gris, fontFamily: "'JetBrains Mono', monospace" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<TooltipVentas />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {(["2024", "2025", "2026"] as const).map((anio) => (
                <Bar
                  key={anio}
                  dataKey={anio}
                  name={anio}
                  fill={COLORES_ANIO[anio]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={24}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* ─── VENDEDORES + SEGMENTACIÓN ───────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Ranking vendedores */}
        <SectionCard
          title="Ranking vendedores"
          subtitle="Ordenado por facturación en el periodo"
        >
          {vendedoresLoading ? (
            <Skeleton h="h-64" />
          ) : vendedores.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: C.gris }}>Sin datos</p>
          ) : (
            <div className="space-y-4">
              {vendedores.map((v, i) => (
                <div key={v.vendedor}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{
                          background:
                            i === 0 ? "#f59e0b"
                            : i === 1 ? "#94a3b8"
                            : i === 2 ? "#b45309"
                            : C.gris,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium" style={{ color: "#2a2e2b" }}>
                        {v.vendedor}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold font-mono" style={{ color: C.verde }}>
                        {eur(v.facturacion)}
                      </span>
                    </div>
                  </div>
                  {/* Barra de progreso */}
                  <div className="h-1.5 rounded-full mb-1" style={{ background: "#f3f4f6" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(v.facturacion / vendedoresMax) * 100}%`,
                        background: i === 0 ? C.verde : C.verdeMid,
                      }}
                    />
                  </div>
                  <div className="flex gap-3 text-xs" style={{ color: C.gris }}>
                    <span>{num(v.tickets)} tickets</span>
                    <span>TM: <span className="font-mono">{eurDec(v.ticket_medio)}</span></span>
                    <span>Receta: <span className="font-mono">{pct(v.pct_receta)}</span></span>
                    <span className="hidden sm:inline">Uds: <span className="font-mono">{num(v.unidades)}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Segmentación */}
        <SectionCard
          title="Segmentación"
          subtitle="Distribución por tipo de venta y forma de pago"
        >
          {segmentacionLoading ? (
            <Skeleton h="h-64" />
          ) : !segmentacion ? (
            <p className="text-sm text-center py-8" style={{ color: C.gris }}>Sin datos</p>
          ) : (
            <div className="space-y-5">

              {/* Contado vs Crédito */}
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: C.gris }}
                >
                  Tipo de cliente
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {segmentacion.byTipo.map((t, i) => {
                    const total = segmentacion.byTipo.reduce((a, b) => a + b.facturacion, 0);
                    const pctVal = total > 0 ? (t.facturacion / total) * 100 : 0;
                    return (
                      <div
                        key={t.tipo}
                        className="rounded-lg p-3"
                        style={{
                          background: i === 0 ? C.verdeLight : "#eff6ff",
                          border: `1px solid ${C.borde}`,
                        }}
                      >
                        <p className="text-xs font-medium" style={{ color: C.gris }}>{t.tipo}</p>
                        <p
                          className="text-lg font-semibold font-mono mt-0.5"
                          style={{ color: COLORES_PIE[i] }}
                        >
                          {eur(t.facturacion)}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: C.gris }}>
                          {pctVal.toFixed(1)}% · {num(t.tickets)} tickets
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Receta vs Venta libre */}
              {segmentacion.byReceta.length > 0 && (
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: C.gris }}
                  >
                    Receta vs Venta libre
                  </p>
                  <div className="flex items-center gap-4">
                    <div style={{ width: 96, height: 96 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={segmentacion.byReceta}
                            dataKey="facturacion"
                            nameKey="tipo"
                            cx="50%"
                            cy="50%"
                            innerRadius={26}
                            outerRadius={42}
                            paddingAngle={3}
                          >
                            {segmentacion.byReceta.map((_, i) => (
                              <Cell key={i} fill={[C.azul, C.verde][i] ?? C.gris} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-2">
                      {segmentacion.byReceta.map((r, i) => {
                        const total = segmentacion.byReceta.reduce((a, b) => a + b.facturacion, 0);
                        const pctVal = total > 0 ? (r.facturacion / total) * 100 : 0;
                        return (
                          <div key={r.tipo} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: [C.azul, C.verde][i] ?? C.gris }}
                              />
                              <span className="text-xs" style={{ color: C.gris }}>{r.tipo}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-mono font-semibold" style={{ color: "#2a2e2b" }}>
                                {pctVal.toFixed(1)}%
                              </span>
                              <span className="text-xs font-mono ml-2" style={{ color: C.gris }}>
                                {eur(r.facturacion)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Formas de pago */}
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: C.gris }}
                >
                  Formas de pago
                </p>
                <div className="space-y-1.5">
                  {segmentacion.byPago.slice(0, 6).map((p, i) => {
                    const total = segmentacion.byPago.reduce((a, b) => a + b.facturacion, 0);
                    const pctVal = total > 0 ? (p.facturacion / total) * 100 : 0;
                    return (
                      <div key={p.tipo_pago} className="flex items-center gap-2">
                        <div className="w-20 text-xs truncate shrink-0" style={{ color: C.gris }}>
                          {p.tipo_pago}
                        </div>
                        <div className="flex-1 h-2 rounded-full" style={{ background: "#f3f4f6" }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pctVal}%`,
                              background: COLORES_PIE[i % COLORES_PIE.length],
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono w-8 text-right shrink-0" style={{ color: "#2a2e2b" }}>
                          {pctVal.toFixed(0)}%
                        </span>
                        <span className="text-xs font-mono w-20 text-right shrink-0 hidden sm:block" style={{ color: C.gris }}>
                          {eur(p.facturacion)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </SectionCard>
      </div>

      {/* ─── TOP PRODUCTOS ────────────────────────────────────────────────── */}
      <SectionCard
        title="Top productos"
        subtitle="Los 20 productos más destacados del periodo"
        action={
          <div
            className="flex rounded-lg border overflow-hidden"
            style={{ borderColor: C.borde }}
          >
            {(["facturacion", "unidades"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setProductoTab(tab)}
                className="px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  background: productoTab === tab ? C.verde : "transparent",
                  color: productoTab === tab ? "white" : C.gris,
                }}
              >
                {tab === "facturacion" ? "Por importe" : "Por unidades"}
              </button>
            ))}
          </div>
        }
      >
        {productosLoading ? (
          <Skeleton h="h-96" />
        ) : productos.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: C.gris }}>Sin datos</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["#", "Producto", "Código", "Unidades", "Importe", "Tickets", "PVP medio"].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={`py-2 px-3 text-xs font-semibold text-white ${
                          i === 0 ? "text-center rounded-tl-lg" : i === 6 ? "text-right rounded-tr-lg" : i >= 3 ? "text-right" : "text-left"
                        } ${i === 2 ? "hidden sm:table-cell" : ""} ${i >= 5 ? "hidden md:table-cell" : ""}`}
                        style={{ background: C.verde }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {productos.map((p, i) => (
                  <tr
                    key={p.codigo + i}
                    style={{
                      background: i % 2 === 0 ? "white" : C.verdeLight,
                      borderBottom: `1px solid ${C.borde}`,
                    }}
                  >
                    <td
                      className="py-2 px-3 text-xs font-mono text-center"
                      style={{ color: C.gris }}
                    >
                      {i + 1}
                    </td>
                    <td className="py-2 px-3 text-xs font-medium" style={{ color: "#2a2e2b", maxWidth: 260 }}>
                      <span className="block truncate">{p.descripcion}</span>
                    </td>
                    <td className="py-2 px-3 text-xs font-mono hidden sm:table-cell" style={{ color: C.gris }}>
                      {p.codigo}
                    </td>
                    <td className="py-2 px-3 text-xs font-mono text-right font-semibold" style={{ color: "#2a2e2b" }}>
                      {num(p.unidades)}
                    </td>
                    <td className="py-2 px-3 text-xs font-mono text-right font-semibold" style={{ color: C.verde }}>
                      {eur(p.facturacion)}
                    </td>
                    <td className="py-2 px-3 text-xs font-mono text-right hidden md:table-cell" style={{ color: C.gris }}>
                      {num(p.tickets)}
                    </td>
                    <td className="py-2 px-3 text-xs font-mono text-right hidden md:table-cell" style={{ color: C.gris }}>
                      {eurDec(p.pvp_medio)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ─── CRONOGRAMA HORARIO ───────────────────────────────────────────── */}
      <SectionCard
        title="Cronograma horario"
        subtitle="Distribución de tickets por día de la semana y franja horaria (8h–20h)"
      >
        <CronogramaHeatmap data={cronograma} loading={cronogramaLoading} />
      </SectionCard>

      {/* ─── FOOTER ──────────────────────────────────────────────────────── */}
      <div className="text-center text-xs pb-4" style={{ color: "#d1d5db" }}>
        Farmacia Reig — CRM interno · Datos actualizados desde Turso · Confidencial
      </div>
    </div>
  );
}
