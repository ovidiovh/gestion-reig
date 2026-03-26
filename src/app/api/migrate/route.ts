import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS retiradas_sesion (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha         TEXT NOT NULL,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        usuario       TEXT NOT NULL DEFAULT 'ovidio',
        total_cajas   REAL NOT NULL DEFAULT 0,
        total_audit   REAL,
        destino       TEXT NOT NULL DEFAULT 'caja_fuerte',
        auditada      INTEGER NOT NULL DEFAULT 0,
        remesa_id     INTEGER,
        notas         TEXT
      );

      CREATE TABLE IF NOT EXISTS retiradas_caja (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        sesion_id     INTEGER NOT NULL REFERENCES retiradas_sesion(id),
        num_caja      INTEGER NOT NULL CHECK(num_caja BETWEEN 1 AND 10),
        b200          INTEGER NOT NULL DEFAULT 0,
        b100          INTEGER NOT NULL DEFAULT 0,
        b50           INTEGER NOT NULL DEFAULT 0,
        b20           INTEGER NOT NULL DEFAULT 0,
        b10           INTEGER NOT NULL DEFAULT 0,
        b5            INTEGER NOT NULL DEFAULT 0,
        total         REAL NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(sesion_id, num_caja)
      );

      CREATE TABLE IF NOT EXISTS retiradas_audit (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        sesion_id     INTEGER NOT NULL UNIQUE REFERENCES retiradas_sesion(id),
        b200          INTEGER NOT NULL DEFAULT 0,
        b100          INTEGER NOT NULL DEFAULT 0,
        b50           INTEGER NOT NULL DEFAULT 0,
        b20           INTEGER NOT NULL DEFAULT 0,
        b10           INTEGER NOT NULL DEFAULT 0,
        b5            INTEGER NOT NULL DEFAULT 0,
        total         REAL NOT NULL DEFAULT 0,
        cuadra        INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS retiradas_remesa (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        total         REAL NOT NULL DEFAULT 0,
        estado        TEXT NOT NULL DEFAULT 'pendiente',
        confirmada_at TEXT,
        email_subject TEXT,
        notas         TEXT
      );
    `);

    // Migración incremental: añadir remesa_id si no existe
    try {
      await db.execute("ALTER TABLE retiradas_sesion ADD COLUMN remesa_id INTEGER");
    } catch {
      // Ya existe, ignorar
    }

    return NextResponse.json({ ok: true, message: "Tablas creadas/actualizadas correctamente" });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
