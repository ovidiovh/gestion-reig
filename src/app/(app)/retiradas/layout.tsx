import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos";
import RetiradasZona from "./RetiradasZona";

/**
 * Layout server del segmento Retiradas.
 * 1. Verifica permiso financiero_retiradas.
 * 2. Delega al client component RetiradasZona para el selector farmacia/óptica.
 */
export default async function RetiradasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const permitido = await tienePermiso("financiero_retiradas", user.email, user.role);
  if (!permitido) {
    redirect("/?error=sin-permisos");
  }
  return <RetiradasZona>{children}</RetiradasZona>;
}
