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

    // Migración: añadir origen (farmacia/optica) a sesiones
    try {
      await db.execute("ALTER TABLE retiradas_sesion ADD COLUMN origen TEXT NOT NULL DEFAULT 'farmacia'");
    } catch {
      // Ya existe, ignorar
    }

    // Migración CHECK constraint de retiradas_caja:
    //   v1: CHECK(1-10) — original
    //   v2: CHECK(1-11) — añadió óptica como caja 11
    //   v3: CHECK(0-12) — corrección real: caja 0 (cambio), 1-9 (farmacia),
    //       11 (ortopedia), 12 (óptica). La 10 no existe pero el CHECK
    //       admite el rango completo 0-12 por simplicidad.
    try {
      // Verificamos si caja 12 se puede insertar (si falla = CHECK aún es 1-11 o 1-10)
      await db.execute("INSERT INTO retiradas_caja (sesion_id, num_caja, total) VALUES (-1, 12, 0)");
      await db.execute("DELETE FROM retiradas_caja WHERE sesion_id = -1");
      // También probar caja 0
      await db.execute("INSERT INTO retiradas_caja (sesion_id, num_caja, total) VALUES (-1, 0, 0)");
      await db.execute("DELETE FROM retiradas_caja WHERE sesion_id = -1");
    } catch {
      // CHECK constraint falla → recrear tabla con rango 0-12
      await db.executeMultiple(`
        CREATE TABLE IF NOT EXISTS retiradas_caja_new (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          sesion_id     INTEGER NOT NULL REFERENCES retiradas_sesion(id),
          num_caja      INTEGER NOT NULL CHECK(num_caja BETWEEN 0 AND 12),
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
        INSERT INTO retiradas_caja_new (id, sesion_id, num_caja, b200, b100, b50, b20, b10, b5, total, created_at)
          SELECT id, sesion_id, num_caja, b200, b100, b50, b20, b10, b5, total, created_at FROM retiradas_caja;
        DROP TABLE retiradas_caja;
        ALTER TABLE retiradas_caja_new RENAME TO retiradas_caja;
      `);
    }

    return NextResponse.json({ ok: true, message: "Tablas creadas/actualizadas correctamente" });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
