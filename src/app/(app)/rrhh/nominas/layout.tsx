/**
 * Layout del segmento RRHH → Nóminas.
 * Defensa en profundidad: verifica permiso rrhh_nominas.
 */
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos";

export default async function NominasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const permitido = await tienePermiso("rrhh_nominas", user.email, user.role);
  if (!permitido) {
    redirect("/?error=sin-permisos");
  }
  return <>{children}</>;
}
