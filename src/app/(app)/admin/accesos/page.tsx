"use client";

import { useState, useEffect, useCallback } from "react";

/* ───── Tipos ───── */

interface PageView {
  id: number;
  usuario_email: string;
  usuario_nombre: string;
  ruta: string;
  modulo: string;
  timestamp: string;
}

interface ResumenUsuario {
  email: string;
  nombre: string;
  totalViews: number;
  ultimaVisita: string;
  minutosEstimados: number;
  modulosFrecuentes: { modulo: string; count: number }[];
}

/* ───── Helpers ───── */

const MODULO_COLORS: Record<string, string> = {
  financiero: "#059669",
  marketing: "#7c3aed",
  rrhh: "#dc2626",
  admin: "#d97706",
  inicio: "#6b7280",
  otro: "#9ca3af",
};

function formatFecha(ts: string): string {
  const d = new Date(ts + "Z");
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFechaCorta(ts: string): string {
  const d = new Date(ts + "Z");
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
}

/**
 * Estima minutos de uso a partir de page views.
 * Cada par de views consecutivas del mismo usuario con <30min entre ellas
 * se cuenta como tiempo activo. Una vista aislada = 2 min (estimación mínima).
 */
function estimarMinutos(views: PageView[]): number {
  if (views.length === 0) return 0;
  if (views.length === 1) return 2;

  let totalMs = 0;
  const sorted = [...views].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (let i = 1; i < sorted.length; i++) {
    const diff =
      new Date(sorted[i].timestamp).getTime() -
      new Date(sorted[i - 1].timestamp).getTime();
    if (diff < 30 * 60 * 1000) {
      // Menos de 30 min entre views → tiempo activo
      totalMs += diff;
    } else {
      // Más de 30 min → sesión nueva, asignamos 2 min a la vista anterior
      totalMs += 2 * 60 * 1000;
    }
  }
  // Última vista: +2 min
  totalMs += 2 * 60 * 1000;

  return Math.round(totalMs / 60_000);
}

/* ───── Componente ───── */

export default function AccesosPage() {
  const [views, setViews] = useState<PageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"resumen" | "detalle">("resumen");

  // Filtros
  const hoy = new Date().toISOString().slice(0, 10);
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [desde, setDesde] = useState(hace30);
  const [hasta, setHasta] = useState(hoy);
  const [emailFiltro, setEmailFiltro] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      if (emailFiltro) params.set("email", emailFiltro);
      params.set("limit", "5000");

      const res = await fetch(`/api/admin/pageview?${params}`);
      const data = await res.json();
      setViews(data.rows || []);
    } catch {
      // Silencioso
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, emailFiltro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Calcular resumen por usuario
  const resumen: ResumenUsuario[] = (() => {
    const porUsuario = new Map<string, PageView[]>();
    for (const v of views) {
      if (!porUsuario.has(v.usuario_email)) porUsuario.set(v.usuario_email, []);
      porUsuario.get(v.usuario_email)!.push(v);
    }

    return Array.from(porUsuario.entries())
      .map(([email, vistas]) => {
        const modulos = new Map<string, number>();
        for (const v of vistas) {
          modulos.set(v.modulo, (modulos.get(v.modulo) || 0) + 1);
        }

        return {
          email,
          nombre: vistas[0]?.usuario_nombre || email.split("@")[0],
          totalViews: vistas.length,
          ultimaVisita: vistas[0]?.timestamp || "",
          minutosEstimados: estimarMinutos(vistas),
          modulosFrecuentes: Array.from(modulos.entries())
            .map(([modulo, count]) => ({ modulo, count }))
            .sort((a, b) => b.count - a.count),
        };
      })
      .sort((a, b) => b.minutosEstimados - a.minutosEstimados);
  })();

  // Emails únicos para el filtro
  const emailsUnicos = Array.from(new Set(views.map((v) => v.usuario_email))).sort();

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: "'DM Serif Display', serif", color: "#2a2e2b" }}
        >
          Historial de accesos
        </h1>
        <p className="text-sm mt-1" style={{ color: "#5a615c" }}>
          Page views por usuario — quien entra, que ve, cuanto tiempo pasa
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border p-4 mb-6 flex flex-wrap gap-4 items-end" style={{ borderColor: "#e5e7eb" }}>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "#5a615c" }}>Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
            style={{ borderColor: "#d1d5db" }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "#5a615c" }}>Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
            style={{ borderColor: "#d1d5db" }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "#5a615c" }}>Usuario</label>
          <select
            value={emailFiltro}
            onChange={(e) => setEmailFiltro(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
            style={{ borderColor: "#d1d5db" }}
          >
            <option value="">Todos</option>
            {emailsUnicos.map((e) => (
              <option key={e} value={e}>{e.split("@")[0]}</option>
            ))}
          </select>
        </div>
        <button
          onClick={cargar}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
          style={{ background: "#0C6D32" }}
        >
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(["resumen", "detalle"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: tab === t ? "#0C6D32" : "#f3f4f6",
              color: tab === t ? "#fff" : "#5a615c",
            }}
          >
            {t === "resumen" ? "Resumen por usuario" : "Detalle de visitas"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: "#9ca3af" }}>
          Cargando datos...
        </div>
      ) : views.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center" style={{ borderColor: "#e5e7eb" }}>
          <p className="text-sm" style={{ color: "#9ca3af" }}>
            No hay page views en el periodo seleccionado.
            {desde === hace30 && " Ejecuta la migracion en /api/admin/migrate para crear las tablas."}
          </p>
        </div>
      ) : tab === "resumen" ? (
        /* ═══ TAB RESUMEN ═══ */
        <div className="space-y-4">
          {resumen.map((u) => (
            <div
              key={u.email}
              className="bg-white rounded-xl border p-5"
              style={{ borderColor: "#e5e7eb" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: "#2a2e2b" }}>
                    {u.nombre}
                  </h3>
                  <p className="text-xs" style={{ color: "#9ca3af" }}>{u.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold" style={{ color: "#0C6D32" }}>
                    {u.minutosEstimados} min
                  </p>
                  <p className="text-xs" style={{ color: "#9ca3af" }}>
                    {u.totalViews} paginas · Ultima: {u.ultimaVisita ? formatFechaCorta(u.ultimaVisita) : "—"}
                  </p>
                </div>
              </div>

              {/* Barras de módulos */}
              <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-gray-100">
                {u.modulosFrecuentes.map((m) => (
                  <div
                    key={m.modulo}
                    title={`${m.modulo}: ${m.count} visitas`}
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(m.count / u.totalViews) * 100}%`,
                      background: MODULO_COLORS[m.modulo] || "#9ca3af",
                      minWidth: "4px",
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-3 mt-2 flex-wrap">
                {u.modulosFrecuentes.map((m) => (
                  <span key={m.modulo} className="flex items-center gap-1 text-xs" style={{ color: "#5a615c" }}>
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ background: MODULO_COLORS[m.modulo] || "#9ca3af" }}
                    />
                    {m.modulo} ({m.count})
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ═══ TAB DETALLE ═══ */
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#e5e7eb" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "#e5e7eb", background: "#f9fafb" }}>
                  <th className="text-left px-4 py-2 font-medium" style={{ color: "#5a615c" }}>Fecha</th>
                  <th className="text-left px-4 py-2 font-medium" style={{ color: "#5a615c" }}>Usuario</th>
                  <th className="text-left px-4 py-2 font-medium" style={{ color: "#5a615c" }}>Ruta</th>
                  <th className="text-left px-4 py-2 font-medium" style={{ color: "#5a615c" }}>Modulo</th>
                </tr>
              </thead>
              <tbody>
                {views.slice(0, 200).map((v) => (
                  <tr
                    key={v.id}
                    className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                    style={{ borderColor: "#f3f4f6" }}
                  >
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "#5a615c" }}>
                      {formatFecha(v.timestamp)}
                    </td>
                    <td className="px-4 py-2" style={{ color: "#2a2e2b" }}>
                      {v.usuario_nombre || v.usuario_email.split("@")[0]}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs" style={{ color: "#5a615c" }}>
                      {v.ruta}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ background: MODULO_COLORS[v.modulo] || "#9ca3af" }}
                      >
                        {v.modulo}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {views.length > 200 && (
            <div className="px-4 py-2 text-xs text-center" style={{ color: "#9ca3af", background: "#f9fafb" }}>
              Mostrando 200 de {views.length} registros. Usa los filtros para acotar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
