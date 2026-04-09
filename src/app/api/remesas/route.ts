import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";
import { insertAuditLog } from "@/lib/audit";

// GET — listar remesas
export async function GET(req: NextRequest) {
  const check = await requirePermiso("financiero_retiradas");
  if ("error" in check) return check.error;

  try {
    const estado = req.nextUrl.searchParams.get("estado"); // pendiente | confirmada | null=todas
    let sql = `SELECT r.*,
      (SELECT COUNT(*) FROM retiradas_sesion s WHERE s.remesa_id = r.id) as num_sesiones
      FROM retiradas_remesa r`;
    const args: string[] = [];

    if (estado) {
      sql += " WHERE r.estado = ?";
      args.push(estado);
    }
    sql += " ORDER BY r.created_at DESC LIMIT 100";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ ok: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// POST — crear remesa agrupando sesiones
export async function POST(req: NextRequest) {
  const check = await requirePermiso("financiero_retiradas");
  if ("error" in check) return check.error;

  try {
    const { sesion_ids } = (await req.json()) as { sesion_ids: number[] };

    if (!sesion_ids || sesion_ids.length === 0) {
      return NextResponse.json({ ok: false, error: "Faltan sesiones" }, { status: 400 });
    }

    // Verificar que todas las sesiones existen, están en caja_fuerte y no tienen remesa
    const placeholders = sesion_ids.map(() => "?").join(",");
    const sesiones = await db.execute({
      sql: `SELECT id, destino, remesa_id, total_cajas FROM retiradas_sesion WHERE id IN (${placeholders})`,
      args: sesion_ids,
    });

    if (sesiones.rows.length !== sesion_ids.length) {
      return NextResponse.json({ ok: false, error: "Alguna sesión no existe" }, { status: 400 });
    }

    for (const s of sesiones.rows) {
      if (s.destino !== "caja_fuerte") {
        return NextResponse.json(
          { ok: false, error: `Sesión ${s.id} ya tiene destino: ${s.destino}` },
          { status: 400 }
        );
      }
      if (s.remesa_id) {
        return NextResponse.json(
          { ok: false, error: `Sesión ${s.id} ya pertenece a remesa ${s.remesa_id}` },
          { status: 400 }
        );
      }
    }

    // Calcular total
    const total = sesiones.rows.reduce((sum, s) => sum + Number(s.total_cajas), 0);

    // Crear remesa
    const res = await db.execute({
      sql: "INSERT INTO retiradas_remesa (total) VALUES (?)",
      args: [total],
    });
    const remesaId = Number(res.lastInsertRowid);

    // Asignar sesiones a la remesa y cambiar destino a banco
    for (const id of sesion_ids) {
      await db.execute({
        sql: "UPDATE retiradas_sesion SET remesa_id = ?, destino = 'banco' WHERE id = ?",
        args: [remesaId, id],
      });
    }

    await insertAuditLog({
      usuario_email: check.user.email,
      usuario_nombre: check.user.nombre ?? "",
      accion: "crear",
      modulo: "remesas",
      detalle: `Remesa id=${remesaId}, total=${total}€, sesiones=${sesion_ids.length}`,
    });

    return NextResponse.json({ ok: true, remesa_id: remesaId, total, sesiones: sesion_ids.length });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// PATCH — confirmar remesa (cuando llega email del banco)
export async function PATCH(req: NextRequest) {
  const check = await requirePermiso("financiero_retiradas");
  if ("error" in check) return check.error;

  try {
    const { id, email_subject } = (await req.json()) as {
      id: number;
      email_subject?: string;
    };

    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta ID de remesa" }, { status: 400 });
    }

    const remesa = await db.execute({
      sql: "SELECT id, estado FROM retiradas_remesa WHERE id = ?",
      args: [id],
    });

    if (remesa.rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Remesa no encontrada" }, { status: 404 });
    }

    if (remesa.rows[0].estado === "confirmada") {
      return NextResponse.json({ ok: false, error: "Remesa ya confirmada" }, { status: 400 });
    }

    await db.execute({
      sql: "UPDATE retiradas_remesa SET estado = 'confirmada', confirmada_at = datetime('now'), email_subject = ? WHERE id = ?",
      args: [email_subject || null, id],
    });

    await insertAuditLog({
      usuario_email: check.user.email,
      usuario_nombre: check.user.nombre ?? "",
      accion: "modificar",
      modulo: "remesas",
      detalle: `Remesa id=${id} confirmada${email_subject ? `, email: ${email_subject}` : ""}`,
    });

    return NextResponse.json({ ok: true, id, estado: "confirmada" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
