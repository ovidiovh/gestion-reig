import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/rrhh/guardias/stats?year=2026
// Devuelve número de guardias realizadas por cada farmacéutico en el año
export async function GET(req: NextRequest) {
  try {
    const year = req.nextUrl.searchParams.get("year") || "2026";
    const rows = await query<{
      empleado_id: string;
      nombre: string;
      guardias_hechas: number;
    }>(
      `SELECT s.empleado_id, e.nombre, COUNT(*) as guardias_hechas
       FROM rrhh_guardia_slots s
       JOIN rrhh_guardias g ON g.id = s.guardia_id
       JOIN rrhh_empleados e ON e.id = s.empleado_id
       WHERE g.fecha LIKE ?
         AND e.farmaceutico = 1
       GROUP BY s.empleado_id
       ORDER BY e.orden ASC`,
      [`${year}%`]
    );
    return NextResponse.json({ ok: true, stats: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
