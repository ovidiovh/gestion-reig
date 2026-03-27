"use client";

import { useEffect, useState } from "react";

export interface FilterState {
  desde: string;
  hasta: string;
  vendedor: string;
  tipoVenta: string;
  tipoPago: string;
  franjaHoraria: string;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const [vendedores, setVendedores] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/filtros")
      .then((r) => r.json())
      .then((d) => {
        setVendedores(d.vendedores || []);
        if (d.rango && !filters.desde) {
          // Default: último mes completo
          const hasta = d.rango.max;
          const desdeDate = new Date(hasta);
          desdeDate.setMonth(desdeDate.getMonth() - 1);
          desdeDate.setDate(1);
          onChange({
            ...filters,
            desde: desdeDate.toISOString().slice(0, 10),
            hasta,
          });
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputStyle = {
    borderColor: "#d1d5db",
    color: "#2a2e2b",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.8125rem",
  };

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "#5a615c" }}>
          Desde
        </label>
        <input
          type="date"
          value={filters.desde}
          onChange={(e) => onChange({ ...filters, desde: e.target.value })}
          className="px-3 py-2 rounded-lg border"
          style={inputStyle}
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "#5a615c" }}>
          Hasta
        </label>
        <input
          type="date"
          value={filters.hasta}
          onChange={(e) => onChange({ ...filters, hasta: e.target.value })}
          className="px-3 py-2 rounded-lg border"
          style={inputStyle}
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "#5a615c" }}>
          Vendedor
        </label>
        <select
          value={filters.vendedor}
          onChange={(e) => onChange({ ...filters, vendedor: e.target.value })}
          className="px-3 py-2 rounded-lg border"
          style={inputStyle}
        >
          <option value="">Todos</option>
          {vendedores.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "#5a615c" }}>
          Tipo venta
        </label>
        <select
          value={filters.tipoVenta}
          onChange={(e) => onChange({ ...filters, tipoVenta: e.target.value })}
          className="px-3 py-2 rounded-lg border"
          style={inputStyle}
        >
          <option value="">Todas</option>
          <option value="receta">Receta</option>
          <option value="libre">Libre</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "#5a615c" }}>
          Forma pago
        </label>
        <select
          value={filters.tipoPago}
          onChange={(e) => onChange({ ...filters, tipoPago: e.target.value })}
          className="px-3 py-2 rounded-lg border"
          style={inputStyle}
        >
          <option value="">Todas</option>
          <option value="Efectivo">Efectivo</option>
          <option value="Tarjeta">Tarjeta</option>
          <option value="Banco">Banco</option>
          <option value="Mixto">Mixto</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "#5a615c" }}>
          Franja
        </label>
        <select
          value={filters.franjaHoraria}
          onChange={(e) => onChange({ ...filters, franjaHoraria: e.target.value })}
          className="px-3 py-2 rounded-lg border"
          style={inputStyle}
        >
          <option value="">Todas</option>
          <option value="manana">Mañana</option>
          <option value="tarde">Tarde</option>
          <option value="guardia">Guardia</option>
        </select>
      </div>
    </div>
  );
}
