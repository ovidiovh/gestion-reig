import { db } from "@/lib/db";

export type AuditModulo = "retiradas" | "ingresos" | "remesas" | "rrhh" | "rrhh_guardias" | "rrhh_vacaciones" | "rrhh_equipo" | "rrhh_nominas" | "crm" | "admin" | "usuarios";

/**
 * Inserta un registro en audit_log de forma no bloqueante.
 * Los errores se tragan para no romper el flujo principal.
 */
export async function insertAuditLog(params: {
  usuario_email: string;
  usuario_nombre: string;
  accion: string;      // "crear" | "modificar" | "eliminar" | custom
  modulo: AuditModulo;
  detalle?: string;
}): Promise<void> {
  try {
    await db.execute({
      sql: `INSERT INTO audit_log (usuario_email, usuario_nombre, accion, modulo, detalle, fecha)
            VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        params.usuario_email,
        params.usuario_nombre,
        params.accion,
        params.modulo,
        params.detalle ?? null,
      ],
    });
  } catch (err) {
    console.error("[audit] insertAuditLog failed:", err);
  }
}
