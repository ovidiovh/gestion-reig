/**
 * Layout del segmento Historial de Retiradas.
 * Defensa en profundidad: verifica permiso financiero_historial.
 * Más restrictivo que el layout padre (financiero_retiradas).
 */
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos";

export default async function HistorialRetiradasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const permitido = await tienePermiso("financiero_historial", user.email, user.role);
  if (!permitido) {
    redirect("/?error=sin-permisos");
  }
  return <>{children}</>;
}
