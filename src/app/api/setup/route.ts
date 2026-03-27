import { NextResponse } from "next/server";
import { getTurso } from "@/lib/db";

/**
 * POST /api/setup
 * Crea la tabla de usuarios y siembra los admins iniciales.
 * Solo se ejecuta una vez — es idempotente.
 */
export async function POST() {
  try {
    const db = getTurso();

    // Crear tabla usuarios (idempotente)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        email         TEXT PRIMARY KEY,
        nombre        TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'usuario',
        departamento  TEXT NOT NULL DEFAULT 'farmacia',
        activo        INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT DEFAULT (datetime('now')),
        last_login    TEXT
      )
    `);

    // Sembrar admins (INSERT OR IGNORE = no duplica si ya existen)
    await db.batch([
      {
        sql: `INSERT OR IGNORE INTO usuarios (email, nombre, role, departamento)
              VALUES (?, ?, ?, ?)`,
        args: ["ovidio@farmaciareig.net", "Ovidio Vidal Hernández", "admin", "ambos"],
      },
      {
        sql: `INSERT OR IGNORE INTO usuarios (email, nombre, role, departamento)
              VALUES (?, ?, ?, ?)`,
        args: ["brs@farmaciareig.net", "Beatriz Reig Schmidt", "admin", "ambos"],
      },
    ]);

    // Verificar
    const result = await db.execute("SELECT email, nombre, role, departamento FROM usuarios");

    return NextResponse.json({
      ok: true,
      mensaje: "Tabla usuarios creada/verificada",
      usuarios: result.rows,
    });
  } catch (error) {
    console.error("[setup] Error:", error);
    return NextResponse.json(
      { error: "Error en setup", detalle: String(error) },
      { status: 500 }
    );
  }
}
