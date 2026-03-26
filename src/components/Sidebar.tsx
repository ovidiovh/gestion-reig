"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const modules = [
  { name: "Inicio", href: "/", icon: "🏠" },
  { name: "Nueva retirada", href: "/retiradas", icon: "💶", ready: true },
  { name: "Historial", href: "/retiradas/historial", icon: "📋", ready: true },
  { name: "Ventas", href: "/ventas", icon: "📊", ready: false },
  { name: "CRM", href: "/crm", icon: "👥", ready: false },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-reig-green text-white flex flex-col shrink-0">
      <div className="p-6 border-b border-white/20">
        <Link href="/">
          <h1 className="font-serif text-xl">Farmacia Reig</h1>
          <p className="text-sm text-white/70 mt-1">Panel de gestión</p>
        </Link>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {modules.map((m) => {
            const isActive = pathname === m.href || (m.href !== "/" && pathname.startsWith(m.href));
            const isReady = m.ready !== false;

            return (
              <li key={m.href}>
                {isReady ? (
                  <Link
                    href={m.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "hover:bg-white/10 text-white/80"
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span>{m.name}</span>
                  </Link>
                ) : (
                  <span className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/40 cursor-not-allowed">
                    <span>{m.icon}</span>
                    <span>{m.name}</span>
                    <span className="text-xs ml-auto bg-white/10 px-2 py-0.5 rounded">
                      próx.
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-white/20 text-xs text-white/50">
        C/ Guatiza 10, Vecindario
        <br />
        928 12 20 44
      </div>
    </aside>
  );
}
