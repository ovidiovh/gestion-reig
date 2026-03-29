import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { query } from "@/lib/db";

// Ruta de diagnóstico temporal — ver columnas reales en Turso
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    // 1. Tablas disponibles
    const tablas = await query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    );

    // 2. Columnas de ventas (si existe)
    let columnasVentas: unknown[] = [];
    try {
      columnasVentas = await query(`PRAGMA table_info(ventas)`);
    } catch { columnasVentas = [{ error: "tabla ventas no existe" }]; }

    // 3. Columnas de dispensaciones (si existe)
    let columnasDisp: unknown[] = [];
    try {
      columnasDisp = await query(`PRAGMA table_info(dispensaciones)`);
    } catch { columnasDisp = [{ error: "tabla dispensaciones no existe" }]; }

    // 4. Count de ventas
    let countVentas = 0;
    try {
      const [r] = await query<{ n: number }>(`SELECT COUNT(*) as n FROM ventas`);
      countVentas = r?.n || 0;
    } catch { countVentas = -1; }

    // 5. Count de dispensaciones
    let countDisp = 0;
    try {
      const [r] = await query<{ n: number }>(`SELECT COUNT(*) as n FROM dispensaciones`);
      countDisp = r?.n || 0;
    } catch { countDisp = -1; }

    // 6. Primera fila de ventas
    let muestraVentas: unknown[] = [];
    try {
      muestraVentas = await query(`SELECT * FROM ventas LIMIT 2`);
    } catch { muestraVentas = [{ error: "no se puede leer ventas" }]; }

    // 7. Count ventas 2025 con filtro básico
    let count2025 = 0;
    try {
      const [r] = await query<{ n: number }>(
        `SELECT COUNT(*) as n FROM ventas WHERE fecha >= '2025-01-01' AND fecha <= '2025-12-31'`
      );
      count2025 = r?.n || 0;
    } catch { count2025 = -1; }

    // 8. Count ventas 2025 con filtro completo
    let count2025Filtrado = 0;
    try {
      const [r] = await query<{ n: number }>(`
        SELECT COUNT(*) as n FROM ventas
        WHERE tipo IN ('Contado', 'Credito')
          AND UPPER(SUBSTR(num_doc, 1, 1)) != 'W'
          AND (rp IS NULL OR rp != 'Anulada')
          AND (descripcion NOT LIKE '%TRASPASO ENTRE CAJAS%')
          AND (descripcion NOT LIKE '%Entrega A Cuenta%')
          AND es_cabecera = 0
          AND fecha >= '2025-01-01' AND fecha <= '2025-12-31'
      `);
      count2025Filtrado = r?.n || 0;
    } catch (e) { count2025Filtrado = -1; console.error("filtro:", e); }

    // 9. Tipos únicos en ventas (columna tipo)
    let tiposVentas: unknown[] = [];
    try {
      tiposVentas = await query(`SELECT DISTINCT tipo, COUNT(*) as n FROM ventas GROUP BY tipo LIMIT 20`);
    } catch { tiposVentas = []; }

    return NextResponse.json({
      tablas: tablas.map((t) => t.name),
      columnasVentas,
      columnasDisp,
      countVentas,
      countDisp,
      count2025,
      count2025Filtrado,
      tiposVentas,
      muestraVentas,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
