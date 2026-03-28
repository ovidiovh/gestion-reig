import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const FESTIVOS_2026 = [
  { fecha: "2026-01-01", nombre: "Año Nuevo", tipo: "nacional" },
  { fecha: "2026-01-06", nombre: "Epifanía del Señor", tipo: "nacional" },
  { fecha: "2026-02-17", nombre: "Martes de Carnaval", tipo: "local" },
  { fecha: "2026-04-02", nombre: "Jueves Santo", tipo: "nacional" },
  { fecha: "2026-04-03", nombre: "Viernes Santo", tipo: "nacional" },
  { fecha: "2026-05-01", nombre: "Día del Trabajo", tipo: "nacional" },
  { fecha: "2026-05-30", nombre: "Día de Canarias", tipo: "autonomico" },
  { fecha: "2026-08-15", nombre: "Asunción de la Virgen", tipo: "nacional" },
  { fecha: "2026-09-08", nombre: "Nuestra Señora del Pino", tipo: "insular" },
  { fecha: "2026-10-12", nombre: "Fiesta Nacional de España", tipo: "nacional" },
  { fecha: "2026-10-24", nombre: "Festividad de San Rafael", tipo: "local" },
  { fecha: "2026-11-02", nombre: "Todos los Santos (trasladado)", tipo: "autonomico" },
  { fecha: "2026-12-08", nombre: "Inmaculada Concepción", tipo: "autonomico" },
  { fecha: "2026-12-25", nombre: "Natividad del Señor", tipo: "nacional" },
];

const EMPLEADOS = [
  { id: "ovidio",  nombre: "Ovidio",        categoria: "farmaceutico", empresa: "reig",    farmaceutico: 1, hace_guardia: 1, complemento_eur: 0,   h_lab_complemento: 0,  orden: 1 },
  { id: "bea",     nombre: "Bea",           categoria: "farmaceutico", empresa: "reig",    farmaceutico: 1, hace_guardia: 0, complemento_eur: 0,   h_lab_complemento: 0,  orden: 2 },
  { id: "maria",   nombre: "María N.",      categoria: "farmaceutico", empresa: "reig",    farmaceutico: 1, hace_guardia: 1, complemento_eur: 180, h_lab_complemento: 0,  orden: 3 },
  { id: "julio",   nombre: "Julio",         categoria: "farmaceutico", empresa: "reig",    farmaceutico: 1, hace_guardia: 1, complemento_eur: 280, h_lab_complemento: 19, orden: 4 },
  { id: "celia",   nombre: "Celia",         categoria: "farmaceutico", empresa: "reig",    farmaceutico: 1, hace_guardia: 1, complemento_eur: 280, h_lab_complemento: 19, orden: 5 },
  { id: "ani",     nombre: "Ani",           categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 1, complemento_eur: 30,  h_lab_complemento: 9,  orden: 6 },
  { id: "noelia",  nombre: "Noelia",        categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 1, complemento_eur: 30,  h_lab_complemento: 9,  orden: 7 },
  { id: "dulce",   nombre: "Dulce",         categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 1, complemento_eur: 30,  h_lab_complemento: 9,  orden: 8 },
  { id: "leti",    nombre: "Leti",          categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 1, complemento_eur: 30,  h_lab_complemento: 9,  orden: 9 },
  { id: "yoli",    nombre: "Yoli",          categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 0, complemento_eur: 0,   h_lab_complemento: 0,  orden: 10 },
  { id: "zuleica", nombre: "Zuleica",       categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 0, complemento_eur: 0,   h_lab_complemento: 0,  orden: 11 },
  { id: "javier",  nombre: "Javier M.",     categoria: "mantenimiento",empresa: "mirelus", farmaceutico: 0, hace_guardia: 1, complemento_eur: 60,  h_lab_complemento: 9,  orden: 12 },
  { id: "teresa",  nombre: "M. Teresa",     categoria: "limpieza",     empresa: "mirelus", farmaceutico: 0, hace_guardia: 0, complemento_eur: 0,   h_lab_complemento: 0,  orden: 13 },
  { id: "luisa",   nombre: "Luisa",         categoria: "otro",         empresa: "mirelus", farmaceutico: 0, hace_guardia: 0, complemento_eur: 0,   h_lab_complemento: 0,  orden: 14 },
];

// Slots de guardia por defecto
const GUARD_DEFAULTS = [
  { empleado_id: "ani",    hora_inicio: 9,  hora_fin: 14 },
  { empleado_id: "dulce",  hora_inicio: 10, hora_fin: 14 },
  { empleado_id: "ovidio", hora_inicio: 9,  hora_fin: 16 },
  { empleado_id: "noelia", hora_inicio: 14, hora_fin: 18 },
  { empleado_id: "leti",   hora_inicio: 16, hora_fin: 21 },
  { empleado_id: "celia",  hora_inicio: 16, hora_fin: 20 },
  { empleado_id: "julio",  hora_inicio: 19, hora_fin: 21 },
  { empleado_id: "javier", hora_inicio: 18, hora_fin: 23 },
  { empleado_id: "maria",  hora_inicio: 21, hora_fin: 33 }, // 33 = 09:00+1
];

export async function POST() {
  try {
    // 1. Crear tablas
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS rrhh_empleados (
        id                  TEXT PRIMARY KEY,
        nombre              TEXT NOT NULL,
        categoria           TEXT NOT NULL DEFAULT 'auxiliar',
        empresa             TEXT NOT NULL DEFAULT 'reig',
        farmaceutico        INTEGER NOT NULL DEFAULT 0,
        hace_guardia        INTEGER NOT NULL DEFAULT 0,
        complemento_eur     INTEGER NOT NULL DEFAULT 0,
        h_lab_complemento   INTEGER NOT NULL DEFAULT 0,
        activo              INTEGER NOT NULL DEFAULT 1,
        orden               INTEGER NOT NULL DEFAULT 99
      );

      CREATE TABLE IF NOT EXISTS rrhh_festivos (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha     TEXT NOT NULL UNIQUE,
        nombre    TEXT NOT NULL,
        tipo      TEXT NOT NULL DEFAULT 'nacional',
        override  INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS rrhh_guardias (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha      TEXT NOT NULL UNIQUE,
        tipo       TEXT NOT NULL DEFAULT 'lab',
        publicada  INTEGER NOT NULL DEFAULT 0,
        notas      TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS rrhh_guardia_slots (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        guardia_id   INTEGER NOT NULL REFERENCES rrhh_guardias(id) ON DELETE CASCADE,
        empleado_id  TEXT NOT NULL REFERENCES rrhh_empleados(id),
        hora_inicio  INTEGER NOT NULL DEFAULT 9,
        hora_fin     INTEGER NOT NULL DEFAULT 14,
        UNIQUE(guardia_id, empleado_id)
      );

      CREATE TABLE IF NOT EXISTS rrhh_guardia_defaults (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id  TEXT NOT NULL UNIQUE REFERENCES rrhh_empleados(id),
        hora_inicio  INTEGER NOT NULL DEFAULT 9,
        hora_fin     INTEGER NOT NULL DEFAULT 14
      );

      CREATE TABLE IF NOT EXISTS rrhh_vacaciones (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id  TEXT NOT NULL REFERENCES rrhh_empleados(id),
        fecha_inicio TEXT NOT NULL,
        fecha_fin    TEXT NOT NULL,
        estado       TEXT NOT NULL DEFAULT 'pend',
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS rrhh_ausencias (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id  TEXT NOT NULL REFERENCES rrhh_empleados(id),
        fecha        TEXT NOT NULL,
        tipo         TEXT NOT NULL DEFAULT 'med',
        nota         TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // 1b. Añadir columna tipo a rrhh_vacaciones si no existe (idempotente)
    try {
      await db.execute(`ALTER TABLE rrhh_vacaciones ADD COLUMN tipo TEXT NOT NULL DEFAULT 'vac'`);
    } catch {
      // La columna ya existe — ignorar
    }

    // 2. Seed empleados (INSERT OR IGNORE)
    for (const e of EMPLEADOS) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO rrhh_empleados
              (id, nombre, categoria, empresa, farmaceutico, hace_guardia, complemento_eur, h_lab_complemento, orden)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [e.id, e.nombre, e.categoria, e.empresa, e.farmaceutico, e.hace_guardia, e.complemento_eur, e.h_lab_complemento, e.orden],
      });
    }

    // 3. Seed festivos 2026
    for (const f of FESTIVOS_2026) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO rrhh_festivos (fecha, nombre, tipo) VALUES (?, ?, ?)`,
        args: [f.fecha, f.nombre, f.tipo],
      });
    }

    // 4. Seed guardia defaults
    for (const g of GUARD_DEFAULTS) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO rrhh_guardia_defaults (empleado_id, hora_inicio, hora_fin) VALUES (?, ?, ?)`,
        args: [g.empleado_id, g.hora_inicio, g.hora_fin],
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Tablas RRHH creadas y datos precargados correctamente",
      tablas: ["rrhh_empleados", "rrhh_festivos", "rrhh_guardias", "rrhh_guardia_slots", "rrhh_guardia_defaults", "rrhh_vacaciones", "rrhh_ausencias"],
      empleados: EMPLEADOS.length,
      festivos: FESTIVOS_2026.length,
    });
  } catch (error) {
    console.error("[rrhh/migrate]", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
