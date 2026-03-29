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

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
