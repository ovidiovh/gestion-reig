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

const DESTINO_LABELS: Record<string, string> = {
  caja_fuerte: "Caja fuerte",
  entrega_bea: "Entrega a Bea",
  banco: "Banco",
};

const DESTINO_COLORS: Record<string, string> = {
  caja_fuerte: "bg-amber-100 text-amber-700",
  entrega_bea: "bg-purple-100 text-purple-700",
  banco: "bg-blue-100 text-blue-700",
};

function getFechaDesde(filtro: Filtro): string {
  const d = new Date();
  switch (filtro) {
    case "hoy":
      return d.toISOString().slice(0, 10);
    case "semana": {
      const dia = d.getDay();
      const diff = dia === 0 ? 6 : dia - 1;
      d.setDate(d.getDate() - diff);
      return d.toISOString().slice(0, 10);
    }
    case "mes":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    case "todo":
      return "2000-01-01";
  }
}

function esBloqueado(destino: string) {
  return destino === "banco" || destino === "entrega_bea";
}

export default function HistorialPage() {
  const [filtro, setFiltro] = useState<Filtro>("semana");
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [updating, setUpdating] = useState(false);

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
    setSelected(new Set());
  }, [cargar]);

  const totalPeriodo = sesiones.reduce((s, r) => s + (r.total_cajas || 0), 0);

  // Sesiones editables (en caja_fuerte)
  const editables = sesiones.filter((s) => s.destino === "caja_fuerte");

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllEditables = () => {
    if (selected.size === editables.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(editables.map((s) => s.id)));
    }
  };

  const cambiarDestino = async (destino: "entrega_bea" | "banco") => {
    if (selected.size === 0) return;
    setUpdating(true);
    try {
      const ids = Array.from(selected);
      for (const id of ids) {
        await fetch("/api/retiradas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, destino }),
        });
      }
      setSelected(new Set());
      await cargar();
    } catch (err) {
      console.error("Error actualizando destino:", err);
    } finally {
      setUpdating(false);
    }
  };

  const cambiarDestinoUno = async (id: number, destino: string) => {
    setUpdating(true);
    try {
      await fetch("/api/retiradas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, destino }),
      });
      await cargar();
    } catch (err) {
      console.error("Error actualizando destino:", err);
    } finally {
      setUpdating(false);
    }
  };

  const totalSelected = sesiones
    .filter((s) => selected.has(s.id))
    .reduce((sum, s) => sum + (s.total_cajas || 0), 0);

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

      {/* Barra de acciones para selección múltiple */}
      {editables.length > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-gray-50 rounded-lg px-4 py-3">
          <button
            onClick={selectAllEditables}
            className="text-sm text-reig-green underline"
          >
            {selected.size === editables.length ? "Deseleccionar" : "Seleccionar"} pendientes
          </button>
          {selected.size > 0 && (
            <>
              <span className="text-sm text-gray-500">
                {selected.size} sel. · {totalSelected.toFixed(2)} €
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  disabled={updating}
                  onClick={() => cambiarDestino("entrega_bea")}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  Entrega a Bea
                </button>
                <button
                  disabled={updating}
                  onClick={() => cambiarDestino("banco")}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Al banco
                </button>
              </div>
            </>
          )}
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
          {sesiones.map((s) => {
            const bloqueado = esBloqueado(s.destino);
            const isSelected = selected.has(s.id);

            return (
              <div
                key={s.id}
                onClick={() => !bloqueado && toggleSelect(s.id)}
                className={`flex items-center justify-between rounded-lg px-4 py-3 transition-all ${
                  bloqueado
                    ? "bg-gray-100 opacity-80"
                    : isSelected
                    ? "bg-reig-green-light ring-2 ring-reig-green cursor-pointer"
                    : "bg-gray-50 hover:bg-gray-100 cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox solo para editables */}
                  {!bloqueado && (
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? "bg-reig-green border-reig-green text-white"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && <span className="text-xs">✓</span>}
                    </div>
                  )}
                  {bloqueado && <div className="w-5 h-5 flex items-center justify-center text-gray-400">🔒</div>}

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
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Badge destino */}
                  {!bloqueado ? (
                    <select
                      value={s.destino}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => cambiarDestinoUno(s.id, e.target.value)}
                      disabled={updating}
                      className="text-xs rounded px-2 py-1 bg-amber-100 text-amber-700 border-0 font-medium cursor-pointer"
                    >
                      <option value="caja_fuerte">Caja fuerte</option>
                      <option value="entrega_bea">Entrega a Bea</option>
                      <option value="banco">Banco</option>
                    </select>
                  ) : (
                    <span
                      className={`text-xs rounded px-2 py-1 font-medium ${
                        DESTINO_COLORS[s.destino] || ""
                      }`}
                    >
                      {DESTINO_LABELS[s.destino] || s.destino}
                    </span>
                  )}

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
            );
          })}
        </div>
      )}
    </div>
  );
}
