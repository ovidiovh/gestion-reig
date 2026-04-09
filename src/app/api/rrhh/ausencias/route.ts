import { query, db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";

// GET /api/rrhh/ausencias?year=2026&empleado_id=xxx&mes=2026-04
export async function GET(req: NextRequest) {
  const check = await requirePermiso("rrhh_vacaciones");
  if ("error" in check) return check.error;

  try {
    const year = req.nextUrl.searchParams.get("year");
    const empId = req.nextUrl.searchParams.get("empleado_id");
    const mes = req.nextUrl.searchParams.get("mes"); // formato YYYY-MM

    const where: string[] = [];
    const args: (string | number)[] = [];

    if (empId) {
      where.push("a.empleado_id = ?");
      args.push(empId);
    }
    if (year) {
      where.push("(a.fecha_inicio LIKE ? OR a.fecha_fin LIKE ?)");
      args.push(`${year}%`, `${year}%`);
    }
    if (mes) {
      // solapa con el mes
      where.push("a.fecha_inicio <= ? AND a.fecha_fin >= ?");
      const ultimoDia = `${mes}-31`;
      const primerDia = `${mes}-01`;
      args.push(ultimoDia, primerDia);
    }

    const sql = `
      SELECT a.id, a.empleado_id, a.fecha_inicio, a.fecha_fin,
             a.hora_inicio, a.hora_fin, a.tipo, a.estado,
             a.retribuida, a.bolsa_id, a.banco_horas_id, a.notas,
             a.created_at,
             e.nombre, e.farmaceutico, e.empresa
      FROM rrhh_ausencias a
      JOIN rrhh_empleados e ON e.id = a.empleado_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY a.fecha_inicio ASC
    `;

    const ausencias = await query(sql, args);
    return NextResponse.json({ ok: true, ausencias });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// POST /api/rrhh/ausencias
export async function POST(req: NextRequest) {
  const check = await requirePermiso("rrhh_vacaciones");
  if ("error" in check) return check.error;

  try {
    const body = await req.json();
    const {
      empleado_id,
      fecha_inicio,
      fecha_fin,
      hora_inicio,
      hora_fin,
      tipo,
      estado,
      retribuida,
      bolsa_id,
      banco_horas_id,
      notas,
    } = body as {
      empleado_id: string;
      fecha_inicio: string;
      fecha_fin: string;
      hora_inicio?: number | null;
      hora_fin?: number | null;
      tipo?: string;
      estado?: string;
      retribuida?: number | boolean;
      bolsa_id?: number | null;
      banco_horas_id?: number | null;
      notas?: string | null;
    };

    if (!empleado_id || !fecha_inicio || !fecha_fin) {
      return NextResponse.json(
        { ok: false, error: "empleado_id, fecha_inicio y fecha_fin son requeridos" },
        { status: 400 }
      );
    }

    const retribuidaVal =
      retribuida == null ? 1 : Number(Boolean(retribuida));

    const result = await db.execute({
      sql: `INSERT INTO rrhh_ausencias
              (empleado_id, fecha_inicio, fecha_fin, hora_inicio, hora_fin,
               tipo, estado, retribuida, bolsa_id, banco_horas_id, notas)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        empleado_id,
        fecha_inicio,
        fecha_fin,
        hora_inicio ?? null,
        hora_fin ?? null,
        tipo || "vac",
        estado || "pend",
        retribuidaVal,
        bolsa_id ?? null,
        banco_horas_id ?? null,
        notas ?? null,
      ],
    });

    const rows = await query(
      `SELECT * FROM rrhh_ausencias WHERE id = ?`,
      [Number(result.lastInsertRowid)]
    );
    return NextResponse.json({ ok: true, ausencia: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// PATCH /api/rrhh/ausencias?id=xxx — actualizar (estado, notas, fechas, tipo...)
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
      "fecha_inicio",
      "fecha_fin",
      "hora_inicio",
      "hora_fin",
      "tipo",
      "estado",
      "retribuida",
      "bolsa_id",
      "banco_horas_id",
      "notas",
    ] as const;

    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = ?`);
        let v = body[key];
        if (key === "retribuida" && v != null) v = Number(Boolean(v));
        args.push(v ?? null);
      }
    }
    if (sets.length === 0) {
      return NextResponse.json({ ok: false, error: "Nada que actualizar" }, { status: 400 });
    }
    args.push(Number(id));

    await db.execute({
      sql: `UPDATE rrhh_ausencias SET ${sets.join(", ")} WHERE id = ?`,
      args,
    });

    const rows = await query(`SELECT * FROM rrhh_ausencias WHERE id = ?`, [Number(id)]);
    return NextResponse.json({ ok: true, ausencia: rows[0] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// DELETE /api/rrhh/ausencias?id=xxx
export async function DELETE(req: NextRequest) {
  const check = await requirePermiso("rrhh_vacaciones");
  if ("error" in check) return check.error;

  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }
    await db.execute({
      sql: `DELETE FROM rrhh_ausencias WHERE id = ?`,
      args: [Number(id)],
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
