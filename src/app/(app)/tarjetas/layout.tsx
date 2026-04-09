/**
 * Layout del segmento Tarjetas.
 * Defensa en profundidad: verifica permiso financiero_tarjetas.
 */
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos";

export default async function TarjetasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const permitido = await tienePermiso("financiero_tarjetas", user.email, user.role);
  if (!permitido) {
    redirect("/?error=sin-permisos");
  }
  return <>{children}</>;
}
