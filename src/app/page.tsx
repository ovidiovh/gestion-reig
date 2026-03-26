import Link from "next/link";

const modules = [
  {
    name: "Retiradas de Caja",
    href: "/retiradas",
    description: "Registro de retiradas de efectivo por caja",
    ready: false,
  },
  {
    name: "Ventas",
    href: "/ventas",
    description: "Dashboard de ventas y KPIs",
    ready: false,
  },
  {
    name: "CRM",
    href: "/crm",
    description: "Gestión de clientes y segmentación",
    ready: false,
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-reig-green text-white flex flex-col">
        <div className="p-6 border-b border-white/20">
          <h1 className="font-serif text-xl">Farmacia Reig</h1>
          <p className="text-sm text-white/70 mt-1">Panel de gestión</p>
        </div>
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {modules.map((m) => (
              <li key={m.href}>
                {m.ready ? (
                  <Link
                    href={m.href}
                    className="block px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    {m.name}
                  </Link>
                ) : (
                  <span className="block px-3 py-2 rounded-lg text-white/40 cursor-not-allowed">
                    {m.name}
                    <span className="text-xs ml-2 bg-white/10 px-2 py-0.5 rounded">
                      próx.
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-white/20 text-xs text-white/50">
          C/ Guatiza 10, Vecindario
          <br />
          928 12 20 44
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        <div className="max-w-4xl">
          <h2 className="font-serif text-3xl text-reig-green mb-2">
            Gestión Farmacia Reig
          </h2>
          <p className="text-gray-500 mb-8">
            Panel de gestión interna — gestion.vidalreig.com
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((m) => (
              <div
                key={m.href}
                className={`p-6 rounded-xl border ${
                  m.ready
                    ? "border-reig-green/20 hover:border-reig-green/50 cursor-pointer"
                    : "border-gray-200 opacity-60"
                } transition-colors`}
              >
                <h3 className="font-semibold text-lg mb-1">{m.name}</h3>
                <p className="text-sm text-gray-500">{m.description}</p>
                {!m.ready && (
                  <span className="inline-block mt-3 text-xs bg-gray-100 text-gray-400 px-2 py-1 rounded">
                    En desarrollo
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
