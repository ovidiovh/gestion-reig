import { getTurso } from "@/lib/db";

export interface Usuario {
  email: string;
  nombre: string;
  role: "admin" | "usuario";
  departamento: "farmacia" | "optica" | "ambos";
  activo: number;
  created_at: string;
  last_login: string | null;
}

/**
 * Obtiene un usuario por email desde Turso
 */
export async function getUsuario(email: string): Promise<Usuario | null> {
  const db = getTurso();
  try {
    const result = await db.execute({
      sql: "SELECT * FROM usuarios WHERE email = ?",
      args: [email.toLowerCase()],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as Usuario;
  } catch {
    // Tabla puede no existir aún — devolver null
    console.warn("[usuarios] Error consultando usuario:", email);
    return null;
  }
}

/**
 * Registra el último login de un usuario
 */
export async function registrarLogin(email: string): Promise<void> {
  const db = getTurso();
  try {
    await db.execute({
      sql: "UPDATE usuarios SET last_login = datetime('now') WHERE email = ?",
      args: [email.toLowerCase()],
    });
  } catch {
    // Silencioso si falla — no bloquear login por esto
  }
}

/**
 * Lista todos los usuarios activos
 */
export async function listarUsuarios(): Promise<Usuario[]> {
  const db = getTurso();
  const result = await db.execute(
    "SELECT * FROM usuarios WHERE activo = 1 ORDER BY role DESC, nombre ASC"
  );
  return result.rows as unknown as Usuario[];
}

/**
 * Comprueba si un email tiene rol admin
 */
export async function esAdmin(email: string): Promise<boolean> {
  const usuario = await getUsuario(email);
  return usuario?.role === "admin" && usuario?.activo === 1;
}

/**
 * Da de alta un usuario nuevo en la tabla usuarios.
 * El email DEBE ser @farmaciareig.net.
 * Devuelve true si se creó, false si ya existía.
 */
export async function crearUsuario(data: {
  email: string;
  nombre: string;
  role: "admin" | "usuario";
  departamento: "farmacia" | "optica" | "ambos";
}): Promise<{ ok: boolean; msg: string }> {
  const email = data.email.toLowerCase().trim();
  if (!email.endsWith("@farmaciareig.net")) {
    return { ok: false, msg: "Solo se permiten emails @farmaciareig.net" };
  }

  const existente = await getUsuario(email);
  if (existente) {
    return { ok: false, msg: `El usuario ${email} ya existe` };
  }

  const db = getTurso();
  await db.execute({
    sql: `INSERT INTO usuarios (email, nombre, role, departamento, activo, created_at)
          VALUES (?, ?, ?, ?, 1, datetime('now'))`,
    args: [email, data.nombre.trim(), data.role, data.departamento],
  });

  return { ok: true, msg: `Usuario ${email} creado correctamente` };
}
