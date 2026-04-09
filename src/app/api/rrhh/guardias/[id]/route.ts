import { query, db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePermiso } from "@/lib/auth";

// GET /api/rrhh/guardias/[id] — guardia + slots + empleados
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAuth();
  if ("error" in check) return check.error;

  try {
    const { id } = await params;

    const guardias = await query<{ id: number; fecha: string; tipo: string; publicada: number; notas: string | null }>(
      `SELECT * FROM rrhh_guardias WHERE id = ?`,
      [id]
    );

    if (!guardias.length) {
      return NextResponse.json({ ok: false, error: "Guardia no encontrada" }, { status: 404 });
    }

    const guardia = guardias[0];

    const slots = await query(
      `SELECT gs.*, e.nombre, e.farmaceutico, e.empresa
       FROM rrhh_guardia_slots gs
       JOIN rrhh_empleados e ON e.id = gs.empleado_id
       WHERE gs.guardia_id = ?
       ORDER BY e.orden ASC`,
      [guardia.id]
    );

    return NextResponse.json({ ok: true, guardia, slots });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// PUT /api/rrhh/guardias/[id] — actualizar tipo/publicada/notas y slots
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requirePermiso("rrhh_guardias");
  if ("error" in check) return check.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const { tipo, publicada, notas, slots } = body as {
      tipo?: string;
      publicada?: number;
      notas?: string;
      slots?: Array<{ empleado_id: string; hora_inicio: number; hora_fin: number; hora_inicio2?: number | null; hora_fin2?: number | null }>;
    };

    // Actualizar guardia
    if (tipo !== undefined || publicada !== undefined || notas !== undefined) {
      const updates: string[] = [];
      const args: (string | number | null)[] = [];

      if (tipo !== undefined)     { updates.push("tipo = ?");     args.push(tipo); }
      if (publicada !== undefined){ updates.push("publicada = ?");args.push(publicada); }
      if (notas !== undefined)    { updates.push("notas = ?");    args.push(notas); }

      args.push(id);
      await db.execute({ sql: `UPDATE rrhh_guardias SET ${updates.join(", ")} WHERE id = ?`, args });
    }

    // Actualizar slots
    if (slots && slots.length > 0) {
      for (const slot of slots) {
        await db.execute({
          sql: `INSERT INTO rrhh_guardia_slots (guardia_id, empleado_id, hora_inicio, hora_fin, hora_inicio2, hora_fin2)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(guardia_id, empleado_id) DO UPDATE SET
                  hora_inicio  = excluded.hora_inicio,
                  hora_fin     = excluded.hora_fin,
                  hora_inicio2 = excluded.hora_inicio2,
                  hora_fin2    = excluded.hora_fin2`,
          args: [id, slot.empleado_id, slot.hora_inicio, slot.hora_fin,
                 slot.hora_inicio2 ?? null, slot.hora_fin2 ?? null],
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
