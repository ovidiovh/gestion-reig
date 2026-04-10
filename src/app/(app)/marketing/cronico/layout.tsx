/**
 * Layout del segmento Marketing → Paciente crónico.
 *
 * Solo visible para administradores.
 * Defensa en profundidad: middleware + layout server component.
 */
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function CronicoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (user.role !== "admin") {
    redirect("/?error=sin-permisos-marketing");
  }
  return <>{children}</>;
}
