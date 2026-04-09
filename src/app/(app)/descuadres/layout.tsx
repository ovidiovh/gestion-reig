/**
 * Layout del segmento Descuadres de caja.
 * Defensa en profundidad: verifica permiso financiero_descuadres.
 */
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos";

export default async function DescuadresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const permitido = await tienePermiso("financiero_descuadres", user.email, user.role);
  if (!permitido) {
    redirect("/?error=sin-permisos");
  }
  return <>{children}</>;
}
