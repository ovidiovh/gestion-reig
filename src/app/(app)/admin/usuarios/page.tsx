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

/* ───── Módulos agrupados por categoría ───── */

interface Modulo {
  key: string;
  label: string;
  descripcion: string;
}

interface Categoria {
  id: string;
  label: string;
  icono: string;
  color: string;       // color del badge / header
  bgColor: string;     // fondo suave del header
  modulos: Modulo[];
}

const CATEGORIAS: Categoria[] = [
  {
    id: "financiero",
    label: "Finanzas",
    icono: "💰",
    color: "var(--color-reig-warn)",
    bgColor: "var(--color-reig-warn-light)",
    modulos: [
      { key: "financiero_retiradas", label: "Retiradas", descripcion: "Registrar retirada de efectivo de las cajas" },
      { key: "financiero_historial", label: "Historial retiradas", descripcion: "Consultar retiradas pasadas y remesas" },
      { key: "financiero_ingresos", label: "Ingresos banco", descripcion: "Ingresos bancarios y conciliacion" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icono: "📊",
    color: "#5b21b6",
    bgColor: "#ede9fe",
    modulos: [
      { key: "marketing_crm", label: "CRM", descripcion: "Base de datos de clientes y analisis de ventas" },
      { key: "marketing_clientes", label: "Marketing / Clientes", descripcion: "Dashboard epidemiologico y segmentacion" },
    ],
  },
  {
    id: "rrhh",
    label: "RRHH",
    icono: "👥",
    color: "var(--color-reig-success)",
    bgColor: "var(--color-reig-success-light)",
    modulos: [
      { key: "rrhh_calendario", label: "Calendario", descripcion: "Planning mensual del equipo" },
      { key: "rrhh_guardias", label: "Guardias", descripcion: "Elaboracion y gestion de guardias" },
      { key: "rrhh_vacaciones", label: "Vacaciones", descripcion: "Gestion de vacaciones y ausencias" },
      { key: "rrhh_equipo", label: "Equipo", descripcion: "Gestion del personal de la farmacia" },
      { key: "rrhh_nominas", label: "Nominas", descripcion: "Generacion mensual de PDFs para la gestoria" },
    ],
  },
  {
    id: "admin",
    label: "Administracion",
    icono: "⚙️",
    color: "var(--color-reig-danger)",
    bgColor: "var(--color-reig-danger-light)",
    modulos: [
      { key: "admin_panel", label: "Administracion", descripcion: "Panel de usuarios, permisos y accesos" },
    ],
  },
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

  // Estado para alta de usuario
  const [showAlta, setShowAlta] = useState(false);
  const [nuevoUser, setNuevoUser] = useState({
    email: "",
    nombre: "",
    role: "usuario" as "admin" | "usuario",
    departamento: "farmacia" as "farmacia" | "optica" | "ambos",
  });
  const [altaCargando, setAltaCargando] = useState(false);

  const darDeAlta = async () => {
    const emailFinal = nuevoUser.email.includes("@")
      ? nuevoUser.email.toLowerCase().trim()
      : `${nuevoUser.email.toLowerCase().trim()}@farmaciareig.net`;

    if (!emailFinal || !nuevoUser.nombre.trim()) {
      setMsg({ text: "Email y nombre son obligatorios", type: "err" });
      return;
    }
    setAltaCargando(true);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...nuevoUser, email: emailFinal }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg({ text: data.msg, type: "ok" });
        setNuevoUser({ email: "", nombre: "", role: "usuario", departamento: "farmacia" });
        setShowAlta(false);
        cargar();
      } else {
        setMsg({ text: data.error || "Error al crear usuario", type: "err" });
      }
    } catch {
      setMsg({ text: "Error de red", type: "err" });
    } finally {
      setAltaCargando(false);
    }
  };

  // Estado para categorías abiertas/cerradas
  const [catAbiertas, setCatAbiertas] = useState<Record<string, boolean>>({});
  const toggleCat = (id: string) =>
    setCatAbiertas((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── Acciones en lote por categoría ──

  const concederCategoria = async (cat: Categoria, emailTarget: string) => {
    if (!emailTarget) return;
    setMsg(null);
    const modulosSinPermiso = cat.modulos.filter(
      (m) => !permisos.some((p) => p.modulo === m.key && p.email === emailTarget)
    );
    for (const m of modulosSinPermiso) {
      await conceder(m.key, emailTarget);
    }
  };

  const revocarCategoria = async (cat: Categoria, emailTarget: string) => {
    if (!emailTarget) return;
    if (!confirm(`¿Revocar TODOS los permisos de "${cat.label}" a ${emailTarget}?`)) return;
    setMsg(null);
    const modulosConPermiso = cat.modulos.filter(
      (m) => permisos.some((p) => p.modulo === m.key && p.email === emailTarget)
    );
    for (const m of modulosConPermiso) {
      // revocar individual ya hace confirm — lo bypasseamos directamente
      try {
        const res = await fetch("/api/admin/permisos", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modulo: m.key, email: emailTarget }),
        });
        await res.json();
      } catch { /* silenciar */ }
    }
    setMsg({ text: `Permisos de ${cat.label} revocados para ${emailTarget.split("@")[0]}`, type: "ok" });
    cargar();
  };

  // Estado para el select de usuario por categoría (conceder todo)
  const [catUsuario, setCatUsuario] = useState<Record<string, string>>({});

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-semibold font-display"
          style={{ color: "var(--color-reig-text)" }}
        >
          Usuarios y permisos
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-reig-text-secondary)" }}>
          Gestionar accesos, roles y whitelists de la plataforma
        </p>
      </div>

      {/* Mensaje flash */}
      {msg && (
        <div
          className="mb-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            background: msg.type === "ok" ? "var(--color-reig-success-light)" : "var(--color-reig-danger-light)",
            color: msg.type === "ok" ? "var(--color-reig-success)" : "var(--color-reig-danger)",
            border: `1px solid ${msg.type === "ok" ? "var(--color-reig-success)" : "var(--color-reig-danger)"}`,
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
              background: tab === t ? "var(--color-reig-green)" : "var(--color-reig-bg)",
              color: tab === t ? "white" : "var(--color-reig-text-secondary)",
            }}
          >
            {t === "usuarios" ? "Usuarios" : "Whitelists / Permisos"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: "var(--color-reig-text-muted)" }}>
          Cargando...
        </div>
      ) : tab === "usuarios" ? (
        /* ═══ TAB USUARIOS ═══ */
        <div className="space-y-3">
          {/* Botón + Formulario de alta */}
          {!showAlta ? (
            <button
              onClick={() => setShowAlta(true)}
              className="w-full border-2 border-dashed rounded-xl p-4 text-sm font-medium transition-colors hover:border-green-400 hover:bg-green-50"
              style={{ borderColor: "var(--color-reig-border)", color: "var(--color-reig-text-secondary)" }}
            >
              + Dar de alta nuevo usuario
            </button>
          ) : (
            <div
              className="bg-white rounded-xl border p-5"
              style={{ borderColor: "var(--color-reig-green)", borderWidth: 2 }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-reig-text)" }}>
                Alta de nuevo usuario
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-reig-text-secondary)" }}>
                    Email
                  </label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={nuevoUser.email}
                      onChange={(e) => setNuevoUser((p) => ({ ...p, email: e.target.value }))}
                      placeholder="nombre"
                      className="border rounded-l-lg px-3 py-1.5 text-sm flex-1"
                      style={{ borderColor: "var(--color-reig-border)" }}
                    />
                    <span
                      className="border border-l-0 rounded-r-lg px-2 py-1.5 text-xs"
                      style={{ borderColor: "var(--color-reig-border)", background: "var(--color-reig-bg)", color: "var(--color-reig-text-secondary)" }}
                    >
                      @farmaciareig.net
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-reig-text-secondary)" }}>
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={nuevoUser.nombre}
                    onChange={(e) => setNuevoUser((p) => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ana Garcia"
                    className="border rounded-lg px-3 py-1.5 text-sm w-full"
                    style={{ borderColor: "var(--color-reig-border)" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-reig-text-secondary)" }}>
                    Rol
                  </label>
                  <select
                    value={nuevoUser.role}
                    onChange={(e) => setNuevoUser((p) => ({ ...p, role: e.target.value as "admin" | "usuario" }))}
                    className="border rounded-lg px-3 py-1.5 text-sm w-full"
                    style={{ borderColor: "var(--color-reig-border)" }}
                  >
                    <option value="usuario">usuario</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-reig-text-secondary)" }}>
                    Departamento
                  </label>
                  <select
                    value={nuevoUser.departamento}
                    onChange={(e) => setNuevoUser((p) => ({ ...p, departamento: e.target.value as "farmacia" | "optica" | "ambos" }))}
                    className="border rounded-lg px-3 py-1.5 text-sm w-full"
                    style={{ borderColor: "var(--color-reig-border)" }}
                  >
                    <option value="farmacia">farmacia</option>
                    <option value="optica">optica</option>
                    <option value="ambos">ambos</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={darDeAlta}
                  disabled={altaCargando}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "var(--color-reig-green)" }}
                >
                  {altaCargando ? "Creando..." : "Crear usuario"}
                </button>
                <button
                  onClick={() => setShowAlta(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border"
                  style={{ borderColor: "var(--color-reig-border)", color: "var(--color-reig-text-secondary)" }}
                >
                  Cancelar
                </button>
              </div>
              <p className="text-xs mt-3" style={{ color: "var(--color-reig-text-muted)" }}>
                Una vez dado de alta, el usuario podra iniciar sesion con su cuenta Google de @farmaciareig.net.
                Recuerda asignarle permisos en la pestaña de Permisos.
              </p>
            </div>
          )}

          {usuarios.map((u) => (
            <div
              key={u.email}
              className="bg-white rounded-xl border p-5"
              style={{
                borderColor: "var(--color-reig-border)",
                opacity: u.activo ? 1 : 0.5,
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                {/* Info */}
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold" style={{ color: "var(--color-reig-text)" }}>
                      {u.nombre || u.email.split("@")[0]}
                    </h3>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: u.role === "admin" ? "var(--color-reig-warn-light)" : "var(--color-reig-bg)",
                        color: u.role === "admin" ? "var(--color-reig-warn)" : "var(--color-reig-text-secondary)",
                      }}
                    >
                      {u.role}
                    </span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: u.activo ? "var(--color-reig-success-light)" : "var(--color-reig-danger-light)",
                        color: u.activo ? "var(--color-reig-success)" : "var(--color-reig-danger)",
                      }}
                    >
                      {u.activo ? "Activo" : "Desactivado"}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--color-reig-text-muted)" }}>{u.email}</p>
                  <div className="flex gap-4 mt-2 text-xs" style={{ color: "var(--color-reig-text-secondary)" }}>
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
                    style={{ borderColor: "var(--color-reig-border)" }}
                  >
                    <option value="admin">admin</option>
                    <option value="usuario">usuario</option>
                  </select>
                  <select
                    value={u.departamento}
                    onChange={(e) => cambiarCampo(u.email, "departamento", e.target.value)}
                    className="border rounded-lg px-2 py-1 text-xs"
                    style={{ borderColor: "var(--color-reig-border)" }}
                  >
                    <option value="farmacia">farmacia</option>
                    <option value="optica">optica</option>
                    <option value="ambos">ambos</option>
                  </select>
                  <button
                    onClick={() => cambiarCampo(u.email, "activo", u.activo ? 0 : 1)}
                    className="px-3 py-1 rounded-lg text-xs font-medium text-white transition-colors"
                    style={{ background: u.activo ? "var(--color-reig-danger)" : "var(--color-reig-success)" }}
                  >
                    {u.activo ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {usuarios.length === 0 && (
            <div className="bg-white rounded-xl border p-8 text-center" style={{ borderColor: "var(--color-reig-border)" }}>
              <p className="text-sm" style={{ color: "var(--color-reig-text-muted)" }}>
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
            style={{ color: "var(--color-reig-warn)" }}
          >
            Los <strong>admins</strong> tienen acceso implicito a todo. Los permisos aqui controlan
            que secciones restringidas puede ver un usuario con rol &quot;usuario&quot;.
            Pulsa en cada categoria para desplegar sus modulos.
          </div>

          {/* Categorías colapsables */}
          {CATEGORIAS.map((cat) => {
            const abierta = !!catAbiertas[cat.id];
            // Contar permisos totales de esta categoría
            const totalPermisosCat = cat.modulos.reduce(
              (acc, m) => acc + permisos.filter((p) => p.modulo === m.key).length,
              0
            );

            return (
              <div
                key={cat.id}
                className="rounded-xl border mb-4 overflow-hidden"
                style={{ borderColor: "var(--color-reig-border)" }}
              >
                {/* Header de categoría — clickable */}
                <button
                  onClick={() => toggleCat(cat.id)}
                  className="w-full flex items-center justify-between px-5 py-4 transition-colors"
                  style={{ background: abierta ? cat.bgColor : "white" }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{cat.icono}</span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: cat.color }}
                    >
                      {cat.label}
                    </span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "var(--color-reig-bg)", color: "var(--color-reig-text-secondary)" }}
                    >
                      {cat.modulos.length} modulo{cat.modulos.length > 1 ? "s" : ""}
                    </span>
                    {totalPermisosCat > 0 && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: "var(--color-reig-success-light)", color: "var(--color-reig-success)" }}
                      >
                        {totalPermisosCat} permiso{totalPermisosCat > 1 ? "s" : ""} activo{totalPermisosCat > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <svg
                    className="transition-transform duration-200"
                    style={{
                      transform: abierta ? "rotate(180deg)" : "rotate(0deg)",
                      width: 16,
                      height: 16,
                      color: "var(--color-reig-text-muted)",
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Contenido desplegable */}
                {abierta && (
                  <div className="px-5 pb-5 pt-2 bg-white">
                    {/* Acción rápida: conceder toda la categoría a un usuario */}
                    <div
                      className="flex gap-2 items-center mb-4 p-3 rounded-lg"
                      style={{ background: "var(--color-reig-bg)", border: "1px dashed var(--color-reig-border)" }}
                    >
                      <span className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--color-reig-text-secondary)" }}>
                        Conceder toda la categoria:
                      </span>
                      <select
                        value={catUsuario[cat.id] || ""}
                        onChange={(e) => setCatUsuario((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                        className="border rounded-lg px-2 py-1 text-xs flex-1"
                        style={{ borderColor: "var(--color-reig-border)" }}
                      >
                        <option value="">Seleccionar usuario...</option>
                        {usuarios
                          .filter((u) => u.activo)
                          .map((u) => (
                            <option key={u.email} value={u.email}>
                              {u.nombre || u.email.split("@")[0]}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => {
                          if (catUsuario[cat.id]) {
                            concederCategoria(cat, catUsuario[cat.id]);
                            setCatUsuario((prev) => ({ ...prev, [cat.id]: "" }));
                          }
                        }}
                        disabled={!catUsuario[cat.id]}
                        className="px-3 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-40 whitespace-nowrap"
                        style={{ background: "var(--color-reig-green)" }}
                      >
                        Conceder todo
                      </button>
                      {catUsuario[cat.id] && (
                        <button
                          onClick={() => {
                            if (catUsuario[cat.id]) {
                              revocarCategoria(cat, catUsuario[cat.id]);
                              setCatUsuario((prev) => ({ ...prev, [cat.id]: "" }));
                            }
                          }}
                          className="px-3 py-1 rounded-lg text-xs font-medium text-white whitespace-nowrap"
                          style={{ background: "var(--color-reig-danger)" }}
                        >
                          Revocar todo
                        </button>
                      )}
                    </div>

                    {/* Módulos individuales */}
                    {cat.modulos.map((mod) => {
                      const permisosModulo = permisos.filter((p) => p.modulo === mod.key);

                      return (
                        <div
                          key={mod.key}
                          className="border rounded-lg p-4 mb-3 last:mb-0"
                          style={{ borderColor: "var(--color-reig-border)" }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-semibold" style={{ color: "var(--color-reig-text)" }}>
                              {mod.label}
                            </h4>
                            {permisosModulo.length > 0 && (
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full"
                                style={{ background: "var(--color-reig-success-light)", color: "var(--color-reig-success)" }}
                              >
                                {permisosModulo.length} usuario{permisosModulo.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          <p className="text-xs mb-3" style={{ color: "var(--color-reig-text-muted)" }}>{mod.descripcion}</p>

                          {/* Lista de emails con permiso */}
                          {permisosModulo.length > 0 && (
                            <div className="space-y-1 mb-3">
                              {permisosModulo.map((p) => (
                                <div
                                  key={`${p.modulo}-${p.email}`}
                                  className="flex items-center justify-between px-3 py-1.5 rounded-lg"
                                  style={{ background: "var(--color-reig-bg)" }}
                                >
                                  <div>
                                    <span className="text-sm font-medium" style={{ color: "var(--color-reig-text)" }}>
                                      {p.email.split("@")[0]}
                                    </span>
                                    <span className="text-xs ml-2" style={{ color: "var(--color-reig-text-muted)" }}>
                                      por {p.concedido_por.split("@")[0]} · {p.fecha ? formatFecha(p.fecha) : ""}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => revocar(p.modulo, p.email)}
                                    className="text-xs px-2 py-0.5 rounded transition-colors"
                                    style={{ color: "var(--color-reig-danger)" }}
                                  >
                                    Revocar
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Form rápido para añadir individualmente */}
                          <div className="flex gap-2 items-center">
                            <select
                              value={nuevoPermiso.modulo === mod.key ? nuevoPermiso.email : ""}
                              onChange={(e) => setNuevoPermiso({ modulo: mod.key, email: e.target.value })}
                              className="border rounded-lg px-2 py-1 text-xs flex-1"
                              style={{ borderColor: "var(--color-reig-border)" }}
                            >
                              <option value="">Añadir usuario...</option>
                              {usuarios
                                .filter((u) => u.activo && !permisosModulo.some((p) => p.email === u.email))
                                .map((u) => (
                                  <option key={u.email} value={u.email}>
                                    {u.nombre || u.email.split("@")[0]}
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
                              style={{ background: "var(--color-reig-green)" }}
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
          })}
        </div>
      )}
    </div>
  );
}
