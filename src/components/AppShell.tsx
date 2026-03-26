"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header móvil con hamburguesa */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-reig-green text-white sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-2xl leading-none"
          >
            ☰
          </button>
          <h1 className="font-serif text-lg">Farmacia Reig</h1>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
