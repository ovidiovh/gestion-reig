import { requireUser } from "@/lib/auth";
import AppShell from "./AppShell";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <AppShell
      userName={user.nombre || user.email}
      userEmail={user.email}
      userImage={user.image}
      departamento={user.departamento}
      role={user.role}
    >
      {children}
    </AppShell>
  );
}
