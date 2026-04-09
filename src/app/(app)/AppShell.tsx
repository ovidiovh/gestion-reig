"use client";

import Sidebar from "@/components/Sidebar";
import { usePageView } from "@/hooks/usePageView";

interface AppShellProps {
  children: React.ReactNode;
  userName: string;
  userEmail?: string | null;
  userImage?: string | null;
  departamento?: "farmacia" | "optica" | "ambos";
  role?: "admin" | "usuario";
  /** Módulos a los que el usuario tiene permiso (precargados desde server) */
  modulosPermitidos?: string[];
}

export default function AppShell({
  children,
  userName,
  userEmail,
  userImage,
  departamento = "farmacia",
  role = "admin",
  modulosPermitidos = [],
}: AppShellProps) {
  // Tracking de page views — fire-and-forget en cada navegación
  usePageView();

  return (
    <div className="min-h-screen" style={{ background: "#f8faf9" }}>
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        userImage={userImage}
        departamento={departamento}
        role={role}
        modulosPermitidos={modulosPermitidos}
      />

      {/* Main content — offset for desktop sidebar */}
      <main className="md:ml-64">
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
