import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH_SECRET = process.env.AUTH_SECRET || "reig-default-secret-change-me";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "";

function makeToken(timestamp: number): string {
  // Simple hash: password + secret + timestamp
  const raw = `${AUTH_PASSWORD}:${AUTH_SECRET}:${timestamp}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `${Math.abs(hash).toString(36)}.${timestamp}`;
}

export function verifyToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const timestamp = parseInt(parts[1]);
  if (isNaN(timestamp)) return false;
  // Token válido 30 días
  if (Date.now() - timestamp > 30 * 24 * 60 * 60 * 1000) return false;
  return token === makeToken(timestamp);
}

// POST — login
export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!AUTH_PASSWORD) {
      return NextResponse.json(
        { ok: false, error: "AUTH_PASSWORD no configurada en el servidor" },
        { status: 500 }
      );
    }

    if (password !== AUTH_PASSWORD) {
      return NextResponse.json(
        { ok: false, error: "Contraseña incorrecta" },
        { status: 401 }
      );
    }

    const token = makeToken(Date.now());
    const cookieStore = await cookies();
    cookieStore.set("reig-auth", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 días
      path: "/",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// DELETE — logout
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("reig-auth");
  return NextResponse.json({ ok: true });
}
