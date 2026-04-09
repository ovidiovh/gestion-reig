import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

// GET /api/rrhh/guardias/stats?year=2026
// Devuelve guardias REALIZADAS (fecha <= hoy) por farmacéutico + ajuste manual
export async function GET(req: NextRequest) {
  const check = await requireAuth();
  if ("error" in check) return check.error;

  try {
    const year = req.nextUrl.searchParams.get("year") || "2026";

    const rows = await query<{
      empleado_id: string;
      nombre: string;
      guardias_hechas: number;
      guardias_manual: number | null;
    }>(
      `SELECT
         s.empleado_id,
         e.nombre,
         COUNT(*) as guardias_hechas,
         e.guardias_manual
       FROM rrhh_guardia_slots s
       JOIN rrhh_guardias g ON g.id = s.guardia_id
       JOIN rrhh_empleados e ON e.id = s.empleado_id
       WHERE g.fecha LIKE ?
         AND g.fecha <= date('now')
         AND e.farmaceutico = 1
       GROUP BY s.empleado_id
       ORDER BY e.orden ASC`,
      [`${year}%`]
    );

    // Incluir también farmacéuticos con guardias_manual pero sin slots pasados aún
    const farmaSinSlots = await query<{
      empleado_id: string;
      nombre: string;
      guardias_manual: number | null;
    }>(
      `SELECT id as empleado_id, nombre, guardias_manual
       FROM rrhh_empleados
       WHERE farmaceutico = 1
         AND activo = 1
         AND id NOT IN (
           SELECT s.empleado_id
           FROM rrhh_guardia_slots s
           JOIN rrhh_guardias g ON g.id = s.guardia_id
           WHERE g.fecha LIKE ? AND g.fecha <= date('now')
         )`,
      [`${year}%`]
    );

    const stats = [
      ...rows,
      ...farmaSinSlots.map(e => ({
        empleado_id: e.empleado_id,
        nombre: e.nombre,
        guardias_hechas: 0,
        guardias_manual: e.guardias_manual,
      })),
    ];

    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
