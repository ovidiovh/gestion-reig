/**
 * ============================================================
 * Módulo Ingresos Banco — Turso queries
 * ============================================================
 * Gestiona la tabla ingresos_banco donde se registran todos
 * los ingresos confirmados (por email automático o foto manual).
 */
import { getTurso, query, batch } from "./db";

/* ───── Tipos ───── */

export interface IngresoInput {
  fecha: string;          // YYYY-MM-DD
  hora?: string;          // HH:MM:SS
  concepto: string;       // FARMACIA | OPTICA | REMESA FARMACIA | REMESA OPTICA
  importe: number;
  num_operacion?: string;
  origen: "email" | "foto" | "manual";
  foto_base64?: string;   // Solo para origen=foto
  email_id?: string;      // Solo para origen=email (Gmail msg ID)
  usuario_email?: string;
  usuario_nombre?: string;
  notas?: string;
}

export interface IngresoRow {
  id: number;
  fecha: string;
  hora: string | null;
  concepto: string;
  importe: number;
  num_operacion: string | null;
  origen: string;
  foto_base64: string | null;
  email_id: string | null;
  usuario_email: string | null;
  usuario_nombre: string | null;
  notas: string | null;
  created_at: string;
}

/* ───── Init tabla ───── */

export async function initIngresos(): Promise<void> {
  await batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS ingresos_banco (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        hora TEXT,
        concepto TEXT NOT NULL,
        importe REAL NOT NULL,
        num_operacion TEXT,
        origen TEXT NOT NULL DEFAULT 'email',
        foto_base64 TEXT,
        email_id TEXT,
        usuario_email TEXT,
        usuario_nombre TEXT,
        notas TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON ingresos_banco(fecha)`,
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_ingresos_concepto ON ingresos_banco(concepto)`,
    },
    {
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_ingresos_email_id ON ingresos_banco(email_id) WHERE email_id IS NOT NULL`,
    },
  ]);
}

/* ───── Guardar ingreso ───── */

export async function guardarIngreso(input: IngresoInput): Promise<{ id: number }> {
  // Asegurar que la tabla existe
  await initIngresos();

  const db = getTurso();
  const result = await db.execute({
    sql: `INSERT INTO ingresos_banco (fecha, hora, concepto, importe, num_operacion, origen, foto_base64, email_id, usuario_email, usuario_nombre, notas)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.fecha,
      input.hora || null,
      input.concepto,
      input.importe,
      input.num_operacion || null,
      input.origen,
      input.foto_base64 || null,
      input.email_id || null,
      input.usuario_email || null,
      input.usuario_nombre || null,
      input.notas || null,
    ],
  });

  return { id: Number(result.lastInsertRowid) };
}

/* ───── Listar ingresos ───── */

export async function listarIngresos(filtro: string = "mes"): Promise<IngresoRow[]> {
  await initIngresos();

  let whereClause = "";
  switch (filtro) {
    case "hoy":
      whereClause = "WHERE fecha = date('now')";
      break;
    case "semana":
      whereClause = "WHERE fecha >= date('now', '-7 days')";
      break;
    case "mes":
      whereClause = "WHERE fecha >= date('now', '-30 days')";
      break;
    case "todo":
    default:
      whereClause = "";
      break;
  }

  return query<IngresoRow>(
    `SELECT id, fecha, hora, concepto, importe, num_operacion, origen,
            NULL as foto_base64, email_id, usuario_email, usuario_nombre, notas, created_at
     FROM ingresos_banco
     ${whereClause}
     ORDER BY fecha DESC, hora DESC`
  );
}

/* ───── Detalle de un ingreso (con foto) ───── */

export async function detalleIngreso(id: number): Promise<IngresoRow | null> {
  await initIngresos();

  const rows = await query<IngresoRow>(
    `SELECT * FROM ingresos_banco WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

/* ───── Comprobar si un email_id ya existe (evitar duplicados) ───── */

export async function existeEmailId(emailId: string): Promise<boolean> {
  await initIngresos();

  const rows = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM ingresos_banco WHERE email_id = ?`,
    [emailId]
  );
  return (rows[0]?.cnt || 0) > 0;
}

/* ───── Estadísticas del mes ───── */

export async function estadisticasMes(): Promise<{
  total: number;
  farmacia: number;
  optica: number;
  pendientes: number;
  count: number;
}> {
  await initIngresos();

  const rows = await query<{
    total: number;
    farmacia: number;
    optica: number;
    count: number;
  }>(
    `SELECT
       COALESCE(SUM(importe), 0) as total,
       COALESCE(SUM(CASE WHEN concepto IN ('FARMACIA', 'REMESA FARMACIA') THEN importe ELSE 0 END), 0) as farmacia,
       COALESCE(SUM(CASE WHEN concepto IN ('OPTICA', 'REMESA OPTICA') THEN importe ELSE 0 END), 0) as optica,
       COUNT(*) as count
     FROM ingresos_banco
     WHERE fecha >= date('now', '-30 days')`
  );

  // Pendientes = ingresos sin concepto reconocido
  const pendRows = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM ingresos_banco
     WHERE concepto NOT IN ('FARMACIA', 'OPTICA', 'REMESA FARMACIA', 'REMESA OPTICA')
       AND fecha >= date('now', '-30 days')`
  );

  return {
    total: rows[0]?.total || 0,
    farmacia: rows[0]?.farmacia || 0,
    optica: rows[0]?.optica || 0,
    pendientes: pendRows[0]?.cnt || 0,
    count: rows[0]?.count || 0,
  };
}
