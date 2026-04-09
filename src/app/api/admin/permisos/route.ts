import { requireAdmin } from "@/lib/auth";
import { concederPermiso, revocarPermiso, listarTodosPermisos } from "@/lib/permisos";
import { insertAuditLog } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/permisos
 * Lista todos los permisos de todos los módulos.
 */
export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const permisos = await listarTodosPermisos();
    return NextResponse.json({ ok: true, permisos });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
}

/**
 * POST /api/admin/permisos
 * Body: { modulo: string, email: string }
 * Concede un permiso.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = await req.json();
    const { modulo, email } = body;

    if (!modulo || !email) {
      return NextResponse.json({ error: "Faltan modulo y email" }, { status: 400 });
    }

    const ok = await concederPermiso(modulo, email, user.email);

    await insertAuditLog({
      usuario_email: user.email,
      usuario_nombre: user.nombre,
      accion: "conceder_permiso",
      modulo: "admin",
      detalle: `Permiso ${modulo} → ${email}`,
    });

    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
}

/**
 * DELETE /api/admin/permisos
 * Body: { modulo: string, email: string }
 * Revoca un permiso.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = await req.json();
    const { modulo, email } = body;

    if (!modulo || !email) {
      return NextResponse.json({ error: "Faltan modulo y email" }, { status: 400 });
    }

    const ok = await revocarPermiso(modulo, email);

    await insertAuditLog({
      usuario_email: user.email,
      usuario_nombre: user.nombre,
      accion: "revocar_permiso",
      modulo: "admin",
      detalle: `Permiso ${modulo} → ${email} revocado`,
    });

    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
}
