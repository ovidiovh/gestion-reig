/**
 * API Ingresos Banco — POST (guardar) / GET (listar)
 * Requiere autenticación de usuario.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { guardarIngreso, listarIngresos, estadisticasMes } from "@/lib/ingresos";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Validar campos obligatorios
    if (!body.fecha || !body.concepto || !body.importe) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: fecha, concepto, importe" },
        { status: 400 }
      );
    }

    const { id } = await guardarIngreso({
      fecha: body.fecha,
      hora: body.hora || null,
      concepto: body.concepto,
      importe: parseFloat(body.importe),
      num_operacion: body.num_operacion || null,
      origen: body.origen || "manual",
      foto_base64: body.foto_base64 || null,
      email_id: body.email_id || null,
      usuario_email: user.email,
      usuario_nombre: user.nombre,
      notas: body.notas || null,
    });

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[api/ingresos] POST:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const filtro = req.nextUrl.searchParams.get("filtro") || "mes";
    const stats = req.nextUrl.searchParams.get("stats") === "1";

    if (stats) {
      const data = await estadisticasMes();
      return NextResponse.json(data);
    }

    const data = await listarIngresos(filtro);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[api/ingresos] GET:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
