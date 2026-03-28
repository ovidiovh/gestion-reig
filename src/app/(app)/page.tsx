import Link from "next/link";

/* ───── Tipos ───── */

interface ModuleCard {
  title: string;
  description: string;
  href: string;
  activo: boolean;
  icon: React.ReactNode;
}

interface DashboardSection {
  title: string;
  items: ModuleCard[];
}

/* ───── Iconos ───── */

const icons = {
  cash: (
    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  clock: (
    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  chart: (
    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  users: (
    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  tag: (
    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  calendar: (
    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  briefcase: (
    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-9a2 2 0 012-2h2" />
    </svg>
  ),
  cog: (
    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

/* ───── Secciones (espejo del sidebar) ───── */

const sections: DashboardSection[] = [
  {
    title: "Financiero",
    items: [
      { title: "Nueva retirada", description: "Registrar retirada de efectivo de las cajas", href: "/retiradas", activo: true, icon: icons.cash },
      { title: "Historial", description: "Consultar retiradas pasadas y remesas bancarias", href: "/retiradas/historial", activo: true, icon: icons.clock },
      { title: "Ventas", description: "Dashboard de facturacion, tickets y KPIs", href: "/ventas", activo: false, icon: icons.chart },
    ],
  },
  {
    title: "Marketing",
    items: [
      { title: "CRM", description: "Base de datos de clientes y analisis de ventas", href: "/crm", activo: true, icon: icons.users },
      { title: "Fichas producto", description: "Fichas SEO para farmaciareig.net", href: "/fichas", activo: false, icon: icons.tag },
    ],
  },
  {
    title: "RRHH",
    items: [
      { title: "Horarios / Guardias", description: "Cuadrantes, turnos y guardias del equipo", href: "/rrhh/horarios", activo: true, icon: icons.calendar },
      { title: "Equipo", description: "Gestion del personal de la farmacia", href: "/rrhh/equipo", activo: true, icon: icons.briefcase },
    ],
  },
  {
    title: "Administracion",
    items: [
      { title: "Usuarios", description: "Gestionar accesos y roles de la plataforma", href: "/admin/usuarios", activo: false, icon: icons.cog },
    ],
  },
];

/* ───── Componente ───── */

export default function HomePage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl md:text-3xl font-semibold"
          style={{ fontFamily: "'DM Serif Display', serif", color: "#2a2e2b" }}
        >
          Panel de gestion
        </h1>
        <p className="text-sm mt-1" style={{ color: "#5a615c" }}>
          Selecciona un modulo para comenzar
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {sections.map((section) => (
          <div key={section.title}>
            <h2
              className="text-sm font-bold tracking-wide uppercase mb-3"
              style={{ color: "#0C6D32" }}
            >
              {section.title}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {section.items.map((mod) => {
                if (!mod.activo) {
                  return (
                    <div
                      key={mod.href}
                      className="relative bg-white rounded-xl border p-5 opacity-60 cursor-not-allowed"
                      style={{ borderColor: "#e5e7eb" }}
                    >
                      <span
                        className="absolute top-4 right-4 text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: "#f3f4f6", color: "#9ca3af" }}
                      >
                        Proximamente
                      </span>
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                        style={{ background: "#f3f4f6", color: "#9ca3af" }}
                      >
                        {mod.icon}
                      </div>
                      <h3 className="text-sm font-semibold mb-0.5" style={{ color: "#9ca3af" }}>
                        {mod.title}
                      </h3>
                      <p className="text-xs" style={{ color: "#9ca3af" }}>
                        {mod.description}
                      </p>
                    </div>
                  );
                }

                return (
                  <Link
                    key={mod.href}
                    href={mod.href}
                    className="bg-white rounded-xl border p-5 transition-all hover:shadow-md group"
                    style={{ borderColor: "#e5e7eb" }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-colors"
                      style={{ background: "#e8f5ec", color: "#0C6D32" }}
                    >
                      {mod.icon}
                    </div>
                    <h3
                      className="text-sm font-semibold mb-0.5 transition-colors"
                      style={{ color: "#2a2e2b" }}
                    >
                      {mod.title}
                    </h3>
                    <p className="text-xs" style={{ color: "#5a615c" }}>
                      {mod.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
