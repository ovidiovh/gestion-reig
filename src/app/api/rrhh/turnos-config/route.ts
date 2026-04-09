import { query, db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";

// GET /api/rrhh/turnos-config — devuelve los 4 turnos configurados
export async function GET() {
  const check = await requirePermiso("rrhh_equipo");
  if ("error" in check) return check.error;

  try {
    const rows = await query(`SELECT * FROM rrhh_turnos_config ORDER BY turno ASC`);
    return NextResponse.json({ ok: true, turnos: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// PATCH /api/rrhh/turnos-config — actualiza un turno
// Body: { turno: 0|1|2|3, inicio_a, fin_a, inicio_b?, fin_b? }
export async function PATCH(req: NextRequest) {
  const check = await requirePermiso("rrhh_equipo");
  if ("error" in check) return check.error;

  try {
    const body = await req.json() as {
      turno: number;
      inicio_a: number;
      fin_a: number;
      inicio_b?: number | null;
      fin_b?: number | null;
    };
    const { turno, inicio_a, fin_a, inicio_b = null, fin_b = null } = body;

    if (turno == null || inicio_a == null || fin_a == null) {
      return NextResponse.json({ ok: false, error: "turno, inicio_a y fin_a son obligatorios" }, { status: 400 });
    }
    if (![0, 1, 2, 3].includes(turno)) {
      return NextResponse.json({ ok: false, error: "turno debe ser 0, 1, 2 o 3" }, { status: 400 });
    }

    await db.execute({
      sql: `INSERT INTO rrhh_turnos_config (turno, inicio_a, fin_a, inicio_b, fin_b)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(turno) DO UPDATE SET
              inicio_a = excluded.inicio_a,
              fin_a    = excluded.fin_a,
              inicio_b = excluded.inicio_b,
              fin_b    = excluded.fin_b`,
      args: [turno, inicio_a, fin_a, inicio_b, fin_b],
    });

    const rows = await query(`SELECT * FROM rrhh_turnos_config WHERE turno = ?`, [turno]);
    return NextResponse.json({ ok: true, turno: rows[0] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
