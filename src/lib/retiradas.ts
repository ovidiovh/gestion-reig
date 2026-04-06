import { query, batch } from "./db";

// ============================================================
// RETIRADAS DE CAJA — Módulo DB
// ============================================================

/* ── Interfaces ── */

export interface CajaData {
  caja_num: number;
  b200: number;
  b100: number;
  b50: number;
  b20: number;
  b10: number;
  b5: number;
  total: number;
}

export interface ConteoData {
  b500: number;
  b200: number;
  b100: number;
  b50: number;
  b20: number;
  b10: number;
  b5: number;
  total_conteo: number;
  total_cajas: number;
  diferencia: number;
  cuadra: boolean;
}

export interface MovimientoData {
  tipo: "sacar" | "ingresar";
  caja_num: number;
  importe: number;
  motivo: string;
}

export interface SesionInput {
  fecha: string;
  cajas: CajaData[];
  conteo: ConteoData;
  movimientos: MovimientoData[];
  destino?: string;
  usuario_email: string;
  usuario_nombre: string;
}

/* ── Migración / Init ── */

/**
 * Intenta añadir una columna; si ya existe, ignora el error.
 * SQLite no soporta ADD COLUMN IF NOT EXISTS, así que lo simulamos así.
 */
async function addColIfMissing(table: string, columnDef: string) {
  try {
    await query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch {
    // ya existe, ignorar
  }
}

export async function initRetiradas() {
  await batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS retiradas_sesion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        total REAL NOT NULL DEFAULT 0,
        num_cajas INTEGER NOT NULL DEFAULT 0,
        destino TEXT NOT NULL DEFAULT 'caja_fuerte',
        usuario_email TEXT,
        usuario_nombre TEXT,
        confirmada INTEGER NOT NULL DEFAULT 0,
        conteo_cuadra INTEGER NOT NULL DEFAULT 0,
        conteo_total REAL DEFAULT 0,
        conteo_diferencia REAL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS retiradas_caja (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sesion_id INTEGER NOT NULL,
        caja_num INTEGER NOT NULL,
        b200 INTEGER NOT NULL DEFAULT 0,
        b100 INTEGER NOT NULL DEFAULT 0,
        b50 INTEGER NOT NULL DEFAULT 0,
        b20 INTEGER NOT NULL DEFAULT 0,
        b10 INTEGER NOT NULL DEFAULT 0,
        b5 INTEGER NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        UNIQUE (sesion_id, caja_num)
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS retiradas_conteo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sesion_id INTEGER NOT NULL,
        b500 INTEGER NOT NULL DEFAULT 0,
        b200 INTEGER NOT NULL DEFAULT 0,
        b100 INTEGER NOT NULL DEFAULT 0,
        b50 INTEGER NOT NULL DEFAULT 0,
        b20 INTEGER NOT NULL DEFAULT 0,
        b10 INTEGER NOT NULL DEFAULT 0,
        b5 INTEGER NOT NULL DEFAULT 0,
        total_conteo REAL NOT NULL DEFAULT 0,
        total_cajas REAL NOT NULL DEFAULT 0,
        diferencia REAL NOT NULL DEFAULT 0,
        cuadra INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS retiradas_movimiento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sesion_id INTEGER NOT NULL,
        tipo TEXT NOT NULL,
        caja_num INTEGER,
        importe REAL NOT NULL DEFAULT 0,
        motivo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    },
  ]);

  // Migración idempotente: la tabla retiradas_sesion puede haber sido creada
  // previamente con un schema antiguo (schema.sql / migrate/route.ts) que no
  // tiene las columnas que el código nuevo necesita. Añadimos las que falten.
  // Confirmado: error real en producción 2026-04-06
  // "table retiradas_sesion has no column named total".
  await addColIfMissing("retiradas_sesion", "total REAL NOT NULL DEFAULT 0");
  await addColIfMissing("retiradas_sesion", "num_cajas INTEGER NOT NULL DEFAULT 0");
  await addColIfMissing("retiradas_sesion", "usuario_email TEXT");
  await addColIfMissing("retiradas_sesion", "usuario_nombre TEXT");
  await addColIfMissing("retiradas_sesion", "confirmada INTEGER NOT NULL DEFAULT 0");
  await addColIfMissing("retiradas_sesion", "conteo_cuadra INTEGER NOT NULL DEFAULT 0");
  await addColIfMissing("retiradas_sesion", "conteo_total REAL DEFAULT 0");
  await addColIfMissing("retiradas_sesion", "conteo_diferencia REAL DEFAULT 0");
  await addColIfMissing("retiradas_sesion", "origen TEXT DEFAULT 'farmacia'");

  // retiradas_caja: schema antiguo tiene num_caja, schema nuevo usa caja_num.
  // Añadimos caja_num para los SELECTs nuevos. El INSERT (más abajo) escribe
  // en AMBAS columnas con el mismo valor para no violar NOT NULL del antiguo.
  await addColIfMissing("retiradas_caja", "caja_num INTEGER");
}

/* ── Guardar sesión completa ── */

export async function guardarSesion(input: SesionInput): Promise<{ id: number; total: number }> {
  await initRetiradas();

  const totalCajas = input.cajas.reduce((s, c) => s + c.total, 0);

  // 1. Insertar sesión
  const [sesion] = await query<{ id: number }>(
    `INSERT INTO retiradas_sesion
      (fecha, total, num_cajas, destino, usuario_email, usuario_nombre, confirmada, conteo_cuadra, conteo_total, conteo_diferencia)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
     RETURNING id`,
    [
      input.fecha,
      totalCajas,
      input.cajas.length,
      input.destino || "caja_fuerte",
      input.usuario_email,
      input.usuario_nombre,
      input.conteo.cuadra ? 1 : 0,
      input.conteo.total_conteo,
      input.conteo.diferencia,
    ]
  );
  const sesionId = sesion.id;

  // 2. Insertar cajas
  // Insertamos en num_caja Y caja_num con el mismo valor por compatibilidad
  // hacia atrás: las BD viejas (schema.sql original) tienen num_caja NOT NULL
  // CHECK BETWEEN 1 AND 11; las BD nuevas usan caja_num. Escribir en ambas
  // satisface ambos schemas.
  for (const c of input.cajas) {
    await query(
      `INSERT INTO retiradas_caja (sesion_id, num_caja, caja_num, b200, b100, b50, b20, b10, b5, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sesionId, c.caja_num, c.caja_num, c.b200, c.b100, c.b50, c.b20, c.b10, c.b5, c.total]
    );
  }

  // 3. Insertar conteo
  await query(
    `INSERT INTO retiradas_conteo
      (sesion_id, b500, b200, b100, b50, b20, b10, b5, total_conteo, total_cajas, diferencia, cuadra)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sesionId,
      input.conteo.b500, input.conteo.b200, input.conteo.b100,
      input.conteo.b50, input.conteo.b20, input.conteo.b10, input.conteo.b5,
      input.conteo.total_conteo, input.conteo.total_cajas,
      input.conteo.diferencia, input.conteo.cuadra ? 1 : 0,
    ]
  );

  // 4. Insertar movimientos (ajustes)
  for (const m of input.movimientos) {
    await query(
      `INSERT INTO retiradas_movimiento (sesion_id, tipo, caja_num, importe, motivo)
       VALUES (?, ?, ?, ?, ?)`,
      [sesionId, m.tipo, m.caja_num, m.importe, m.motivo || ""]
    );
  }

  return { id: sesionId, total: totalCajas };
}

/* ── Listar sesiones ── */

export async function listarSesiones(filtroOrFecha: string = "todo") {
  await initRetiradas();

  let where = "";
  const args: string[] = [];

  // Si parece una fecha YYYY-MM-DD, filtrar desde esa fecha
  if (/^\d{4}-\d{2}-\d{2}$/.test(filtroOrFecha)) {
    where = `WHERE fecha >= ?`;
    args.push(filtroOrFecha);
  } else if (filtroOrFecha === "hoy") {
    where = `WHERE fecha = date('now')`;
  } else if (filtroOrFecha === "semana") {
    where = `WHERE fecha >= date('now', '-7 days')`;
  } else if (filtroOrFecha === "mes") {
    where = `WHERE fecha >= date('now', 'start of month')`;
  }

  return query<{
    id: number;
    fecha: string;
    total: number;
    num_cajas: number;
    destino: string;
    usuario_nombre: string;
    conteo_cuadra: number;
    conteo_diferencia: number;
    created_at: string;
    origen: string | null;
  }>(`SELECT id, fecha, total, num_cajas, destino, usuario_nombre,
            conteo_cuadra, conteo_diferencia, created_at,
            COALESCE(origen, 'farmacia') AS origen
      FROM retiradas_sesion ${where}
      ORDER BY created_at DESC
      LIMIT 50`, args);
}

/* ── Detalle de una sesión ── */

export async function detalleSesion(id: number) {
  await initRetiradas();

  const [sesion] = await query<{
    id: number; fecha: string; total: number; num_cajas: number;
    destino: string; usuario_email: string; usuario_nombre: string;
    confirmada: number; conteo_cuadra: number; conteo_total: number;
    conteo_diferencia: number; created_at: string;
  }>(`SELECT * FROM retiradas_sesion WHERE id = ?`, [id]);

  if (!sesion) return null;

  const cajas = await query<CajaData>(
    `SELECT caja_num, b200, b100, b50, b20, b10, b5, total
     FROM retiradas_caja WHERE sesion_id = ? ORDER BY caja_num`, [id]
  );

  const [conteo] = await query<ConteoData & { cuadra: number }>(
    `SELECT b500, b200, b100, b50, b20, b10, b5,
            total_conteo, total_cajas, diferencia, cuadra
     FROM retiradas_conteo WHERE sesion_id = ?`, [id]
  );

  const movimientos = await query<MovimientoData & { created_at: string }>(
    `SELECT tipo, caja_num, importe, motivo, created_at
     FROM retiradas_movimiento WHERE sesion_id = ? ORDER BY created_at`, [id]
  );

  return { sesion, cajas, conteo: conteo || null, movimientos };
}

/* ── Comprobar si ya existe sesión hoy ── */

export async function sesionHoy(): Promise<{ existe: boolean; id?: number; total?: number }> {
  await initRetiradas();

  const rows = await query<{ id: number; total: number }>(
    `SELECT id, total FROM retiradas_sesion WHERE fecha = date('now') LIMIT 1`
  );

  if (rows.length > 0) {
    return { existe: true, id: rows[0].id, total: rows[0].total };
  }
  return { existe: false };
}
