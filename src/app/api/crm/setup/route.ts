import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const maxDuration = 60;

/**
 * POST /api/crm/setup
 * Crea índices en la tabla ventas para optimizar todas las queries CRM.
 * Idempotente — CREATE INDEX IF NOT EXISTS.
 * Llamar UNA VEZ tras el primer despliegue o cuando las queries sean lentas.
 */
export async function POST() {
  const indices = [
    // Índice principal: fecha + tipo + es_cabecera — cubre la mayoría de WHERE
    `CREATE INDEX IF NOT EXISTS idx_ventas_fecha_tipo ON ventas(fecha, tipo, es_cabecera)`,
    // Vendedor — para GROUP BY vendedor_nombre
    `CREATE INDEX IF NOT EXISTS idx_ventas_vendedor ON ventas(vendedor_nombre, fecha)`,
    // Producto — para GROUP BY codigo
    `CREATE INDEX IF NOT EXISTS idx_ventas_codigo ON ventas(codigo, fecha)`,
    // Hora — para cronograma (GROUP BY dia_semana, hora_num)
    `CREATE INDEX IF NOT EXISTS idx_ventas_hora ON ventas(dia_semana, fecha)`,
  ];

  const results: { sql: string; ok: boolean; error?: string }[] = [];

  for (const sql of indices) {
    try {
      await db.execute(sql);
      results.push({ sql, ok: true });
    } catch (e) {
      results.push({ sql, ok: false, error: String(e) });
    }
  }

  return NextResponse.json({ ok: true, indices: results });
}

/** GET /api/crm/setup — devuelve info de índices existentes */
export async function GET() {
  try {
    const rows = await db.execute(
      `SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND tbl_name='ventas' ORDER BY name`
    );
    return NextResponse.json({ ok: true, indices: rows.rows });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
