/**
 * Layout del segmento Administración.
 *
 * Defensa en profundidad: el middleware ya bloquea /admin para no-admins,
 * pero este Server Component re-verifica por si el middleware se reconfigura.
 */
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (user.role !== "admin") {
    redirect("/?error=sin-permisos");
  }
  return <>{children}</>;
}
