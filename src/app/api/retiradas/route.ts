import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { guardarSesion, listarSesiones } from "@/lib/retiradas";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const { id, total } = await guardarSesion({
      fecha: body.fecha || new Date().toISOString().slice(0, 10),
      cajas: body.cajas || [],
      conteo: body.conteo || {},
      movimientos: body.movimientos || [],
      destino: body.destino || "caja_fuerte",
      usuario_email: user.email,
      usuario_nombre: user.nombre,
    });

    return NextResponse.json({ ok: true, id, total });
  } catch (e) {
    console.error("[api/retiradas] POST:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const filtro = req.nextUrl.searchParams.get("filtro") || "todo";
    const data = await listarSesiones(filtro);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[api/retiradas] GET:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
