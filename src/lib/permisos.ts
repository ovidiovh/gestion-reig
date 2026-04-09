import { db } from "@/lib/db";

/**
 * Sistema de permisos dinámico basado en BD.
 *
 * Sustituye las whitelists hardcodeadas en código. Los permisos se guardan
 * en la tabla `permisos_modulo` (modulo + email). Los admins tienen acceso
 * implícito a todo.
 *
 * Módulos registrados:
 *   - marketing_clientes  → dashboard epidemiológico
 *   - admin_panel         → sección de administración
 *   (añadir más a medida que se creen módulos restringidos)
 */

// Cache en memoria para no hacer query en cada render del Sidebar.
// Se invalida cada 60s o manualmente con invalidarCachePermisos().
let cache: Map<string, Set<string>> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

export function invalidarCachePermisos() {
  cache = null;
  cacheTimestamp = 0;
}

async function cargarPermisos(): Promise<Map<string, Set<string>>> {
  const now = Date.now();
  if (cache && now - cacheTimestamp < CACHE_TTL_MS) return cache;

  try {
    const result = await db.execute({
      sql: `SELECT modulo, email FROM permisos_modulo`,
      args: [],
    });

    const mapa = new Map<string, Set<string>>();
    for (const row of result.rows) {
      const modulo = String(row.modulo);
      const email = String(row.email).toLowerCase();
      if (!mapa.has(modulo)) mapa.set(modulo, new Set());
      mapa.get(modulo)!.add(email);
    }

    cache = mapa;
    cacheTimestamp = now;
    return mapa;
  } catch (err) {
    console.error("[permisos] Error cargando permisos:", err);
    // Si la tabla no existe aún, devolver vacío (la migración no se ha corrido)
    return new Map();
  }
}

/**
 * Comprueba si un email tiene permiso para un módulo.
 * Los admins (role="admin") siempre pasan.
 */
export async function tienePermiso(
  modulo: string,
  email: string | null | undefined,
  role?: string
): Promise<boolean> {
  if (!email) return false;
  // Los admins tienen acceso implícito a todo
  if (role === "admin") return true;

  const permisos = await cargarPermisos();
  const emails = permisos.get(modulo);
  return emails?.has(email.toLowerCase()) ?? false;
}

/**
 * Devuelve la lista de emails con permiso para un módulo.
 */
export async function emailsConPermiso(modulo: string): Promise<string[]> {
  const permisos = await cargarPermisos();
  const emails = permisos.get(modulo);
  return emails ? Array.from(emails) : [];
}

/**
 * Añade un permiso. Devuelve true si se insertó, false si ya existía.
 */
export async function concederPermiso(
  modulo: string,
  email: string,
  concedidoPor: string
): Promise<boolean> {
  try {
    await db.execute({
      sql: `INSERT OR IGNORE INTO permisos_modulo (modulo, email, concedido_por)
            VALUES (?, ?, ?)`,
      args: [modulo, email.toLowerCase(), concedidoPor],
    });
    invalidarCachePermisos();
    return true;
  } catch (err) {
    console.error("[permisos] Error concediendo:", err);
    return false;
  }
}

/**
 * Revoca un permiso.
 */
export async function revocarPermiso(modulo: string, email: string): Promise<boolean> {
  try {
    await db.execute({
      sql: `DELETE FROM permisos_modulo WHERE modulo = ? AND email = ?`,
      args: [modulo, email.toLowerCase()],
    });
    invalidarCachePermisos();
    return true;
  } catch (err) {
    console.error("[permisos] Error revocando:", err);
    return false;
  }
}

/**
 * Lista todos los permisos de todos los módulos.
 */
export async function listarTodosPermisos(): Promise<
  { modulo: string; email: string; concedido_por: string; fecha: string }[]
> {
  try {
    const result = await db.execute({
      sql: `SELECT modulo, email, concedido_por, fecha FROM permisos_modulo ORDER BY modulo, email`,
      args: [],
    });
    return result.rows as unknown as { modulo: string; email: string; concedido_por: string; fecha: string }[];
  } catch {
    return [];
  }
}

// ── Backward compatibility ──
// Re-exportar una función síncrona para el Sidebar (client component)
// que no puede llamar async. El Sidebar recibe los permisos como prop
// desde el Server Component (layout.tsx).

/**
 * Versión síncrona para client components.
 * Recibe la lista precargada de módulos permitidos para el usuario.
 */
export function puedeVer(
  modulo: string,
  modulosPermitidos: string[],
  role?: string
): boolean {
  if (role === "admin") return true;
  return modulosPermitidos.includes(modulo);
}

/**
 * Devuelve la lista de módulos a los que tiene acceso un email concreto.
 * Para admins devuelve TODOS los módulos.
 * Útil para la Home y cualquier sitio que necesite saber "a qué tiene acceso este usuario".
 */
const TODOS_LOS_MODULOS = [
  "financiero_retiradas", "financiero_historial", "financiero_ingresos", "financiero_descuadres",
  "marketing_crm", "marketing_clientes",
  "rrhh_calendario", "rrhh_guardias", "rrhh_vacaciones",
  "rrhh_equipo", "rrhh_nominas",
  "admin_panel",
];

export async function listarPermisosUsuario(
  email: string,
  role?: string
): Promise<string[]> {
  if (role === "admin") return [...TODOS_LOS_MODULOS];
  const permisos = await cargarPermisos();
  return TODOS_LOS_MODULOS.filter((m) => {
    const emails = permisos.get(m);
    return emails?.has(email.toLowerCase()) ?? false;
  });
}
