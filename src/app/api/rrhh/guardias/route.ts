import { query, db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePermiso } from "@/lib/auth";

// GET /api/rrhh/guardias?year=2026
export async function GET(req: NextRequest) {
  const check = await requireAuth();
  if ("error" in check) return check.error;

  try {
    const year = req.nextUrl.searchParams.get("year") || "2026";
    const guardias = await query(
      `SELECT * FROM rrhh_guardias WHERE fecha LIKE ? ORDER BY fecha ASC`,
      [`${year}%`]
    );
    return NextResponse.json({ ok: true, guardias });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// POST /api/rrhh/guardias — crear guardia con slots por defecto
export async function POST(req: NextRequest) {
  const check = await requirePermiso("rrhh_guardias");
  if ("error" in check) return check.error;

  try {
    const body = await req.json();
    const { fecha, tipo } = body as { fecha: string; tipo?: string };

    if (!fecha) {
      return NextResponse.json({ ok: false, error: "fecha requerida" }, { status: 400 });
    }

    // Determinar tipo si no se pasa: sábado=lab, domingo=fest
    let tipoFinal = tipo;
    if (!tipoFinal) {
      const dow = new Date(fecha).getDay();
      tipoFinal = dow === 0 ? "fest" : "lab";
    }

    // Insertar guardia
    const result = await db.execute({
      sql: `INSERT OR IGNORE INTO rrhh_guardias (fecha, tipo) VALUES (?, ?)`,
      args: [fecha, tipoFinal],
    });

    // Obtener id de la guardia
    const guardias = await query<{ id: number }>(
      `SELECT id FROM rrhh_guardias WHERE fecha = ?`,
      [fecha]
    );
    const guardiaId = guardias[0]?.id;

    if (!guardiaId) {
      return NextResponse.json({ ok: false, error: "No se pudo crear la guardia" }, { status: 500 });
    }

    // Insertar slots desde defaults (solo si no existen)
    const defaults = await query<{ empleado_id: string; hora_inicio: number; hora_fin: number }>(
      `SELECT gd.empleado_id, gd.hora_inicio, gd.hora_fin
       FROM rrhh_guardia_defaults gd
       JOIN rrhh_empleados e ON e.id = gd.empleado_id
       WHERE e.activo = 1 AND e.hace_guardia = 1`
    );

    for (const slot of defaults) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO rrhh_guardia_slots (guardia_id, empleado_id, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)`,
        args: [guardiaId, slot.empleado_id, slot.hora_inicio, slot.hora_fin],
      });
    }

    return NextResponse.json({ ok: true, guardiaId, rowsAffected: result.rowsAffected });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
