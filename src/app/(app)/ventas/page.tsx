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

export default function VentasPage() {
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

  function handleBarClick(periodo: string) {
    if (agrupacion === "mes") {
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

  function resetView() {
    setAgrupacion("mes");
    setSelectedDate(null);
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-xl md:text-2xl font-semibold font-display"
            style={{ color: "var(--color-reig-text)" }}
          >
            Ventas
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-reig-text-secondary)" }}>
            Facturacion por {agrupacion === "mes" ? "mes" : agrupacion === "semana" ? "semana" : "dia"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {agrupacion !== "mes" && (
            <button
              onClick={resetView}
              className="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50 transition-colors"
              style={{ borderColor: "var(--color-reig-border)", color: "var(--color-reig-text-secondary)" }}
            >
              Vista mensual
            </button>
          )}
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--color-reig-border)" }}>
            {(["mes", "semana", "dia"] as const).map((a) => (
              <button
                key={a}
                onClick={() => { setAgrupacion(a); setSelectedDate(null); }}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: agrupacion === a ? "var(--color-reig-green-mid)" : "transparent",
                  color: agrupacion === a ? "white" : "var(--color-reig-text-secondary)",
                }}
              >
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Filters */}
        <FilterBar filters={filters} onChange={setFilters} />

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Facturacion" value={eur(kpis.facturacion)} />
            <KpiCard label="Tickets" value={num(kpis.tickets)} />
            <KpiCard label="Ticket medio" value={eur(kpis.ticketMedio)} />
            <KpiCard label="Unidades" value={num(kpis.unidades)} />
            <KpiCard
              label="Cross-sell"
              value={`${kpis.crossSellPct.toFixed(1)}%`}
              subtitle={`${kpis.ticketsCross} / ${kpis.ticketsReceta} receta`}
              color={kpis.crossSellPct >= 25 ? "var(--color-reig-green-mid)" : kpis.crossSellPct >= 20 ? "var(--color-reig-warn)" : "var(--color-reig-danger)"}
            />
            <KpiCard
              label="Tickets receta"
              value={num(kpis.ticketsReceta)}
              subtitle={`${((kpis.ticketsReceta / Math.max(kpis.tickets, 1)) * 100).toFixed(1)}% del total`}
            />
          </div>
        )}

        {/* Chart */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "var(--color-reig-border)" }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium" style={{ color: "var(--color-reig-text-secondary)" }}>
              {agrupacion === "dia" ? "Click en una barra para ver vendedores" : agrupacion === "mes" ? "Click para ver dias" : ""}
            </h2>
            {loading && (
              <span className="text-xs" style={{ color: "var(--color-reig-text-secondary)" }}>Cargando...</span>
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
      </div>
    </div>
  );
}
