import { query, db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";

// GET /api/rrhh/bolsa-vacaciones?empleado_id=xxx
// GET /api/rrhh/bolsa-vacaciones?empleado_id=xxx&estado=activa
export async function GET(req: NextRequest) {
  const check = await requirePermiso("rrhh_vacaciones");
  if ("error" in check) return check.error;

  try {
    const empId = req.nextUrl.searchParams.get("empleado_id");
    const estado = req.nextUrl.searchParams.get("estado");

    const where: string[] = [];
    const args: (string | number)[] = [];
    if (empId) {
      where.push("b.empleado_id = ?");
      args.push(empId);
    }
    if (estado) {
      where.push("b.estado = ?");
      args.push(estado);
    }

    const sql = `
      SELECT b.id, b.empleado_id, b.anio_origen, b.dias, b.dias_usados,
             b.motivo, b.estado, b.caduca_en, b.notas, b.created_at,
             e.nombre, e.farmaceutico, e.empresa
      FROM rrhh_bolsa_vacaciones b
      JOIN rrhh_empleados e ON e.id = b.empleado_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY b.anio_origen ASC, b.id ASC
    `;

    const bolsas = await query(sql, args);
    return NextResponse.json({ ok: true, bolsas });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// POST /api/rrhh/bolsa-vacaciones — crear entrada manual de arrastre (art. 38.3 ET)
export async function POST(req: NextRequest) {
  const check = await requirePermiso("rrhh_vacaciones");
  if ("error" in check) return check.error;

  try {
    const { empleado_id, anio_origen, dias, motivo, caduca_en, notas } =
      (await req.json()) as {
        empleado_id: string;
        anio_origen: number;
        dias: number;
        motivo?: string;
        caduca_en?: string | null;
        notas?: string | null;
      };

    if (!empleado_id || !anio_origen || dias == null) {
      return NextResponse.json(
        { ok: false, error: "empleado_id, anio_origen y dias son requeridos" },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: `INSERT INTO rrhh_bolsa_vacaciones
              (empleado_id, anio_origen, dias, dias_usados, motivo, estado, caduca_en, notas)
            VALUES (?, ?, ?, 0, ?, 'activa', ?, ?)`,
      args: [
        empleado_id,
        anio_origen,
        dias,
        motivo ?? "arrastre",
        caduca_en ?? null,
        notas ?? null,
      ],
    });

    const rows = await query(
      `SELECT * FROM rrhh_bolsa_vacaciones WHERE id = ?`,
      [Number(result.lastInsertRowid)]
    );
    return NextResponse.json({ ok: true, bolsa: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// PATCH /api/rrhh/bolsa-vacaciones?id=xxx — actualizar dias_usados, estado, notas, caduca_en
export async function PATCH(req: NextRequest) {
  const check = await requirePermiso("rrhh_vacaciones");
  if ("error" in check) return check.error;

  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }
    const body = await req.json();
    const allowed = [
      "dias",
      "dias_usados",
      "motivo",
      "estado",
      "caduca_en",
      "notas",
    ] as const;

    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = ?`);
        args.push(body[key] ?? null);
      }
    }
    if (sets.length === 0) {
      return NextResponse.json({ ok: false, error: "Nada que actualizar" }, { status: 400 });
    }
    args.push(Number(id));

    await db.execute({
      sql: `UPDATE rrhh_bolsa_vacaciones SET ${sets.join(", ")} WHERE id = ?`,
      args,
    });

    const rows = await query(
      `SELECT * FROM rrhh_bolsa_vacaciones WHERE id = ?`,
      [Number(id)]
    );
    return NextResponse.json({ ok: true, bolsa: rows[0] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// DELETE /api/rrhh/bolsa-vacaciones?id=xxx
export async function DELETE(req: NextRequest) {
  const check = await requirePermiso("rrhh_vacaciones");
  if ("error" in check) return check.error;

  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }
    await db.execute({
      sql: `DELETE FROM rrhh_bolsa_vacaciones WHERE id = ?`,
      args: [Number(id)],
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
