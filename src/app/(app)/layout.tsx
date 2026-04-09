import { requireUser } from "@/lib/auth";
import { emailsConPermiso } from "@/lib/permisos";
import AppShell from "./AppShell";

/**
 * Obtiene los módulos a los que el usuario tiene permiso.
 * Los admins tienen acceso implícito a todo, pero los listamos
 * igualmente para que el Sidebar sepa qué items mostrar.
 */
async function obtenerModulosPermitidos(email: string, role: string): Promise<string[]> {
  if (role === "admin") {
    // Los admins ven todo — devolver todos los módulos que existen
    return ["marketing_clientes", "admin_panel"];
  }
  try {
    // Buscar en qué módulos aparece este email
    const todos = await Promise.all([
      emailsConPermiso("marketing_clientes"),
      emailsConPermiso("admin_panel"),
    ]);
    const modulos: string[] = [];
    const emailLower = email.toLowerCase();
    if (todos[0].includes(emailLower)) modulos.push("marketing_clientes");
    if (todos[1].includes(emailLower)) modulos.push("admin_panel");
    return modulos;
  } catch {
    return [];
  }
}

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const modulosPermitidos = await obtenerModulosPermitidos(user.email, user.role);

  return (
    <AppShell
      userName={user.nombre || user.email}
      userEmail={user.email}
      userImage={user.image}
      departamento={user.departamento}
      role={user.role}
      modulosPermitidos={modulosPermitidos}
    >
      {children}
    </AppShell>
  );
}
