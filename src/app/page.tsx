import Link from "next/link";

const modules = [
  {
    name: "Retiradas de Caja",
    href: "/retiradas",
    description: "Registro de retiradas de efectivo por caja",
    icon: "💶",
    ready: true,
  },
  {
    name: "Ventas",
    href: "/ventas",
    description: "Dashboard de ventas y KPIs",
    icon: "📊",
    ready: false,
  },
  {
    name: "CRM",
    href: "/crm",
    description: "Gestión de clientes y segmentación",
    icon: "👥",
    ready: false,
  },
];

export default function Home() {
  return (
    <div className="max-w-4xl">
      <h2 className="font-serif text-3xl text-reig-green mb-2">
        Gestión Farmacia Reig
      </h2>
      <p className="text-gray-500 mb-8">
        Panel de gestión interna — gestion.vidalreig.com
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((m) => (
          <div key={m.href}>
            {m.ready ? (
              <Link
                href={m.href}
                className="block p-6 rounded-xl border border-reig-green/20 hover:border-reig-green/50 hover:shadow-md transition-all"
              >
                <span className="text-2xl">{m.icon}</span>
                <h3 className="font-semibold text-lg mt-2 mb-1">{m.name}</h3>
                <p className="text-sm text-gray-500">{m.description}</p>
              </Link>
            ) : (
              <div className="p-6 rounded-xl border border-gray-200 opacity-60">
                <span className="text-2xl">{m.icon}</span>
                <h3 className="font-semibold text-lg mt-2 mb-1">{m.name}</h3>
                <p className="text-sm text-gray-500">{m.description}</p>
                <span className="inline-block mt-3 text-xs bg-gray-100 text-gray-400 px-2 py-1 rounded">
                  En desarrollo
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
