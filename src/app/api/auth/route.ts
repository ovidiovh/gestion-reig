import { NextRequest, NextResponse } from "next/server";

const AUTH_SECRET = process.env.AUTH_SECRET || "reig-default-secret-change-me";

// Usuarios autorizados: email → contraseña (de variables de entorno)
// Formato AUTH_USERS: "email1:pass1,email2:pass2"
function getUsers(): Record<string, string> {
  const raw = process.env.AUTH_USERS || "";
  const users: Record<string, string> = {};
  raw.split(",").forEach((pair) => {
    const [email, pass] = pair.split(":");
    if (email && pass) users[email.trim().toLowerCase()] = pass.trim();
  });
  return users;
}

function makeToken(email: string, timestamp: number): string {
  const raw = `${email}:${AUTH_SECRET}:${timestamp}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `${email}|${Math.abs(hash).toString(36)}~${timestamp}`;
}

// POST — login
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const users = getUsers();

    if (Object.keys(users).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No hay usuarios configurados en el servidor" },
        { status: 500 }
      );
    }

    const emailNorm = (email || "").trim().toLowerCase();
    const userPass = users[emailNorm];

    if (!userPass || userPass !== password) {
      return NextResponse.json(
        { ok: false, error: "Email o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const token = makeToken(emailNorm, Date.now());
    const maxAge = 30 * 24 * 60 * 60;
    const cookieValue = `reig-auth=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookieValue,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// DELETE — logout
export async function DELETE() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "reig-auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
}
