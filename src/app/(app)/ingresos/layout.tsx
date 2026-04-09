/**
 * Layout del segmento Ingresos banco.
 * Defensa en profundidad: verifica permiso financiero_ingresos.
 */
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos";

export default async function IngresosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const permitido = await tienePermiso("financiero_ingresos", user.email, user.role);
  if (!permitido) {
    redirect("/?error=sin-permisos");
  }
  return <>{children}</>;
}
