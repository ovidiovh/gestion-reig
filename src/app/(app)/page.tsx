import Link from "next/link";

interface ModuleCard {
  title: string;
  description: string;
  href: string;
  activo: boolean;
  icon: React.ReactNode;
}

const modules: ModuleCard[] = [
  {
    title: "Nueva retirada",
    description: "Registrar retirada de efectivo de las cajas",
    href: "/retiradas",
    activo: true,
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: "Historial",
    description: "Consultar retiradas pasadas y remesas bancarias",
    href: "/retiradas/historial",
    activo: true,
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Ventas",
    description: "Dashboard de facturacion, tickets y KPIs",
    href: "/ventas",
    activo: false,
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    title: "CRM",
    description: "Gestion de clientes y segmentacion",
    href: "/crm",
    activo: true,
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Welcome header */}
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

      {/* Module cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {modules.map((mod) => {
          if (!mod.activo) {
            return (
              <div
                key={mod.href}
                className="relative bg-white rounded-xl border p-6 opacity-60 cursor-not-allowed"
                style={{ borderColor: "#e5e7eb" }}
              >
                <span
                  className="absolute top-4 right-4 text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "#f3f4f6", color: "#9ca3af" }}
                >
                  En desarrollo
                </span>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "#f3f4f6", color: "#9ca3af" }}
                >
                  {mod.icon}
                </div>
                <h2 className="text-base font-semibold mb-1" style={{ color: "#9ca3af" }}>
                  {mod.title}
                </h2>
                <p className="text-sm" style={{ color: "#9ca3af" }}>
                  {mod.description}
                </p>
              </div>
            );
          }

          return (
            <Link
              key={mod.href}
              href={mod.href}
              className="bg-white rounded-xl border p-6 transition-all hover:shadow-md hover:border-reig-green/30 group"
              style={{ borderColor: "#e5e7eb" }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors"
                style={{ background: "#e8f5ec", color: "#0C6D32" }}
              >
                {mod.icon}
              </div>
              <h2
                className="text-base font-semibold mb-1 group-hover:text-reig-green transition-colors"
                style={{ color: "#2a2e2b" }}
              >
                {mod.title}
              </h2>
              <p className="text-sm" style={{ color: "#5a615c" }}>
                {mod.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
