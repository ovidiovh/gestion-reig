import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/cleanup"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rutas públicas: no bloquear
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Archivos estáticos: no bloquear
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Verificar cookie de autenticación
  const token = req.cookies.get("reig-auth")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Verificación básica del token (formato válido + no expirado)
  const parts = token.split("~");
  if (parts.length !== 2) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const timestamp = parseInt(parts[1]);
  if (isNaN(timestamp) || Date.now() - timestamp > 30 * 24 * 60 * 60 * 1000) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
