"use client";

import Sidebar from "@/components/Sidebar";

interface AppShellProps {
  children: React.ReactNode;
  userName: string;
  userImage?: string | null;
}

export default function AppShell({ children, userName, userImage }: AppShellProps) {
  return (
    <div className="min-h-screen" style={{ background: "#f8faf9" }}>
      <Sidebar userName={userName} userImage={userImage} />

      {/* Main content — offset for desktop sidebar */}
      <main className="md:ml-64">
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
