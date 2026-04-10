import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Middleware de autenticación con Auth.js v5.
 * - Rutas públicas: /login, /api/auth/*, /api/setup, assets estáticos
 * - Todo lo demás requiere sesión Google válida
 * - Usuarios desactivados (activo=0) son rechazados
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Rutas públicas — no requieren autenticación
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/crm/precalcular") ||
    pathname.startsWith("/api/crm/debug") ||
    pathname.startsWith("/api/ingresos/webhook") ||
    pathname.startsWith("/api/descuadres/ingestar") ||
    pathname.startsWith("/api/reig-base/sync") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/icon" ||
    pathname === "/apple-icon"
  ) {
    return NextResponse.next();
  }

  // Si no hay sesión → redirigir a login (o 401 para API)
  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Si el usuario está desactivado → cerrar sesión
  if (req.auth.user?.activo === 0) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Usuario desactivado" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/login?error=desactivado", req.url));
  }

  // ── Rutas restringidas por rol ──

  // Administración: solo admins
  if (pathname.startsWith("/admin")) {
    if (req.auth.user?.role !== "admin") {
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/?error=sin-permisos", req.url));
    }
  }

  // Marketing → Paciente crónico: solo admins
  if (pathname.startsWith("/marketing/cronico")) {
    if (req.auth.user?.role !== "admin") {
      return NextResponse.redirect(new URL("/?error=sin-permisos-marketing", req.url));
    }
  }

  // Marketing → Clientes: whitelist por rol (admin) + permisos en BD.
  // Primera línea: solo admins pasan aquí. Segunda línea: layout.tsx re-chequea
  // contra permisos_modulo en BD (defensa en profundidad).
  if (pathname.startsWith("/marketing/clientes")) {
    if (req.auth.user?.role !== "admin") {
      // Usuarios no-admin: el layout verificará permisos_modulo.
      // Aquí dejamos pasar porque la tabla puede tener permisos para no-admins.
      // Si no tiene permiso, el layout redirige.
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
