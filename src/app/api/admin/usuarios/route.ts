import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { insertAuditLog } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/usuarios
 * Lista todos los usuarios con su último login y estadísticas de page views.
 */
export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const result = await db.execute({
      sql: `SELECT
              u.email,
              u.nombre,
              u.role,
              u.departamento,
              u.activo,
              u.last_login,
              u.created_at,
              COALESCE(pv.total_views, 0) AS total_views,
              pv.ultima_visita,
              COALESCE(pv.dias_activo, 0) AS dias_activo
            FROM usuarios u
            LEFT JOIN (
              SELECT
                usuario_email,
                COUNT(*) AS total_views,
                MAX(timestamp) AS ultima_visita,
                COUNT(DISTINCT DATE(timestamp)) AS dias_activo
              FROM page_views
              GROUP BY usuario_email
            ) pv ON pv.usuario_email = u.email
            ORDER BY u.role DESC, u.nombre ASC`,
      args: [],
    });

    return NextResponse.json({ ok: true, usuarios: result.rows });
  } catch (err) {
    console.error("[admin/usuarios GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/usuarios
 * Body: { email: string, campo: "role"|"departamento"|"activo", valor: string|number }
 * Modifica un campo del usuario.
 */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const { email, campo, valor } = body;

    const camposPermitidos = ["role", "departamento", "activo"];
    if (!email || !campo || valor === undefined || !camposPermitidos.includes(campo)) {
      return NextResponse.json(
        { error: `Campo inválido. Permitidos: ${camposPermitidos.join(", ")}` },
        { status: 400 }
      );
    }

    // No permitir que un admin se desactive a sí mismo
    if (campo === "activo" && valor === 0 && email === admin.email) {
      return NextResponse.json(
        { error: "No puedes desactivarte a ti mismo" },
        { status: 400 }
      );
    }

    // No permitir que un admin se quite el rol de admin a sí mismo
    if (campo === "role" && valor !== "admin" && email === admin.email) {
      return NextResponse.json(
        { error: "No puedes quitarte el rol de admin a ti mismo" },
        { status: 400 }
      );
    }

    await db.execute({
      sql: `UPDATE usuarios SET ${campo} = ? WHERE email = ?`,
      args: [valor, email],
    });

    await insertAuditLog({
      usuario_email: admin.email,
      usuario_nombre: admin.nombre,
      accion: "modificar_usuario",
      modulo: "admin",
      detalle: `${email}: ${campo} → ${valor}`,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
}
