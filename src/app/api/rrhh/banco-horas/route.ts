import { query, db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";

// GET /api/rrhh/banco-horas?empleado_id=xxx
export async function GET(req: NextRequest) {
  const check = await requirePermiso("rrhh_equipo");
  if ("error" in check) return check.error;

  try {
    const empId = req.nextUrl.searchParams.get("empleado_id");
    if (!empId) {
      return NextResponse.json({ ok: false, error: "empleado_id requerido" }, { status: 400 });
    }
    const rows = await query(
      `SELECT * FROM rrhh_banco_horas WHERE empleado_id = ? ORDER BY fecha ASC, id ASC`,
      [empId]
    );
    return NextResponse.json({ ok: true, entradas: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// POST /api/rrhh/banco-horas — añadir entrada
export async function POST(req: NextRequest) {
  const check = await requirePermiso("rrhh_equipo");
  if ("error" in check) return check.error;

  try {
    const { empleado_id, fecha, concepto, minutos, notas } = await req.json() as {
      empleado_id: string; fecha: string; concepto: string; minutos: number; notas?: string;
    };

    if (!empleado_id || !fecha || !concepto || minutos == null) {
      return NextResponse.json({ ok: false, error: "Campos requeridos: empleado_id, fecha, concepto, minutos" }, { status: 400 });
    }

    const result = await db.execute({
      sql: `INSERT INTO rrhh_banco_horas (empleado_id, fecha, concepto, minutos, notas)
            VALUES (?, ?, ?, ?, ?)`,
      args: [empleado_id, fecha, concepto, minutos, notas ?? null],
    });

    const rows = await query(`SELECT * FROM rrhh_banco_horas WHERE id = ?`, [Number(result.lastInsertRowid)]);
    return NextResponse.json({ ok: true, entrada: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// DELETE /api/rrhh/banco-horas?id=xxx
export async function DELETE(req: NextRequest) {
  const check = await requirePermiso("rrhh_equipo");
  if ("error" in check) return check.error;

  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    await db.execute({ sql: `DELETE FROM rrhh_banco_horas WHERE id = ?`, args: [Number(id)] });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
