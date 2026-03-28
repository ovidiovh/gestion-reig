import { query, db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/rrhh/empleados?incluir_inactivos=1
export async function GET(req: NextRequest) {
  try {
    const incluirInactivos = req.nextUrl.searchParams.get("incluir_inactivos") === "1";
    const whereClause = incluirInactivos ? "" : "WHERE activo = 1";
    const empleados = await query(
      `SELECT * FROM rrhh_empleados ${whereClause} ORDER BY orden ASC`
    );
    return NextResponse.json({ ok: true, empleados });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// POST /api/rrhh/empleados — crear nuevo empleado
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id, nombre, categoria = "auxiliar", empresa = "reig",
      farmaceutico = 0, hace_guardia = 0,
      complemento_eur = 0, h_lab_complemento = 0, orden = 99,
    } = body as {
      id: string; nombre: string; categoria?: string; empresa?: string;
      farmaceutico?: number; hace_guardia?: number;
      complemento_eur?: number; h_lab_complemento?: number; orden?: number;
    };

    if (!id || !nombre) {
      return NextResponse.json({ ok: false, error: "id y nombre son obligatorios" }, { status: 400 });
    }

    await db.execute({
      sql: `INSERT INTO rrhh_empleados
            (id, nombre, categoria, empresa, farmaceutico, hace_guardia, complemento_eur, h_lab_complemento, orden, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      args: [id, nombre, categoria, empresa, farmaceutico, hace_guardia, complemento_eur, h_lab_complemento, orden],
    });

    const rows = await query(`SELECT * FROM rrhh_empleados WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true, empleado: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// PATCH /api/rrhh/empleados — actualizar campos de un empleado (id en body)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...fields } = body as Record<string, string | number | null>;

    if (!id) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }

    const allowed = ["nombre", "categoria", "empresa", "farmaceutico", "hace_guardia",
                     "complemento_eur", "h_lab_complemento", "activo", "orden"];
    const updates = Object.entries(fields).filter(([k]) => allowed.includes(k));

    if (updates.length === 0) {
      return NextResponse.json({ ok: false, error: "Sin campos a actualizar" }, { status: 400 });
    }

    const setClauses = updates.map(([k]) => `${k} = ?`).join(", ");
    const args: (string | number | null)[] = [...updates.map(([, v]) => v), id];

    await db.execute({
      sql: `UPDATE rrhh_empleados SET ${setClauses} WHERE id = ?`,
      args,
    });

    const rows = await query(`SELECT * FROM rrhh_empleados WHERE id = ?`, [String(id)]);
    return NextResponse.json({ ok: true, empleado: rows[0] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
