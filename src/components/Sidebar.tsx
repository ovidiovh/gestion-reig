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

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay móvil */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-reig-green text-white flex flex-col shrink-0
          transition-transform duration-200 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:static md:translate-x-0
        `}
      >
        <div className="p-6 border-b border-white/20 flex items-center justify-between">
          <Link href="/" onClick={onClose}>
            <h1 className="font-serif text-xl">Farmacia Reig</h1>
            <p className="text-sm text-white/70 mt-1">Panel de gestión</p>
          </Link>
          {/* Cerrar en móvil */}
          <button
            onClick={onClose}
            className="md:hidden text-white/70 hover:text-white text-2xl leading-none"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {modules.map((m) => {
              const isActive =
                pathname === m.href ||
                (m.href !== "/" && pathname.startsWith(m.href));
              const isReady = m.ready !== false;

              return (
                <li key={m.href}>
                  {isReady ? (
                    <Link
                      href={m.href}
                      onClick={onClose}
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
    </>
  );
}
