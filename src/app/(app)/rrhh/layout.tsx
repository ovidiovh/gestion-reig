/**
 * Layout raíz del segmento RRHH.
 * Verifica que el usuario tenga AL MENOS UN permiso de RRHH.
 * Los sub-segmentos (equipo, nóminas) tienen su propio layout con check específico.
 * La página raíz (/rrhh = calendario) se protege adicionalmente en su page.tsx
 * o se acepta que quien tenga cualquier permiso RRHH pueda ver el calendario.
 */
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos";

export default async function RrhhLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // Dejar pasar si tiene CUALQUIER permiso de RRHH
  const [cal, guardias, vacaciones, equipo, nominas] = await Promise.all([
    tienePermiso("rrhh_calendario", user.email, user.role),
    tienePermiso("rrhh_guardias", user.email, user.role),
    tienePermiso("rrhh_vacaciones", user.email, user.role),
    tienePermiso("rrhh_equipo", user.email, user.role),
    tienePermiso("rrhh_nominas", user.email, user.role),
  ]);
  if (!cal && !guardias && !vacaciones && !equipo && !nominas) {
    redirect("/?error=sin-permisos");
  }
  return <>{children}</>;
}
