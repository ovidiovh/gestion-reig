import { query, db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/rrhh/vacaciones?year=2026
export async function GET(req: NextRequest) {
  try {
    const year = req.nextUrl.searchParams.get("year") || "2026";
    const vacaciones = await query(
      `SELECT v.*, e.nombre, e.farmaceutico, e.empresa
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
  try {
    const body = await req.json();
    const { empleado_id, fecha_inicio, fecha_fin, estado } = body as {
      empleado_id: string;
      fecha_inicio: string;
      fecha_fin: string;
      estado?: string;
    };

    if (!empleado_id || !fecha_inicio || !fecha_fin) {
      return NextResponse.json({ ok: false, error: "empleado_id, fecha_inicio y fecha_fin son requeridos" }, { status: 400 });
    }

    const result = await db.execute({
      sql: `INSERT INTO rrhh_vacaciones (empleado_id, fecha_inicio, fecha_fin, estado) VALUES (?, ?, ?, ?)`,
      args: [empleado_id, fecha_inicio, fecha_fin, estado || "pend"],
    });

    return NextResponse.json({ ok: true, id: result.lastInsertRowid });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
