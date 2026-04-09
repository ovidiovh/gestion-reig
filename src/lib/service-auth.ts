/**
 * Autenticación service-to-service con JWT (HS256).
 *
 * Permite que scripts locales (cargar_pipeline.py, disparar_precalculos.py,
 * sync_turso.py, etc.) llamen a endpoints protegidos del CRM sin necesitar
 * una sesión de Auth.js / Google OAuth.
 *
 * Flujo:
 * 1. El script Python genera un JWT firmado con REIG_SERVICE_SECRET (HS256),
 *    con claims: sub="reig-pipeline", iat, exp (5 min).
 * 2. Lo envía como header `Authorization: Bearer <jwt>`.
 * 3. Este módulo verifica la firma y el exp. Si OK, devuelve un UserSession
 *    virtual con role="admin" para que pase por requirePermiso() sin fricciones.
 *
 * Seguridad:
 * - El secreto NUNCA se comparte fuera de Vercel env + .env.local del dev.
 * - El token expira en 5 min → si se filtra no sirve de mucho.
 * - El sub "reig-pipeline" queda registrado en audit_log como actor.
 * - Si REIG_SERVICE_SECRET no está definida, el mecanismo se desactiva.
 */

import { jwtVerify } from "jose";
import type { UserSession } from "./auth";

const SERVICE_SECRET = process.env.REIG_SERVICE_SECRET;

/** Usuario virtual que representa al pipeline automatizado. */
const PIPELINE_USER: UserSession = {
  email: "pipeline@farmacia-reig.local",
  nombre: "Pipeline Automático",
  role: "admin",
  departamento: "ambos",
  activo: 1,
};

/**
 * Intenta extraer un service token del header Authorization de un Request.
 * Devuelve el UserSession virtual si el JWT es válido, null en caso contrario.
 *
 * Uso en API routes:
 *
 *   import { verificarServiceToken } from "@/lib/service-auth";
 *
 *   // Dentro del handler:
 *   const serviceUser = await verificarServiceToken(req);
 *   if (serviceUser) {
 *     // Autenticado como pipeline — saltar requirePermiso
 *   }
 */
export async function verificarServiceToken(
  req: Request
): Promise<UserSession | null> {
  // Si no hay secreto configurado, el mecanismo está desactivado
  if (!SERVICE_SECRET) return null;

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(SERVICE_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    // Verificar que el subject es el esperado
    if (payload.sub !== "reig-pipeline") return null;

    return PIPELINE_USER;
  } catch {
    // Token inválido, expirado, firma incorrecta — silencio
    return null;
  }
}
