"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

interface SidebarProps {
  userName: string;
  userImage?: string | null;
}

interface NavItem {
  label: string;
  href: string;
  activo: boolean;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: "Inicio",
    href: "/",
    activo: true,
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    ),
  },
  {
    label: "Nueva retirada",
    href: "/retiradas",
    activo: true,
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: "Historial",
    href: "/retiradas/historial",
    activo: true,
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Ventas",
    href: "/ventas",
    activo: false,
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: "CRM",
    href: "/crm",
    activo: false,
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

export default function Sidebar({ userName, userImage }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
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
          <h1 className="text-white text-lg font-semibold" style={{ fontFamily: "'DM Serif Display', serif" }}>
            Gestión Reig
          </h1>
          <p className="text-white/60 text-xs">Farmacia Reig</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          if (!item.activo) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-not-allowed opacity-50"
              >
                <span className="text-white/40">{item.icon}</span>
                <span className="text-white/40 text-sm">{item.label}</span>
                <span className="ml-auto text-[10px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded">
                  prox.
                </span>
              </div>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                active
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-3">
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
          className="w-full text-left px-2 py-1.5 text-white/50 hover:text-white/80 text-xs transition-colors"
        >
          Cerrar sesion
        </button>
      </div>

      {/* Footer info */}
      <div className="px-6 py-3 border-t border-white/10">
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
            Farmacia Reig
          </h1>
          <div className="w-8" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          {/* Sidebar panel */}
          <div
            className="relative w-64 flex flex-col animate-slide-in"
            style={{ background: "#0C6D32" }}
          >
            {/* Close button */}
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
        style={{ background: "#0C6D32" }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
