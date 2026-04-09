"use client";

import { useState, useEffect, useCallback } from "react";

/* ───── Tipos ───── */

interface Usuario {
  email: string;
  nombre: string;
  role: string;
  departamento: string;
  activo: number;
  last_login: string | null;
  created_at: string | null;
  total_views: number;
  ultima_visita: string | null;
  dias_activo: number;
}

interface Permiso {
  modulo: string;
  email: string;
  concedido_por: string;
  fecha: string;
}

/* ───── Módulos con whitelist ───── */

const MODULOS_RESTRINGIDOS = [
  { key: "financiero_retiradas", label: "Retiradas", descripcion: "Registrar retirada de efectivo de las cajas" },
  { key: "financiero_historial", label: "Historial retiradas", descripcion: "Consultar retiradas pasadas y remesas" },
  { key: "financiero_ingresos", label: "Ingresos banco", descripcion: "Ingresos bancarios y conciliacion" },
  { key: "marketing_crm", label: "CRM", descripcion: "Base de datos de clientes y analisis de ventas" },
  { key: "marketing_clientes", label: "Marketing / Clientes", descripcion: "Dashboard epidemiologico y segmentacion" },
  { key: "rrhh_calendario", label: "Calendario / Guardias", descripcion: "Planning mensual, guardias y ausencias" },
  { key: "rrhh_equipo", label: "Equipo", descripcion: "Gestion del personal de la farmacia" },
  { key: "rrhh_nominas", label: "Nominas", descripcion: "Generacion mensual de PDFs para la gestoria" },
  { key: "admin_panel", label: "Administracion", descripcion: "Panel de usuarios, permisos y accesos" },
];

/* ───── Helpers ───── */

function formatFecha(ts: string | null): string {
  if (!ts) return "Nunca";
  const d = new Date(ts + (ts.includes("Z") ? "" : "Z"));
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ───── Componente ───── */

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [tab, setTab] = useState<"usuarios" | "permisos">("usuarios");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [resU, resP] = await Promise.all([
        fetch("/api/admin/usuarios"),
        fetch("/api/admin/permisos"),
      ]);
      const dataU = await resU.json();
      const dataP = await resP.json();
      setUsuarios(dataU.usuarios || []);
      setPermisos(dataP.permisos || []);
    } catch {
      setMsg({ text: "Error cargando datos", type: "err" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ── Acciones sobre usuarios ──

  const cambiarCampo = async (email: string, campo: string, valor: string | number) => {
    setMsg(null);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, campo, valor }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg({ text: `${campo} actualizado para ${email.split("@")[0]}`, type: "ok" });
        cargar();
      } else {
        setMsg({ text: data.error || "Error", type: "err" });
      }
    } catch {
      setMsg({ text: "Error de red", type: "err" });
    }
  };

  // ── Acciones sobre permisos ──

  const conceder = async (modulo: string, email: string) => {
    setMsg(null);
    try {
      const res = await fetch("/api/admin/permisos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulo, email }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg({ text: `Permiso ${modulo} concedido a ${email.split("@")[0]}`, type: "ok" });
        cargar();
      } else {
        setMsg({ text: data.error || "Error", type: "err" });
      }
    } catch {
      setMsg({ text: "Error de red", type: "err" });
    }
  };

  const revocar = async (modulo: string, email: string) => {
    if (!confirm(`¿Revocar permiso "${modulo}" a ${email}?`)) return;
    setMsg(null);
    try {
      const res = await fetch("/api/admin/permisos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulo, email }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg({ text: `Permiso revocado`, type: "ok" });
        cargar();
      } else {
        setMsg({ text: data.error || "Error", type: "err" });
      }
    } catch {
      setMsg({ text: "Error de red", type: "err" });
    }
  };

  // Estado para el form de añadir permiso
  const [nuevoPermiso, setNuevoPermiso] = useState({ modulo: "", email: "" });

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: "'DM Serif Display', serif", color: "#2a2e2b" }}
        >
          Usuarios y permisos
        </h1>
        <p className="text-sm mt-1" style={{ color: "#5a615c" }}>
          Gestionar accesos, roles y whitelists de la plataforma
        </p>
      </div>

      {/* Mensaje flash */}
      {msg && (
        <div
          className="mb-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            background: msg.type === "ok" ? "#ecfdf5" : "#fef2f2",
            color: msg.type === "ok" ? "#065f46" : "#991b1b",
            border: `1px solid ${msg.type === "ok" ? "#a7f3d0" : "#fecaca"}`,
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {(["usuarios", "permisos"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: tab === t ? "#0C6D32" : "#f3f4f6",
              color: tab === t ? "#fff" : "#5a615c",
            }}
          >
            {t === "usuarios" ? "Usuarios" : "Whitelists / Permisos"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: "#9ca3af" }}>
          Cargando...
        </div>
      ) : tab === "usuarios" ? (
        /* ═══ TAB USUARIOS ═══ */
        <div className="space-y-3">
          {usuarios.map((u) => (
            <div
              key={u.email}
              className="bg-white rounded-xl border p-5"
              style={{
                borderColor: "#e5e7eb",
                opacity: u.activo ? 1 : 0.5,
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                {/* Info */}
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold" style={{ color: "#2a2e2b" }}>
                      {u.nombre || u.email.split("@")[0]}
                    </h3>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: u.role === "admin" ? "#fef3c7" : "#f3f4f6",
                        color: u.role === "admin" ? "#92400e" : "#6b7280",
                      }}
                    >
                      {u.role}
                    </span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: u.activo ? "#ecfdf5" : "#fef2f2",
                        color: u.activo ? "#065f46" : "#991b1b",
                      }}
                    >
                      {u.activo ? "Activo" : "Desactivado"}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "#9ca3af" }}>{u.email}</p>
                  <div className="flex gap-4 mt-2 text-xs" style={{ color: "#5a615c" }}>
                    <span>Dpto: {u.departamento}</span>
                    <span>Ultimo login: {formatFecha(u.last_login)}</span>
                    <span>{u.total_views} paginas · {u.dias_activo} dias activo</span>
                  </div>
                </div>

                {/* Controles */}
                <div className="flex gap-2 items-center flex-wrap">
                  <select
                    value={u.role}
                    onChange={(e) => cambiarCampo(u.email, "role", e.target.value)}
                    className="border rounded-lg px-2 py-1 text-xs"
                    style={{ borderColor: "#d1d5db" }}
                  >
                    <option value="admin">admin</option>
                    <option value="usuario">usuario</option>
                  </select>
                  <select
                    value={u.departamento}
                    onChange={(e) => cambiarCampo(u.email, "departamento", e.target.value)}
                    className="border rounded-lg px-2 py-1 text-xs"
                    style={{ borderColor: "#d1d5db" }}
                  >
                    <option value="farmacia">farmacia</option>
                    <option value="optica">optica</option>
                    <option value="ambos">ambos</option>
                  </select>
                  <button
                    onClick={() => cambiarCampo(u.email, "activo", u.activo ? 0 : 1)}
                    className="px-3 py-1 rounded-lg text-xs font-medium text-white transition-colors"
                    style={{ background: u.activo ? "#dc2626" : "#059669" }}
                  >
                    {u.activo ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {usuarios.length === 0 && (
            <div className="bg-white rounded-xl border p-8 text-center" style={{ borderColor: "#e5e7eb" }}>
              <p className="text-sm" style={{ color: "#9ca3af" }}>
                No hay usuarios. Ejecuta la migracion en /api/admin/migrate.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ═══ TAB PERMISOS ═══ */
        <div>
          {/* Explicación */}
          <div
            className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm"
            style={{ color: "#92400e" }}
          >
            Los <strong>admins</strong> tienen acceso implicito a todo. Los permisos aqui controlan
            que secciones restringidas puede ver un usuario con rol &quot;usuario&quot;.
          </div>

          {/* Módulos con sus whitelists */}
          {MODULOS_RESTRINGIDOS.map((mod) => {
            const permisosModulo = permisos.filter((p) => p.modulo === mod.key);

            return (
              <div
                key={mod.key}
                className="bg-white rounded-xl border p-5 mb-4"
                style={{ borderColor: "#e5e7eb" }}
              >
                <h3 className="text-sm font-semibold mb-1" style={{ color: "#2a2e2b" }}>
                  {mod.label}
                </h3>
                <p className="text-xs mb-3" style={{ color: "#9ca3af" }}>{mod.descripcion}</p>

                {/* Lista de emails con permiso */}
                {permisosModulo.length > 0 ? (
                  <div className="space-y-1 mb-3">
                    {permisosModulo.map((p) => (
                      <div
                        key={`${p.modulo}-${p.email}`}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg"
                        style={{ background: "#f9fafb" }}
                      >
                        <div>
                          <span className="text-sm font-medium" style={{ color: "#2a2e2b" }}>
                            {p.email.split("@")[0]}
                          </span>
                          <span className="text-xs ml-2" style={{ color: "#9ca3af" }}>
                            por {p.concedido_por.split("@")[0]} · {p.fecha ? formatFecha(p.fecha) : ""}
                          </span>
                        </div>
                        <button
                          onClick={() => revocar(p.modulo, p.email)}
                          className="text-xs px-2 py-0.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Revocar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs mb-3" style={{ color: "#9ca3af" }}>
                    Sin permisos explicitos (solo admins tienen acceso).
                  </p>
                )}

                {/* Form rápido para añadir */}
                <div className="flex gap-2 items-center">
                  <select
                    value={nuevoPermiso.modulo === mod.key ? nuevoPermiso.email : ""}
                    onChange={(e) => setNuevoPermiso({ modulo: mod.key, email: e.target.value })}
                    className="border rounded-lg px-2 py-1 text-xs flex-1"
                    style={{ borderColor: "#d1d5db" }}
                  >
                    <option value="">Seleccionar usuario...</option>
                    {usuarios
                      .filter((u) => u.activo && !permisosModulo.some((p) => p.email === u.email))
                      .map((u) => (
                        <option key={u.email} value={u.email}>
                          {u.nombre || u.email.split("@")[0]} ({u.email})
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => {
                      if (nuevoPermiso.modulo === mod.key && nuevoPermiso.email) {
                        conceder(mod.key, nuevoPermiso.email);
                        setNuevoPermiso({ modulo: "", email: "" });
                      }
                    }}
                    disabled={nuevoPermiso.modulo !== mod.key || !nuevoPermiso.email}
                    className="px-3 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-40"
                    style={{ background: "#0C6D32" }}
                  >
                    Conceder
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
