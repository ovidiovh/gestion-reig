/**
 * Layout del segmento Marketing → Clientes.
 *
 * Doble check de acceso (defensa en profundidad):
 * el middleware deja pasar a admins, pero este Server Component re-verifica
 * contra la tabla permisos_modulo para cualquier usuario.
 *
 * Permisos controlados en src/lib/permisos.ts (BD, ya no hardcodeado).
 */
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos";

export default async function MarketingClientesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const permitido = await tienePermiso("marketing_clientes", user.email, user.role);
  if (!permitido) {
    redirect("/?error=sin-permisos-marketing");
  }
  return <>{children}</>;
}
