"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Sesion {
  id: number;
  fecha: string;
  created_at: string;
  usuario: string;
  destino: string;
  total_cajas: number;
  total_audit: number | null;
  auditada: number;
  num_cajas: number;
}

type Filtro = "hoy" | "semana" | "mes" | "todo";

function getFechaDesde(filtro: Filtro): string {
  const d = new Date();
  switch (filtro) {
    case "hoy":
      return d.toISOString().slice(0, 10);
    case "semana": {
      const dia = d.getDay();
      const diff = dia === 0 ? 6 : dia - 1; // lunes = inicio de semana
      d.setDate(d.getDate() - diff);
      return d.toISOString().slice(0, 10);
    }
    case "mes":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    case "todo":
      return "2000-01-01";
  }
}

export default function HistorialPage() {
  const [filtro, setFiltro] = useState<Filtro>("semana");
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const desde = getFechaDesde(filtro);
      const res = await fetch(`/api/retiradas?desde=${desde}`);
      const data = await res.json();
      if (data.ok) setSesiones(data.data);
    } catch (err) {
      console.error("Error cargando historial:", err);
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const totalPeriodo = sesiones.reduce((s, r) => s + (r.total_cajas || 0), 0);

  const filtros: { key: Filtro; label: string }[] = [
    { key: "hoy", label: "Hoy" },
    { key: "semana", label: "Semana" },
    { key: "mes", label: "Mes" },
    { key: "todo", label: "Todo" },
  ];

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-serif text-3xl text-reig-green">Historial</h2>
        <Link
          href="/retiradas"
          className="px-4 py-2 bg-reig-green text-white rounded-lg text-sm font-medium hover:bg-reig-green-dark transition-colors"
        >
          + Nueva retirada
        </Link>
      </div>
      <p className="text-gray-500 mb-6">Retiradas de efectivo registradas</p>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        {filtros.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filtro === f.key
                ? "bg-reig-green text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Total del periodo */}
      {!loading && sesiones.length > 0 && (
        <div className="flex justify-between items-center bg-reig-green-light rounded-lg px-4 py-3 mb-4">
          <span className="font-semibold text-reig-green">
            Total ({filtros.find((f) => f.key === filtro)?.label.toLowerCase()})
          </span>
          <span className="font-mono font-bold text-xl text-reig-green">
            {totalPeriodo.toFixed(2)} €
          </span>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-gray-400 text-center py-8">Cargando...</p>
      ) : sesiones.length === 0 ? (
        <p className="text-gray-400 text-center py-8">
          No hay retiradas en este periodo
        </p>
      ) : (
        <div className="space-y-2">
          {sesiones.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
            >
              <div>
                <span className="font-medium">
                  {new Date(s.fecha + "T12:00:00").toLocaleDateString("es-ES", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="text-xs text-gray-400 ml-2">
                  {s.num_cajas} caja{Number(s.num_cajas) !== 1 ? "s" : ""}
                </span>
                {s.destino === "bea" && (
                  <span className="text-xs ml-2 bg-purple-100 text-purple-600 px-2 py-0.5 rounded">
                    Bea
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold">
                  {Number(s.total_cajas).toFixed(2)} €
                </span>
                <span
                  className={`text-sm ${
                    s.auditada === 1
                      ? "text-green-600"
                      : s.auditada === -1
                      ? "text-red-600"
                      : "text-gray-400"
                  }`}
                >
                  {s.auditada === 1 ? "✓" : s.auditada === -1 ? "✗" : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
