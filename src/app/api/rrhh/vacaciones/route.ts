import { query, db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";

// GET /api/rrhh/vacaciones?year=2026
export async function GET(req: NextRequest) {
  const check = await requirePermiso("rrhh_vacaciones");
  if ("error" in check) return check.error;

  try {
    const year = req.nextUrl.searchParams.get("year") || "2026";
    const vacaciones = await query(
      `SELECT v.id, v.empleado_id, v.fecha_inicio, v.fecha_fin, v.estado,
              COALESCE(v.tipo, 'vac') as tipo, e.nombre, e.farmaceutico, e.empresa
       FROM rrhh_vacaciones v
       JOIN rrhh_empleados e ON e.id = v.empleado_id
       WHERE v.fecha_inicio LIKE ? OR v.fecha_fin LIKE ?
       ORDER BY v.fecha_inicio ASC`,
      [`${year}%`, `${year}%`]
    );
    return NextResponse.json({ ok: true, vacaciones });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// POST /api/rrhh/vacaciones
export async function POST(req: NextRequest) {
  const check = await requirePermiso("rrhh_vacaciones");
  if ("error" in check) return check.error;

  try {
    const body = await req.json();
    const { empleado_id, fecha_inicio, fecha_fin, estado, tipo } = body as {
      empleado_id: string;
      fecha_inicio: string;
      fecha_fin: string;
      estado?: string;
      tipo?: string;
    };

    if (!empleado_id || !fecha_inicio || !fecha_fin) {
      return NextResponse.json({ ok: false, error: "empleado_id, fecha_inicio y fecha_fin son requeridos" }, { status: 400 });
    }

    const result = await db.execute({
      sql: `INSERT INTO rrhh_vacaciones (empleado_id, fecha_inicio, fecha_fin, estado, tipo) VALUES (?, ?, ?, ?, ?)`,
      args: [empleado_id, fecha_inicio, fecha_fin, estado || "pend", tipo || "vac"],
    });

    return NextResponse.json({ ok: true, id: result.lastInsertRowid });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
