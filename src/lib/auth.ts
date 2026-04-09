/**
 * Helpers de autenticación para Server Components y API routes.
 * Envuelven auth() de Auth.js v5 con tipado Reig.
 */
import { auth } from "@/auth";

export interface UserSession {
  email: string;
  nombre: string;
  role: "admin" | "usuario";
  departamento: "farmacia" | "optica" | "ambos";
  activo: number;
  image?: string | null;
}

/**
 * Obtiene el usuario actual desde la sesión Auth.js.
 * Para usar en Server Components y API Routes.
 */
export async function getUser(): Promise<UserSession | null> {
  const session = await auth();
  if (!session?.user?.email) return null;

  return {
    email: session.user.email,
    nombre: (session.user as Record<string, unknown>).nombre as string || session.user.name || "",
    role: ((session.user as Record<string, unknown>).role as string || "usuario") as "admin" | "usuario",
    departamento: ((session.user as Record<string, unknown>).departamento as string || "farmacia") as "farmacia" | "optica" | "ambos",
    activo: (session.user as Record<string, unknown>).activo as number ?? 1,
    image: session.user.image,
  };
}

/**
 * Requiere autenticación — lanza redirect si no hay sesión.
 * Para usar en Server Components de páginas protegidas.
 */
export async function requireUser(): Promise<UserSession> {
  const user = await getUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return user as UserSession;
}

/**
 * Requiere rol admin — lanza redirect si no es admin.
 */
export async function requireAdmin(): Promise<UserSession> {
  const user = await requireUser();
  if (user.role !== "admin") {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard?error=sin-permisos");
  }
  return user as UserSession;
}

/**
 * Guard para API routes: requiere autenticación + permiso de módulo.
 * Devuelve { user } si OK, o { error: NextResponse } si no tiene acceso.
 * Admins pasan siempre. Uso:
 *
 *   const check = await requirePermiso("financiero_retiradas");
 *   if ("error" in check) return check.error;
 *   const { user } = check;
 */
export async function requirePermiso(
  modulo: string
): Promise<{ user: UserSession } | { error: Response }> {
  const { NextResponse } = await import("next/server");
  const user = await getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }
  if (user.role === "admin") return { user };

  const { tienePermiso } = await import("@/lib/permisos");
  const permitido = await tienePermiso(modulo, user.email, user.role);
  if (!permitido) {
    return { error: NextResponse.json({ error: "Sin permiso para " + modulo }, { status: 403 }) };
  }
  return { user };
}

/**
 * Guard ligero: solo requiere autenticación (cualquier usuario logueado).
 * Para APIs que no tienen restricción de módulo pero sí necesitan sesión.
 */
export async function requireAuth(): Promise<{ user: UserSession } | { error: Response }> {
  const { NextResponse } = await import("next/server");
  const user = await getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }
  return { user };
}
