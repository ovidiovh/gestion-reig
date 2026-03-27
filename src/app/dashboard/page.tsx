"use client";

import { useState, useEffect, useCallback } from "react";
import KpiCard from "@/components/KpiCard";
import FilterBar, { FilterState } from "@/components/FilterBar";
import TimeChart from "@/components/TimeChart";
import DrillDown from "@/components/DrillDown";

interface KpiData {
  facturacion: number;
  tickets: number;
  ticketMedio: number;
  unidades: number;
  crossSellPct: number;
  ticketsReceta: number;
  ticketsCross: number;
}

interface TimePoint {
  periodo: string;
  facturacion: number;
  tickets: number;
  ticketMedio: number;
}

const eur = (v: number) =>
  v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

const num = (v: number) => v.toLocaleString("es-ES");

export default function DashboardPage() {
  const [filters, setFilters] = useState<FilterState>({
    desde: "",
    hasta: "",
    vendedor: "",
    tipoVenta: "",
    tipoPago: "",
    franjaHoraria: "",
  });

  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimePoint[]>([]);
  const [agrupacion, setAgrupacion] = useState<"mes" | "semana" | "dia">("mes");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Build query string from filters
  const buildQuery = useCallback(() => {
    const p = new URLSearchParams();
    if (filters.desde) p.set("desde", filters.desde);
    if (filters.hasta) p.set("hasta", filters.hasta);
    if (filters.vendedor) p.set("vendedor", filters.vendedor);
    if (filters.tipoVenta) p.set("tipoVenta", filters.tipoVenta);
    if (filters.tipoPago) p.set("tipoPago", filters.tipoPago);
    if (filters.franjaHoraria) p.set("franjaHoraria", filters.franjaHoraria);
    return p.toString();
  }, [filters]);

  // Fetch data whenever filters change
  useEffect(() => {
    if (!filters.desde || !filters.hasta) return;

    setLoading(true);
    const qs = buildQuery();

    Promise.all([
      fetch(`/api/kpis?${qs}`).then((r) => r.json()),
      fetch(`/api/ventas/temporal?${qs}&agrupacion=${agrupacion}`).then((r) => r.json()),
    ])
      .then(([kpiData, tsData]) => {
        setKpis(kpiData);
        setTimeSeries(tsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters, agrupacion, buildQuery]);

  // Handle bar click — drill into period
  function handleBarClick(periodo: string) {
    if (agrupacion === "mes") {
      // Switch to daily view for that month
      const [year, month] = periodo.split("-");
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      setFilters({
        ...filters,
        desde: `${year}-${month}-01`,
        hasta: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
      });
      setAgrupacion("dia");
      setSelectedDate(null);
    } else if (agrupacion === "dia") {
      setSelectedDate(periodo);
    }
  }

  // Go back to monthly view
  function resetView() {
    setAgrupacion("mes");
    setSelectedDate(null);
  }

  return (
    <div className="min-h-screen" style={{ background: "#f8faf9" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ background: "#ffffff", borderColor: "#e5e7eb" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "#1a8c3a" }}
            >
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                <path d="M16 4v24M4 16h24" stroke="white" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold" style={{ fontFamily: "'DM Serif Display', serif", color: "#2a2e2b" }}>
                ReigBI
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {agrupacion !== "mes" && (
              <button
                onClick={resetView}
                className="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50 transition-colors"
                style={{ borderColor: "#d1d5db", color: "#5a615c" }}
              >
                Vista mensual
              </button>
            )}
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "#d1d5db" }}>
              {(["mes", "semana", "dia"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => { setAgrupacion(a); setSelectedDate(null); }}
                  className="px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: agrupacion === a ? "#1a8c3a" : "transparent",
                    color: agrupacion === a ? "white" : "#5a615c",
                  }}
                >
                  {a.charAt(0).toUpperCase() + a.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Filters */}
        <FilterBar filters={filters} onChange={setFilters} />

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Facturación" value={eur(kpis.facturacion)} />
            <KpiCard label="Tickets" value={num(kpis.tickets)} />
            <KpiCard label="Ticket medio" value={eur(kpis.ticketMedio)} />
            <KpiCard label="Unidades" value={num(kpis.unidades)} />
            <KpiCard
              label="Cross-sell"
              value={`${kpis.crossSellPct.toFixed(1)}%`}
              subtitle={`${kpis.ticketsCross} / ${kpis.ticketsReceta} receta`}
              color={kpis.crossSellPct >= 25 ? "#1a8c3a" : kpis.crossSellPct >= 20 ? "#b45309" : "#dc2626"}
            />
            <KpiCard
              label="Tickets receta"
              value={num(kpis.ticketsReceta)}
              subtitle={`${((kpis.ticketsReceta / Math.max(kpis.tickets, 1)) * 100).toFixed(1)}% del total`}
            />
          </div>
        )}

        {/* Chart */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e5e7eb" }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium" style={{ color: "#5a615c" }}>
              Facturación por {agrupacion === "mes" ? "mes" : agrupacion === "semana" ? "semana" : "día"}
              {agrupacion === "dia" ? " — click en una barra para ver vendedores" : agrupacion === "mes" ? " — click para ver días" : ""}
            </h2>
            {loading && (
              <span className="text-xs" style={{ color: "#5a615c" }}>Cargando...</span>
            )}
          </div>
          <TimeChart
            data={timeSeries}
            onBarClick={handleBarClick}
            selectedPeriodo={selectedDate || undefined}
          />
        </div>

        {/* Drill-down */}
        <DrillDown
          selectedDate={selectedDate}
          onClear={() => setSelectedDate(null)}
        />
      </main>
    </div>
  );
}
