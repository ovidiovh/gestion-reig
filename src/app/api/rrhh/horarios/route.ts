import { query, db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/rrhh/horarios?week=YYYY-MM-DD&weeks=4
// Devuelve asignaciones de turno para la semana(s) indicada(s)
export async function GET(req: NextRequest) {
  try {
    const week  = req.nextUrl.searchParams.get("week");
    const weeks = parseInt(req.nextUrl.searchParams.get("weeks") ?? "1");

    if (!week) {
      return NextResponse.json({ ok: false, error: "week requerido (YYYY-MM-DD)" }, { status: 400 });
    }

    // Calcular rango de semanas
    const weekStarts: string[] = [];
    const anchor = new Date(week + "T00:00:00");
    for (let i = 0; i < weeks; i++) {
      const d = new Date(anchor);
      d.setDate(d.getDate() + i * 7);
      weekStarts.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      );
    }

    const placeholders = weekStarts.map(() => "?").join(",");
    const asignaciones = await query(
      `SELECT ha.*, e.nombre
       FROM rrhh_horarios_asignacion ha
       JOIN rrhh_empleados e ON e.id = ha.empleado_id
       WHERE ha.week_start IN (${placeholders})
       ORDER BY ha.week_start, e.orden`,
      weekStarts
    );

    return NextResponse.json({ ok: true, asignaciones });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// POST /api/rrhh/horarios — upsert asignación de turno
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { week_start, empleado_id, turno, notas = null } = body as {
      week_start: string;
      empleado_id: string;
      turno: number;
      notas?: string | null;
    };

    if (!week_start || !empleado_id || turno === undefined) {
      return NextResponse.json({ ok: false, error: "week_start, empleado_id y turno son obligatorios" }, { status: 400 });
    }

    await db.execute({
      sql: `INSERT INTO rrhh_horarios_asignacion (week_start, empleado_id, turno, notas)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(week_start, empleado_id) DO UPDATE SET
              turno = excluded.turno,
              notas = excluded.notas`,
      args: [week_start, empleado_id, turno, notas],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
