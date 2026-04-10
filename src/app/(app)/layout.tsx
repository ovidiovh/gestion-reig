import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AppShell from "./AppShell";

/**
 * Todos los módulos restringibles del sistema.
 * Cuando se añada un módulo nuevo, añadirlo aquí.
 */
const TODOS_LOS_MODULOS = [
  "financiero_retiradas",
  "financiero_historial",
  "financiero_ingresos",
  "financiero_descuadres",
  "marketing_crm",
  "marketing_clientes",
  "marketing_cronico",
  "rrhh_calendario",
  "rrhh_guardias",
  "rrhh_vacaciones",
  "rrhh_equipo",
  "rrhh_nominas",
  "admin_panel",
];

/**
 * Obtiene los módulos a los que el usuario tiene permiso.
 * Los admins tienen acceso implícito a todo.
 * Para no-admins, consulta permisos_modulo en una sola query.
 */
async function obtenerModulosPermitidos(email: string, role: string): Promise<string[]> {
  if (role === "admin") {
    return [...TODOS_LOS_MODULOS];
  }
  try {
    const result = await db.execute({
      sql: `SELECT modulo FROM permisos_modulo WHERE email = ?`,
      args: [email.toLowerCase()],
    });
    return result.rows.map((r) => String(r.modulo));
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
