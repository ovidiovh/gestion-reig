/**
 * Layout del segmento Marketing → Fidelidad crónicos.
 *
 * Doble check de acceso (defensa en profundidad):
 * el middleware deja pasar a admins, pero este Server Component re-verifica
 * contra la tabla permisos_modulo para cualquier usuario.
 */
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos";

export default async function FidelidadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const permitido = await tienePermiso("marketing_fidelidad", user.email, user.role);
  if (!permitido) {
    redirect("/?error=sin-permisos-marketing");
  }
  return <>{children}</>;
}
