"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useZona } from "../RetiradasZona";

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
  remesa_id: number | null;
  remesa_estado: string | null;
  remesa_confirmada_at: string | null;
  origen?: string;
}

interface CajaDetalle {
  num_caja: number;
  b200: number; b100: number; b50: number; b20: number; b10: number; b5: number;
  total: number;
}

interface AuditDetalle {
  b200: number; b100: number; b50: number; b20: number; b10: number; b5: number;
  total: number;
  cuadra: number;
}

interface Remesa {
  id: number;
  created_at: string;
  total: number;
  estado: string;
  confirmada_at: string | null;
  num_sesiones: number;
}

interface CajaFuerte {
  balance_farmacia: number;
  balance_optica: number;
  balance_total: number;
}

type Filtro = "hoy" | "semana" | "mes" | "todo";
type Vista = "retiradas" | "remesas";

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

const DENOMS = [200, 100, 50, 20, 10, 5] as const;
const UMBRAL_KEY = "reig_caja_fuerte_umbral";

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

// ── Accordion: detalle de cajas de una sesión ──
function SesionDetalle({ sesionId, accentColor }: { sesionId: number; accentColor: string }) {
  const [cajas, setCajas] = useState<CajaDetalle[]>([]);
  const [audit, setAudit] = useState<AuditDetalle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/retiradas?sesion_id=${sesionId}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();
        if (data.ok) {
          // Soporta dos formatos: {ok, cajas, audit} o {ok, data: {cajas, conteo}}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detalle: any = data.data || data;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cajasRaw: any[] = detalle.cajas || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cajasMapped: CajaDetalle[] = cajasRaw.map((c: any) => ({
            num_caja: c.num_caja ?? c.caja_num,
            b200: c.b200, b100: c.b100, b50: c.b50,
            b20: c.b20, b10: c.b10, b5: c.b5,
            total: c.total,
          }));
          setCajas(cajasMapped);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const conteoRaw: any = detalle.audit || detalle.conteo;
          if (conteoRaw) {
            setAudit({
              b200: conteoRaw.b200, b100: conteoRaw.b100, b50: conteoRaw.b50,
              b20: conteoRaw.b20, b10: conteoRaw.b10, b5: conteoRaw.b5,
              total: conteoRaw.total ?? conteoRaw.total_conteo,
              cuadra: conteoRaw.cuadra,
            });
          }
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [sesionId]);

  if (loading) return <div className="text-xs text-gray-400 py-2 pl-8">Cargando detalle...</div>;
  if (cajas.length === 0) return <div className="text-xs text-gray-400 py-2 pl-8">Sin datos de cajas</div>;

  return (
    <div className="mt-2 ml-7 sm:ml-8 space-y-1.5">
      {cajas.map((c) => (
        <div key={c.num_caja} className="bg-white border border-gray-200 rounded-lg px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold" style={{ color: accentColor }}>
              Caja {c.num_caja}
            </span>
            <span className="font-mono text-sm font-bold">{Number(c.total).toFixed(0)}€</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
            {DENOMS.map((d) => {
              const qty = c[`b${d}` as keyof CajaDetalle] as number;
              return qty > 0 ? (
                <span key={d}>
                  {d}€ <strong className="text-gray-700">×{qty}</strong>
                </span>
              ) : null;
            })}
          </div>
        </div>
      ))}

      {/* Resumen auditoría */}
      {audit && (
        <div className={`border rounded-lg px-3 py-2 text-xs ${audit.cuadra ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`font-semibold ${audit.cuadra ? "text-green-700" : "text-red-700"}`}>
              {audit.cuadra ? "✓ Auditoría OK" : "✗ Descuadre"}
            </span>
            <span className="font-mono font-bold">{Number(audit.total).toFixed(0)}€</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-gray-500">
            {DENOMS.map((d) => {
              const qty = audit[`b${d}` as keyof AuditDetalle] as number;
              return qty > 0 ? (
                <span key={d}>
                  {d}€ <strong className="text-gray-700">×{qty}</strong>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dashboard Caja Fuerte ──
function CajaFuerteDashboard({ data, zona, accentColor, accentLight }: {
  data: CajaFuerte;
  zona: string;
  accentColor: string;
  accentLight: string;
}) {
  const isFarma = zona === "farmacia";
  const balance = isFarma ? Number(data.balance_farmacia) : Number(data.balance_optica);

  // Umbral configurable — stored per zona
  const [umbral, setUmbral] = useState(5000);
  const [editingUmbral, setEditingUmbral] = useState(false);
  const [tmpUmbral, setTmpUmbral] = useState("5000");

  useEffect(() => {
    try {
      const saved = window.localStorage?.getItem(`${UMBRAL_KEY}_${zona}`);
      if (saved) { setUmbral(Number(saved)); setTmpUmbral(saved); }
    } catch { /* SSR or unavailable */ }
  }, [zona]);

  const guardarUmbral = () => {
    const val = Math.max(0, parseInt(tmpUmbral) || 0);
    setUmbral(val);
    setEditingUmbral(false);
    try { window.localStorage?.setItem(`${UMBRAL_KEY}_${zona}`, String(val)); } catch { /* */ }
  };

  const alerta = balance >= umbral && umbral > 0;

  return (
    <div
      className={`rounded-xl px-4 py-4 mb-6 border-2 ${alerta ? "border-red-300 bg-red-50" : "border-gray-200"}`}
      style={!alerta ? { background: accentLight } : {}}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-gray-600">
          Caja fuerte — {isFarma ? "Farmacia" : "Óptica"}
        </span>
        {alerta && (
          <span className="text-xs font-bold text-red-600 bg-red-100 rounded-full px-2 py-0.5 animate-pulse">
            Supera umbral
          </span>
        )}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="font-mono text-3xl font-bold" style={{ color: alerta ? "#dc2626" : accentColor }}>
            {balance.toFixed(0)} €
          </span>
          <span className="text-xs text-gray-400 ml-2">estimado pendiente</span>
        </div>
        <div className="text-right">
          {!editingUmbral ? (
            <button
              onClick={() => { setTmpUmbral(String(umbral)); setEditingUmbral(true); }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Umbral: {umbral.toLocaleString("es-ES")}€ ✎
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={tmpUmbral}
                onChange={(e) => setTmpUmbral(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && guardarUmbral()}
                className="w-20 text-xs border rounded px-1.5 py-1 text-right font-mono"
                autoFocus
              />
              <span className="text-xs text-gray-400">€</span>
              <button onClick={guardarUmbral} className="text-xs px-1.5 py-1 bg-gray-200 rounded hover:bg-gray-300">OK</button>
              <button onClick={() => setEditingUmbral(false)} className="text-xs text-gray-400">✕</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// ── Página principal historial ──
// ══════════════════════════════════════════════
export default function HistorialPage() {
  const zona = useZona();
  const isFarma = zona === "farmacia";
  const accentColor = isFarma ? "var(--color-reig-green)" : "var(--color-reig-optica)";
  const accentDark  = isFarma ? "var(--color-reig-green-dark)" : "var(--color-reig-optica-dark)";
  const accentLight = isFarma ? "var(--color-reig-green-light)" : "var(--color-reig-optica-light)";
  const [filtro, setFiltro] = useState<Filtro>("semana");
  const [vista, setVista] = useState<Vista>("retiradas");
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [remesas, setRemesas] = useState<Remesa[]>([]);
  const [cajaFuerte, setCajaFuerte] = useState<CajaFuerte>({ balance_farmacia: 0, balance_optica: 0, balance_total: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [updating, setUpdating] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const desde = getFechaDesde(filtro);
      const [resSesiones, resRemesas] = await Promise.all([
        fetch(`/api/retiradas?desde=${desde}`),
        fetch("/api/remesas"),
      ]);
      const dataSesiones = await resSesiones.json();
      const dataRemesas = await resRemesas.json();
      if (dataSesiones.ok) {
        setSesiones(dataSesiones.data.filter((s: Sesion) =>
          zona === "optica" ? s.origen === "optica" : (!s.origen || s.origen === "farmacia")
        ));
        if (dataSesiones.caja_fuerte) setCajaFuerte(dataSesiones.caja_fuerte);
      }
      if (dataRemesas.ok) setRemesas(dataRemesas.data);
    } catch (err) {
      console.error("Error cargando historial:", err);
    } finally {
      setLoading(false);
    }
  }, [filtro, zona]);

  useEffect(() => {
    cargar();
    setSelected(new Set());
    setExpanded(new Set());
  }, [cargar]);

  const totalPeriodo = sesiones.reduce((s, r) => s + (r.total_cajas || 0), 0);

  // Sesiones editables (en caja_fuerte, sin remesa)
  const editables = sesiones.filter((s) => s.destino === "caja_fuerte" && !s.remesa_id);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
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

  // Crear remesa con las sesiones seleccionadas
  const crearRemesa = async () => {
    if (selected.size === 0) return;
    setUpdating(true);
    try {
      const ids = Array.from(selected);
      const res = await fetch("/api/remesas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sesion_ids: ids }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert("Error: " + data.error);
        return;
      }
      setSelected(new Set());
      await cargar();
    } catch (err) {
      console.error("Error creando remesa:", err);
    } finally {
      setUpdating(false);
    }
  };

  // Cambiar destino individual a entrega_bea
  const entregarABea = async (id: number) => {
    setUpdating(true);
    try {
      await fetch("/api/retiradas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, destino: "entrega_bea" }),
      });
      await cargar();
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setUpdating(false);
    }
  };

  const totalSelected = sesiones
    .filter((s) => selected.has(s.id))
    .reduce((sum, s) => sum + (s.total_cajas || 0), 0);

  const remesasPendientes = remesas.filter((r) => r.estado === "pendiente");
  const remesasConfirmadas = remesas.filter((r) => r.estado === "confirmada");

  const filtros: { key: Filtro; label: string }[] = [
    { key: "hoy", label: "Hoy" },
    { key: "semana", label: "Semana" },
    { key: "mes", label: "Mes" },
    { key: "todo", label: "Todo" },
  ];

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-serif text-3xl" style={{ color: accentColor }}>
          Historial — {isFarma ? "Farmacia" : "Óptica"}
        </h2>
        <Link
          href={isFarma ? "/retiradas" : "/retiradas?zona=optica"}
          style={{ padding: "8px 16px", background: accentColor, color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 500, textDecoration: "none" }}
        >
          + Nueva retirada
        </Link>
      </div>
      <p className="text-gray-500 mb-6">
        {isFarma ? "Retiradas de efectivo — Cajas 1-10" : "Retiradas de efectivo — Óptica (Caja 11)"}
      </p>

      {/* ═══ Dashboard Caja Fuerte ═══ */}
      {!loading && (
        <CajaFuerteDashboard
          data={cajaFuerte}
          zona={zona}
          accentColor={accentColor}
          accentLight={accentLight}
        />
      )}

      {/* Tabs: Retiradas / Remesas */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setVista("retiradas")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            vista === "retiradas"
              ? "bg-white shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
          style={vista === "retiradas" ? { color: accentColor } : {}}
        >
          Retiradas
        </button>
        <button
          onClick={() => setVista("remesas")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            vista === "remesas"
              ? "bg-white shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
          style={vista === "remesas" ? { color: accentColor } : {}}
        >
          Remesas banco
          {remesasPendientes.length > 0 && (
            <span className="ml-2 bg-amber-400 text-white text-xs px-1.5 py-0.5 rounded-full">
              {remesasPendientes.length}
            </span>
          )}
        </button>
      </div>

      {/* ═══════════════ VISTA RETIRADAS ═══════════════ */}
      {vista === "retiradas" && (
        <>
          {/* Filtros */}
          <div className="flex gap-2 mb-6">
            {filtros.map((f) => (
              <button
                key={f.key}
                onClick={() => setFiltro(f.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filtro !== f.key ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : ""
                }`}
                style={filtro === f.key ? { background: accentColor, color: "#fff" } : {}}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Total del periodo */}
          {!loading && sesiones.length > 0 && (
            <div className="flex justify-between items-center rounded-lg px-4 py-3 mb-4" style={{ background: accentLight }}>
              <span className="font-semibold" style={{ color: accentColor }}>
                Total ({filtros.find((f) => f.key === filtro)?.label.toLowerCase()})
              </span>
              <span className="font-mono font-bold text-xl" style={{ color: accentColor }}>
                {totalPeriodo.toFixed(2)} €
              </span>
            </div>
          )}

          {/* Barra de acciones para selección múltiple */}
          {editables.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 bg-gray-50 rounded-lg px-3 sm:px-4 py-3">
              <button
                onClick={selectAllEditables}
                className="text-sm underline"
                style={{ color: accentColor }}
              >
                {selected.size === editables.length ? "Deseleccionar" : "Seleccionar"}
              </button>
              {selected.size > 0 && (
                <>
                  <span className="text-sm text-gray-500">
                    {selected.size} sel. · {totalSelected.toFixed(0)}€
                  </span>
                  <button
                    disabled={updating}
                    onClick={crearRemesa}
                    className="ml-auto px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Crear remesa
                  </button>
                </>
              )}
            </div>
          )}

          {/* Lista de sesiones */}
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
                const enRemesa = !!s.remesa_id;
                const remesaConfirmada = s.remesa_estado === "confirmada";
                const isExpanded = expanded.has(s.id);

                return (
                  <div key={s.id}>
                    <div
                      onClick={() => !bloqueado && !enRemesa && toggleSelect(s.id)}
                      className={`rounded-lg px-3 sm:px-4 py-3 transition-all ${
                        bloqueado || enRemesa
                          ? remesaConfirmada
                            ? "bg-green-50 opacity-90"
                            : "bg-gray-100 opacity-80"
                          : isSelected
                          ? "ring-2 cursor-pointer"
                          : "bg-gray-50 hover:bg-gray-100 cursor-pointer"
                      }`}
                      style={isSelected && !bloqueado && !enRemesa ? { background: accentLight, boxShadow: `0 0 0 2px ${accentColor}` } : {}}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          {/* Checkbox / icono estado */}
                          {!bloqueado && !enRemesa && (
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                                !isSelected ? "border-gray-300" : ""
                              }`}
                              style={isSelected ? { background: accentColor, borderColor: accentColor, color: "#fff" } : {}}
                            >
                              {isSelected && <span className="text-xs">✓</span>}
                            </div>
                          )}
                          {bloqueado && !enRemesa && (
                            <div className="w-5 h-5 flex items-center justify-center shrink-0 text-gray-400">🔒</div>
                          )}
                          {enRemesa && (
                            <div className="w-5 h-5 flex items-center justify-center shrink-0">
                              {remesaConfirmada ? (
                                <span className="text-green-600 text-sm">✓</span>
                              ) : (
                                <span className="text-amber-500 text-sm">⏳</span>
                              )}
                            </div>
                          )}

                          <div className="min-w-0">
                            <span className="font-medium text-sm sm:text-base">
                              {new Date(s.fecha + "T12:00:00").toLocaleDateString("es-ES", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                            <span className="text-xs text-gray-400 ml-1 sm:ml-2">
                              {s.num_cajas}cj
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                          {/* Badge destino */}
                          {!bloqueado && !enRemesa ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); entregarABea(s.id); }}
                              disabled={updating}
                              className="text-xs rounded px-2 py-1 bg-purple-50 text-purple-600 hover:bg-purple-100 font-medium transition-colors hidden sm:inline-block"
                            >
                              A Bea
                            </button>
                          ) : (
                            <span
                              className={`text-xs rounded px-2 py-1 font-medium ${
                                enRemesa
                                  ? remesaConfirmada
                                    ? "bg-green-100 text-green-700"
                                    : "bg-blue-100 text-blue-700"
                                  : DESTINO_COLORS[s.destino] || ""
                              }`}
                            >
                              {enRemesa
                                ? remesaConfirmada
                                  ? "Banco ✓"
                                  : "Banco ⏳"
                                : DESTINO_LABELS[s.destino] || s.destino}
                            </span>
                          )}

                          <span className="font-mono font-bold text-sm sm:text-base">
                            {Number(s.total_cajas).toFixed(0)}€
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

                          {/* Expand/collapse button */}
                          <button
                            onClick={(e) => toggleExpand(s.id, e)}
                            className="text-gray-400 hover:text-gray-600 transition-colors text-sm ml-1"
                            title="Ver detalle"
                          >
                            {isExpanded ? "▲" : "▼"}
                          </button>
                        </div>
                      </div>
                      {enRemesa && (
                        <div className="text-xs text-blue-500 mt-1 ml-7 sm:ml-8">
                          Remesa #{s.remesa_id}
                        </div>
                      )}
                    </div>

                    {/* ── Accordion: detalle cajas ── */}
                    {isExpanded && (
                      <SesionDetalle sesionId={s.id} accentColor={accentColor} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════════ VISTA REMESAS ═══════════════ */}
      {vista === "remesas" && (
        <>
          {loading ? (
            <p className="text-gray-400 text-center py-8">Cargando...</p>
          ) : remesas.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No hay remesas creadas. Selecciona retiradas y pulsa &ldquo;Crear remesa banco&rdquo;.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Pendientes */}
              {remesasPendientes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-600 mb-2 uppercase tracking-wide">
                    Pendientes de confirmación
                  </h3>
                  {remesasPendientes.map((r) => (
                    <div
                      key={r.id}
                      className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">Remesa #{r.id}</span>
                          <span className="text-xs text-gray-400 ml-2">
                            {new Date(r.created_at).toLocaleDateString("es-ES", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          <span className="text-xs text-gray-400 ml-2">
                            {r.num_sesiones} retirada{Number(r.num_sesiones) !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-lg">
                            {Number(r.total).toFixed(2)} €
                          </span>
                          <span className="text-amber-500 text-lg">⏳</span>
                        </div>
                      </div>
                      <p className="text-xs text-amber-600 mt-1">
                        Esperando email de confirmación del Santander
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Confirmadas */}
              {remesasConfirmadas.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-green-600 mb-2 uppercase tracking-wide">
                    Confirmadas
                  </h3>
                  {remesasConfirmadas.map((r) => (
                    <div
                      key={r.id}
                      className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">Remesa #{r.id}</span>
                          <span className="text-xs text-gray-400 ml-2">
                            {r.num_sesiones} retirada{Number(r.num_sesiones) !== 1 ? "s" : ""}
                          </span>
                          {r.confirmada_at && (
                            <span className="text-xs text-green-600 ml-2">
                              Confirmada{" "}
                              {new Date(r.confirmada_at).toLocaleDateString("es-ES", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-lg">
                            {Number(r.total).toFixed(2)} €
                          </span>
                          <span className="text-green-600 text-lg">✓</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
