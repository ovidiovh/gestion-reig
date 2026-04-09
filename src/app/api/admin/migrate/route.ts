import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/migrate
 *
 * Crea las tablas de administración:
 *   - page_views       → tracking de navegación por usuario
 *   - permisos_modulo  → whitelists dinámicas (sustituye arrays hardcodeados)
 *
 * Solo admin puede ejecutarla. Idempotente (IF NOT EXISTS).
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    await db.batch([
      // ── page_views: cada navegación de cada usuario ──
      {
        sql: `CREATE TABLE IF NOT EXISTS page_views (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_email TEXT NOT NULL,
          usuario_nombre TEXT NOT NULL DEFAULT '',
          ruta TEXT NOT NULL,
          modulo TEXT NOT NULL DEFAULT 'otro',
          timestamp TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        args: [],
      },
      // Índices para consultas habituales
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_pv_email ON page_views(usuario_email)`,
        args: [],
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_pv_timestamp ON page_views(timestamp)`,
        args: [],
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_pv_modulo ON page_views(modulo)`,
        args: [],
      },

      // ── permisos_modulo: whitelists dinámicas por módulo ──
      {
        sql: `CREATE TABLE IF NOT EXISTS permisos_modulo (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          modulo TEXT NOT NULL,
          email TEXT NOT NULL,
          concedido_por TEXT NOT NULL,
          fecha TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(modulo, email)
        )`,
        args: [],
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_pm_modulo ON permisos_modulo(modulo)`,
        args: [],
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_pm_email ON permisos_modulo(email)`,
        args: [],
      },

      // ── Seed: permisos explícitos para admins (Ovidio + Beatriz).
      //    Los admins ya tienen acceso implícito, pero los seedeamos para
      //    que aparezcan en la UI de permisos y sean gestionables. ──
      // Nota: INSERT OR IGNORE = idempotente, se puede re-ejecutar sin miedo.
      ...["financiero_retiradas", "financiero_historial", "financiero_ingresos",
          "marketing_crm", "marketing_clientes",
          "rrhh_calendario", "rrhh_equipo", "rrhh_nominas",
          "admin_panel"
      ].flatMap((modulo) => [
        {
          sql: `INSERT OR IGNORE INTO permisos_modulo (modulo, email, concedido_por)
                VALUES (?, 'ovidio@farmaciareig.net', 'migracion_auto')`,
          args: [modulo],
        },
        {
          sql: `INSERT OR IGNORE INTO permisos_modulo (modulo, email, concedido_por)
                VALUES (?, 'brs@farmaciareig.net', 'migracion_auto')`,
          args: [modulo],
        },
      ]),
    ]);

    return NextResponse.json({
      ok: true,
      tablas: ["page_views", "permisos_modulo"],
      indices: ["idx_pv_email", "idx_pv_timestamp", "idx_pv_modulo", "idx_pm_modulo", "idx_pm_email"],
      seed: "marketing_clientes (ovidio, brs) + admin_panel (ovidio, brs)",
    });
  } catch (err) {
    console.error("[admin/migrate]", err);
    return NextResponse.json(
      { error: "Error en migración", detalle: String(err) },
      { status: 500 }
    );
  }
}
