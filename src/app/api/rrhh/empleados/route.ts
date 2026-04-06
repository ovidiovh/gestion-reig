import { query, db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/rrhh/empleados?incluir_inactivos=1&para=vacaciones|nomina|planning
//
// Variantes:
//   - (sin params)                → solo `activo = 1` (planning por defecto, retrocompatible).
//   - incluir_inactivos=1         → todos los empleados sin filtro.
//   - para=vacaciones             → activo = 1 OR incluir_vacaciones = 1 (incluye Tere/Dolores).
//   - para=nomina                 → incluir_en_nomina = 1 (tabla del módulo de nóminas).
//   - para=planning               → equivalente al default (activo = 1).
//
// Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §3 sobre la distinción
// entre "activo en planning", "activo en vacaciones" y "activo en nómina".
export async function GET(req: NextRequest) {
  try {
    const incluirInactivos = req.nextUrl.searchParams.get("incluir_inactivos") === "1";
    const para = req.nextUrl.searchParams.get("para");

    let whereClause: string;
    if (incluirInactivos) {
      whereClause = "";
    } else if (para === "vacaciones") {
      whereClause = "WHERE activo = 1 OR incluir_vacaciones = 1";
    } else if (para === "nomina") {
      whereClause = "WHERE incluir_en_nomina = 1";
    } else {
      // planning por defecto
      whereClause = "WHERE activo = 1";
    }

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
      complemento_mensual_eur = 0, h_lab_complemento_mensual = 0, orden = 99,
      departamento = "farmacia",
    } = body as {
      id: string; nombre: string; categoria?: string; empresa?: string;
      farmaceutico?: number; hace_guardia?: number;
      complemento_mensual_eur?: number; h_lab_complemento_mensual?: number; orden?: number;
      departamento?: string;
    };

    if (!id || !nombre) {
      return NextResponse.json({ ok: false, error: "id y nombre son obligatorios" }, { status: 400 });
    }

    await db.execute({
      sql: `INSERT INTO rrhh_empleados
            (id, nombre, categoria, empresa, farmaceutico, hace_guardia, complemento_mensual_eur, h_lab_complemento_mensual, orden, activo, departamento)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      args: [id, nombre, categoria, empresa, farmaceutico, hace_guardia, complemento_mensual_eur, h_lab_complemento_mensual, orden, departamento],
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

    const allowed = [
      "nombre", "categoria", "empresa", "farmaceutico", "hace_guardia", "cubre_nocturna",
      "complemento_mensual_eur", "h_lab_complemento_mensual", "activo", "orden", "guardias_manual", "departamento",
      "horario_inicio_a", "horario_fin_a", "horario_inicio_b", "horario_fin_b",
      // Campos del módulo de nóminas (ver REIG-BASE nominas-rrhh.md §3–§5 y §9)
      "nombre_formal_nomina", "tipo_calculo",
      "h_extras_fijas_mes", "h_extras_fijas_semana", "h_extra_diaria",
      "descuenta_media_en_guardia", "incluir_en_nomina", "incluir_vacaciones",
    ];
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
