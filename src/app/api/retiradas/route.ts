import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { guardarSesion, listarSesiones } from "@/lib/retiradas";
import { db } from "@/lib/db";

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
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  try {
    const desde = req.nextUrl.searchParams.get("desde");
    const sesionId = req.nextUrl.searchParams.get("sesion_id");
    const filtro = req.nextUrl.searchParams.get("filtro") || "todo";

    // Si piden detalle de una sesión concreta
    if (sesionId) {
      const { detalleSesion } = await import("@/lib/retiradas");
      const data = await detalleSesion(Number(sesionId));
      return NextResponse.json({ ok: true, data });
    }

    const data = await listarSesiones(desde || filtro);

    // Calcular caja fuerte (suma de las que están en caja_fuerte y sin remesa)
    const balance_farmacia = data
      .filter((s) => s.destino === "caja_fuerte" && (!s.origen || s.origen === "farmacia"))
      .reduce((sum, s) => sum + (s.total || 0), 0);
    const balance_optica = data
      .filter((s) => s.destino === "caja_fuerte" && s.origen === "optica")
      .reduce((sum, s) => sum + (s.total || 0), 0);

    // Mapear a formato del frontend
    const mapped = data.map((s) => ({
      id: s.id,
      fecha: s.fecha,
      created_at: s.created_at,
      usuario: s.usuario_nombre || "",
      destino: s.destino,
      total_cajas: s.total || 0,
      total_audit: null,
      auditada: s.conteo_cuadra ? 1 : 0,
      num_cajas: s.num_cajas || 0,
      remesa_id: null,
      remesa_estado: null,
      remesa_confirmada_at: null,
      origen: s.origen || "farmacia",
    }));

    return NextResponse.json({
      ok: true,
      data: mapped,
      caja_fuerte: {
        balance_farmacia,
        balance_optica,
        balance_total: balance_farmacia + balance_optica,
      },
    });
  } catch (e) {
    console.error("[api/retiradas] GET:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta parámetro id" }, { status: 400 });
    }
    const sesionId = Number(id);

    // Borrar en cascada: cajas, conteo, movimientos, sesión
    await db.execute({ sql: `DELETE FROM retiradas_caja WHERE sesion_id = ?`, args: [sesionId] });
    await db.execute({ sql: `DELETE FROM retiradas_conteo WHERE sesion_id = ?`, args: [sesionId] });
    await db.execute({ sql: `DELETE FROM retiradas_movimiento WHERE sesion_id = ?`, args: [sesionId] });
    const result = await db.execute({ sql: `DELETE FROM retiradas_sesion WHERE id = ?`, args: [sesionId] });

    return NextResponse.json({
      ok: true,
      deleted: result.rowsAffected,
      id: sesionId,
      usuario: user.nombre,
    });
  } catch (e) {
    console.error("[api/retiradas] DELETE:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
