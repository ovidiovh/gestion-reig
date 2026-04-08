"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { puedeVerMarketingClientes } from "@/lib/marketing/permisos";

/* ───── Tipos ───── */

interface SidebarProps {
  userName: string;
  userEmail?: string | null;
  userImage?: string | null;
  departamento?: "farmacia" | "optica" | "ambos";
  role?: "admin" | "usuario";
}

interface NavItem {
  label: string;
  href: string;
  activo: boolean;
  icon: React.ReactNode;
  /** Si está definido, el item solo se muestra si la función devuelve true */
  visibleSi?: (ctx: { email: string | null | undefined; role: string }) => boolean;
}

interface NavSection {
  key: string;
  title: string;
  adminOnly?: boolean;
  collapsible?: boolean;
  items: NavItem[];
}

/* ───── Colores por contexto ───── */

const THEME = {
  farmacia: "#1B5E20",
  optica:   "#1565C0",
  orto:     "#E65100",
} as const;

/* ───── Iconos SVG ───── */

const icons = {
  home: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
    </svg>
  ),
  calendar: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  cash: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  clock: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  chart: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  tag: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  cog: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  briefcase: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-9a2 2 0 012-2h2" />
    </svg>
  ),
  chevron: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  ),
};

/* ───── Secciones de navegacion ───── */

const sections: NavSection[] = [
  {
    key: "general",
    title: "GENERAL",
    collapsible: false,
    items: [
      { label: "Inicio", href: "/", activo: true, icon: icons.home },
      { label: "Horarios / Guardias", href: "/rrhh/horarios", activo: true, icon: icons.calendar },
    ],
  },
  {
    key: "financiero",
    title: "FINANCIERO",
    collapsible: true,
    items: [
      { label: "Nueva retirada", href: "/retiradas", activo: true, icon: icons.cash },
      { label: "Historial", href: "/retiradas/historial", activo: true, icon: icons.clock },
      { label: "Ingresos banco", href: "/ingresos", activo: true, icon: icons.briefcase },
      { label: "Ventas", href: "/ventas", activo: false, icon: icons.chart },
    ],
  },
  {
    key: "marketing",
    title: "MARKETING",
    collapsible: true,
    items: [
      { label: "CRM", href: "/crm", activo: true, icon: icons.users },
      {
        label: "Clientes",
        href: "/marketing/clientes",
        activo: true,
        icon: icons.chart,
        visibleSi: ({ email }) => puedeVerMarketingClientes(email),
      },
      { label: "Fichas producto", href: "/fichas", activo: false, icon: icons.tag },
    ],
  },
  {
    key: "rrhh",
    title: "RRHH",
    collapsible: true,
    items: [
      { label: "Calendario, Guardia y Vacaciones", href: "/rrhh", activo: true, icon: icons.users },
      { label: "Equipo", href: "/rrhh/equipo", activo: true, icon: icons.briefcase },
      { label: "Nóminas", href: "/rrhh/nominas", activo: true, icon: icons.briefcase },
    ],
  },
  {
    key: "admin",
    title: "ADMINISTRACION",
    adminOnly: true,
    collapsible: true,
    items: [
      { label: "Usuarios", href: "/admin/usuarios", activo: false, icon: icons.cog },
    ],
  },
];

/* ───── Componente ───── */

export default function Sidebar({
  userName,
  userEmail,
  userImage,
  departamento = "farmacia",
  role = "admin",
}: SidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const bgColor = departamento === "optica" ? THEME.optica : THEME.farmacia;
  const contextLabel = departamento === "optica" ? "Optica Reig" : "Farmacia Reig";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  // Filtra los items por permiso individual (visibleSi) además del adminOnly de sección.
  const visibleSections = useMemo(() => {
    return sections
      .filter((s) => !s.adminOnly || role === "admin")
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (it) => !it.visibleSi || it.visibleSi({ email: userEmail, role })
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [userEmail, role]);

  // Auto-expand sections that contain the current active route
  const sectionHasActiveRoute = (section: NavSection) =>
    section.items.some((item) => isActive(item.href));

  // Initialize collapsed state: expanded if section has active route, collapsed otherwise
  const defaultCollapsed = useMemo(() => {
    const state: Record<string, boolean> = {};
    visibleSections.forEach((s) => {
      if (s.collapsible) {
        state[s.key] = !sectionHasActiveRoute(s);
      }
    });
    return state;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(defaultCollapsed);

  const toggleSection = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderItem = (item: NavItem) => {
    if (!item.activo) {
      return (
        <div
          key={item.href}
          className="flex items-center gap-3 px-3 py-1.5 rounded-lg cursor-not-allowed"
        >
          <span className="text-white/30">{item.icon}</span>
          <span className="text-white/30 text-sm">{item.label}</span>
          <span className="ml-auto text-[9px] bg-white/10 text-white/40 px-1.5 py-0.5 rounded">
            prox.
          </span>
        </div>
      );
    }
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors ${
          active
            ? "bg-white/20 text-white"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        }`}
      >
        <span>{item.icon}</span>
        <span className="text-sm font-medium">{item.label}</span>
      </Link>
    );
  };

  const renderSection = (section: NavSection) => {
    const isCollapsed = section.collapsible && collapsed[section.key];
    const hasActive = sectionHasActiveRoute(section);

    return (
      <div key={section.key}>
        {section.collapsible ? (
          <button
            onClick={() => toggleSection(section.key)}
            className="w-full flex items-center justify-between px-3 pb-1.5 pt-3 group"
          >
            <span
              className={`text-sm font-bold tracking-wide transition-colors ${
                hasActive ? "text-white/90" : "text-white/60 group-hover:text-white/80"
              }`}
            >
              {section.title}
            </span>
            <span
              className={`transition-transform duration-200 ${
                isCollapsed ? "-rotate-90" : ""
              } ${hasActive ? "text-white/70" : "text-white/50 group-hover:text-white/70"}`}
            >
              {icons.chevron}
            </span>
          </button>
        ) : (
          <p className="px-3 pb-1.5 pt-3 text-sm font-bold tracking-wide text-white/60">
            {section.title}
          </p>
        )}
        {!isCollapsed && (
          <div className="space-y-0.5">
            {section.items.map(renderItem)}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo / Branding */}
      <div className="px-6 py-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <path d="M16 4v24M4 16h24" stroke="white" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h1
            className="text-white text-lg font-semibold"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            Gestion Reig
          </h1>
          <p className="text-white/60 text-xs">{contextLabel}</p>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto">
        {visibleSections.map(renderSection)}
      </nav>

      {/* User info + logout */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-2">
          {userImage ? (
            <img src={userImage} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
              {userName?.charAt(0)?.toUpperCase() || "?"}
            </div>
          )}
          <span className="text-white/80 text-sm truncate">{userName}</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left px-2 py-1 text-white/50 hover:text-white/80 text-xs transition-colors"
        >
          Cerrar sesion
        </button>
      </div>

      {/* Footer */}
      <div className="px-6 py-2 border-t border-white/10">
        <p className="text-white/30 text-[10px] leading-relaxed">
          C/ Guatiza 10, 35110 Vecindario
          <br />
          928 75 72 45
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setOpen(true)}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Abrir menu"
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-base font-semibold" style={{ fontFamily: "'DM Serif Display', serif" }}>
            {contextLabel}
          </h1>
          <div className="w-8" />
        </div>
      </header>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div
            className="relative w-64 flex flex-col animate-slide-in"
            style={{ background: bgColor }}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
              aria-label="Cerrar menu"
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:w-64 md:min-h-screen md:fixed md:left-0 md:top-0"
        style={{ background: bgColor }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
