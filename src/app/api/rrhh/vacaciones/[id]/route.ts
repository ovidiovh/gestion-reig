import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";
import { insertAuditLog } from "@/lib/audit";

// PUT /api/rrhh/vacaciones/[id] — actualizar estado
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requirePermiso("rrhh_vacaciones");
  if ("error" in check) return check.error;

  try {
    const { id } = await params;
    const { estado } = await req.json() as { estado: string };

    await db.execute({
      sql: `UPDATE rrhh_vacaciones SET estado = ? WHERE id = ?`,
      args: [estado, id],
    });

    await insertAuditLog({
      usuario_email: check.user.email,
      usuario_nombre: check.user.nombre ?? "",
      accion: "modificar",
      modulo: "rrhh_vacaciones",
      detalle: `Vacaciones id=${id}, estado cambiado a "${estado}"`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// DELETE /api/rrhh/vacaciones/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requirePermiso("rrhh_vacaciones");
  if ("error" in check) return check.error;

  try {
    const { id } = await params;
    await db.execute({ sql: `DELETE FROM rrhh_vacaciones WHERE id = ?`, args: [id] });

    await insertAuditLog({
      usuario_email: check.user.email,
      usuario_nombre: check.user.nombre ?? "",
      accion: "eliminar",
      modulo: "rrhh_vacaciones",
      detalle: `Vacaciones id=${id} eliminadas`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
