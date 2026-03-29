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

// Horarios en media-horas: 8:30=17, 9:00=18, 11:30=23, 12:30=25, 13:00=26,
//   14:00=28, 15:00=30, 15:30=31, 17:00=34, 18:30=37, 20:30=41
const EMPLEADOS = [
  { id: "ovidio",  nombre: "Ovidio",    categoria: "farmaceutico", empresa: "reig",    farmaceutico: 1, hace_guardia: 1, complemento_eur: 0,   h_lab_complemento: 0,  orden: 1,  departamento: "farmacia", ia: 23, fa: 41, ib: null, fb: null },
  { id: "bea",     nombre: "Bea",       categoria: "farmaceutico", empresa: "reig",    farmaceutico: 1, hace_guardia: 0, complemento_eur: 0,   h_lab_complemento: 0,  orden: 2,  departamento: "farmacia", ia: 14, fa: 31, ib: null, fb: null },
  { id: "maria",   nombre: "María N.",  categoria: "farmaceutico", empresa: "reig",    farmaceutico: 1, hace_guardia: 1, complemento_eur: 180, h_lab_complemento: 0,  orden: 3,  departamento: "farmacia", ia: 25, fa: 41, ib: null, fb: null },
  { id: "julio",   nombre: "Julio",     categoria: "farmaceutico", empresa: "reig",    farmaceutico: 1, hace_guardia: 1, complemento_eur: 280, h_lab_complemento: 19, orden: 4,  departamento: "farmacia", ia: 18, fa: 28, ib: 34,   fb: 40   },
  { id: "celia",   nombre: "Celia",     categoria: "farmaceutico", empresa: "reig",    farmaceutico: 1, hace_guardia: 1, complemento_eur: 280, h_lab_complemento: 19, orden: 5,  departamento: "farmacia", ia: 18, fa: 34, ib: null, fb: null },
  { id: "ani",     nombre: "Ani",       categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 1, complemento_eur: 30,  h_lab_complemento: 9,  orden: 6,  departamento: "farmacia", ia: null, fa: null, ib: null, fb: null },
  { id: "noelia",  nombre: "Noelia",    categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 1, complemento_eur: 30,  h_lab_complemento: 9,  orden: 7,  departamento: "farmacia", ia: 18, fa: 26, ib: 30,   fb: 37   },
  { id: "dulce",   nombre: "Dulce",     categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 1, complemento_eur: 30,  h_lab_complemento: 9,  orden: 8,  departamento: "farmacia", ia: null, fa: null, ib: null, fb: null },
  { id: "leti",    nombre: "Leti",      categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 1, complemento_eur: 30,  h_lab_complemento: 9,  orden: 9,  departamento: "farmacia", ia: null, fa: null, ib: null, fb: null },
  { id: "yoli",    nombre: "Yoli",      categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 0, complemento_eur: 0,   h_lab_complemento: 0,  orden: 10, departamento: "farmacia", ia: null, fa: null, ib: null, fb: null },
  { id: "zuleica", nombre: "Zuleica",   categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 0, complemento_eur: 0,   h_lab_complemento: 0,  orden: 11, departamento: "farmacia", ia: null, fa: null, ib: null, fb: null },
  { id: "javier",  nombre: "Javier M.", categoria: "mantenimiento",empresa: "mirelus", farmaceutico: 0, hace_guardia: 1, complemento_eur: 60,  h_lab_complemento: 9,  orden: 12, departamento: "otro",     ia: 18, fa: 34, ib: null, fb: null },
  { id: "teresa",  nombre: "M. Teresa", categoria: "limpieza",     empresa: "mirelus", farmaceutico: 0, hace_guardia: 0, complemento_eur: 0,   h_lab_complemento: 0,  orden: 13, departamento: "otro",     ia: 17, fa: 24, ib: null, fb: null },
  { id: "luisa",   nombre: "Luisa",     categoria: "otro",         empresa: "mirelus", farmaceutico: 0, hace_guardia: 0, complemento_eur: 0,   h_lab_complemento: 0,  orden: 14, departamento: "otro",     ia: 17, fa: 24, ib: null, fb: null },
  { id: "miriam",  nombre: "Miriam",    categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 0, complemento_eur: 0,   h_lab_complemento: 0,  orden: 15, departamento: "optica",    ia: 18, fa: 34, ib: null, fb: null },
  { id: "monica",  nombre: "Mónica",    categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 0, complemento_eur: 0,   h_lab_complemento: 0,  orden: 16, departamento: "ortopedia", ia: 18, fa: 34, ib: null, fb: null },
  { id: "jenny",   nombre: "Jenny",     categoria: "auxiliar",     empresa: "reig",    farmaceutico: 0, hace_guardia: 0, complemento_eur: 0,   h_lab_complemento: 0,  orden: 17, departamento: "farmacia",  ia: 18,   fa: 34,   ib: null, fb: null },
];

// Slots de guardia por defecto
// Javier: turno partido 9:00-14:00 y 20:00-23:00 (hora_inicio2 / hora_fin2)
const GUARD_DEFAULTS = [
  { empleado_id: "ani",    hora_inicio: 9,  hora_fin: 14, hora_inicio2: null, hora_fin2: null },
  { empleado_id: "dulce",  hora_inicio: 10, hora_fin: 14, hora_inicio2: null, hora_fin2: null },
  { empleado_id: "ovidio", hora_inicio: 9,  hora_fin: 16, hora_inicio2: null, hora_fin2: null },
  { empleado_id: "noelia", hora_inicio: 14, hora_fin: 18, hora_inicio2: null, hora_fin2: null },
  { empleado_id: "leti",   hora_inicio: 16, hora_fin: 21, hora_inicio2: null, hora_fin2: null },
  { empleado_id: "celia",  hora_inicio: 16, hora_fin: 20, hora_inicio2: null, hora_fin2: null },
  { empleado_id: "julio",  hora_inicio: 19, hora_fin: 21, hora_inicio2: null, hora_fin2: null },
  { empleado_id: "javier", hora_inicio: 9,  hora_fin: 14, hora_inicio2: 20,   hora_fin2: 23   },
  { empleado_id: "maria",  hora_inicio: 21, hora_fin: 33, hora_inicio2: null, hora_fin2: null },
];

export async function POST() {
  try {
    // 1. Crear tablas base
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
        hora_inicio2 INTEGER,
        hora_fin2    INTEGER,
        UNIQUE(guardia_id, empleado_id)
      );

      CREATE TABLE IF NOT EXISTS rrhh_guardia_defaults (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id  TEXT NOT NULL UNIQUE REFERENCES rrhh_empleados(id),
        hora_inicio  INTEGER NOT NULL DEFAULT 9,
        hora_fin     INTEGER NOT NULL DEFAULT 14,
        hora_inicio2 INTEGER,
        hora_fin2    INTEGER
      );

      CREATE TABLE IF NOT EXISTS rrhh_vacaciones (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id  TEXT NOT NULL REFERENCES rrhh_empleados(id),
        fecha_inicio TEXT NOT NULL,
        fecha_fin    TEXT NOT NULL,
        estado       TEXT NOT NULL DEFAULT 'pend',
        tipo         TEXT NOT NULL DEFAULT 'vac',
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

      CREATE TABLE IF NOT EXISTS rrhh_horarios_asignacion (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        week_start   TEXT NOT NULL,
        empleado_id  TEXT NOT NULL REFERENCES rrhh_empleados(id),
        turno        INTEGER NOT NULL DEFAULT 1,
        notas        TEXT,
        UNIQUE(week_start, empleado_id)
      );

      CREATE TABLE IF NOT EXISTS rrhh_banco_horas (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id  TEXT NOT NULL REFERENCES rrhh_empleados(id),
        fecha        TEXT NOT NULL,
        concepto     TEXT NOT NULL DEFAULT 'deuda',
        minutos      INTEGER NOT NULL,
        notas        TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS rrhh_turnos_config (
        turno        INTEGER PRIMARY KEY,  -- 0=Esp, 1=T1, 2=T2, 3=T3
        inicio_a     INTEGER NOT NULL,
        fin_a        INTEGER NOT NULL,
        inicio_b     INTEGER,
        fin_b        INTEGER
      );
    `);

    // 1b. Migraciones idempotentes (añadir columnas si no existen)
    const alterations = [
      `ALTER TABLE rrhh_vacaciones ADD COLUMN tipo TEXT NOT NULL DEFAULT 'vac'`,
      `ALTER TABLE rrhh_guardia_slots ADD COLUMN hora_inicio2 INTEGER`,
      `ALTER TABLE rrhh_guardia_slots ADD COLUMN hora_fin2 INTEGER`,
      `ALTER TABLE rrhh_guardia_defaults ADD COLUMN hora_inicio2 INTEGER`,
      `ALTER TABLE rrhh_guardia_defaults ADD COLUMN hora_fin2 INTEGER`,
      // Ajuste manual del contador de guardias realizadas (nullable = usar valor calculado)
      `ALTER TABLE rrhh_empleados ADD COLUMN guardias_manual INTEGER`,
      // Departamento del empleado (farmacia, optica, ortopedia, otro)
      `ALTER TABLE rrhh_empleados ADD COLUMN departamento TEXT NOT NULL DEFAULT 'farmacia'`,
      // Horario fijo en media-horas (null = usar horario por defecto del código)
      `ALTER TABLE rrhh_empleados ADD COLUMN horario_inicio_a INTEGER`,
      `ALTER TABLE rrhh_empleados ADD COLUMN horario_fin_a INTEGER`,
      `ALTER TABLE rrhh_empleados ADD COLUMN horario_inicio_b INTEGER`,
      `ALTER TABLE rrhh_empleados ADD COLUMN horario_fin_b INTEGER`,
    ];
    for (const sql of alterations) {
      try { await db.execute(sql); } catch { /* columna ya existe — ignorar */ }
    }

    // 2. Seed empleados (upsert — actualiza nombre, departamento y horarios forzando los valores maestros)
    for (const e of EMPLEADOS) {
      await db.execute({
        sql: `INSERT INTO rrhh_empleados
              (id, nombre, categoria, empresa, farmaceutico, hace_guardia, complemento_eur, h_lab_complemento, orden, departamento,
               horario_inicio_a, horario_fin_a, horario_inicio_b, horario_fin_b)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                nombre            = excluded.nombre,
                departamento      = excluded.departamento`,
        args: [e.id, e.nombre, e.categoria, e.empresa, e.farmaceutico, e.hace_guardia,
               e.complemento_eur, e.h_lab_complemento, e.orden, e.departamento,
               e.ia, e.fa, e.ib, e.fb],
      });
    }

    // 1c. Seed turnos_config (upsert — usa TURNO_HORARIO como valores por defecto)
    const TURNOS_SEED = [
      { turno: 0, inicio_a: 17, fin_a: 25, inicio_b: null, fin_b: null },  // Esp: 8:30–12:30
      { turno: 1, inicio_a: 17, fin_a: 33, inicio_b: null, fin_b: null },  // T1:  8:30–16:30
      { turno: 2, inicio_a: 18, fin_a: 26, inicio_b: 32,   fin_b: 40   },  // T2:  9–13 / 16–20
      { turno: 3, inicio_a: 25, fin_a: 41, inicio_b: null, fin_b: null },  // T3:  12:30–20:30
    ];
    for (const t of TURNOS_SEED) {
      await db.execute({
        sql: `INSERT INTO rrhh_turnos_config (turno, inicio_a, fin_a, inicio_b, fin_b)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(turno) DO NOTHING`,
        args: [t.turno, t.inicio_a, t.fin_a, t.inicio_b, t.fin_b],
      });
    }

    // 2b. Desactivar empleados que no deben aparecer en el planning
    await db.execute({ sql: `UPDATE rrhh_empleados SET activo = 0 WHERE id IN ('luisa', 'teresa')`, args: [] });

    // 3. Seed festivos 2026
    for (const f of FESTIVOS_2026) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO rrhh_festivos (fecha, nombre, tipo) VALUES (?, ?, ?)`,
        args: [f.fecha, f.nombre, f.tipo],
      });
    }

    // 4. Seed guardia defaults (upsert)
    for (const g of GUARD_DEFAULTS) {
      await db.execute({
        sql: `INSERT INTO rrhh_guardia_defaults (empleado_id, hora_inicio, hora_fin, hora_inicio2, hora_fin2)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(empleado_id) DO UPDATE SET
                hora_inicio  = excluded.hora_inicio,
                hora_fin     = excluded.hora_fin,
                hora_inicio2 = excluded.hora_inicio2,
                hora_fin2    = excluded.hora_fin2`,
        args: [g.empleado_id, g.hora_inicio, g.hora_fin, g.hora_inicio2, g.hora_fin2],
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Tablas RRHH creadas y datos precargados correctamente",
      tablas: [
        "rrhh_empleados", "rrhh_festivos", "rrhh_guardias",
        "rrhh_guardia_slots", "rrhh_guardia_defaults",
        "rrhh_vacaciones", "rrhh_ausencias", "rrhh_horarios_asignacion",
        "rrhh_banco_horas", "rrhh_turnos_config",
      ],
      empleados: EMPLEADOS.length,
      festivos: FESTIVOS_2026.length,
    });
  } catch (error) {
    console.error("[rrhh/migrate]", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
