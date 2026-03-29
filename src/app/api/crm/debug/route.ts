import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Diagnóstico rápido — sin auth, solo 3 queries ligeras
export async function GET() {
  try {
    const tablas = await query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    );

    const [cnt] = await query<{ n: number; min_fecha: string; max_fecha: string }>(
      `SELECT COUNT(*) as n, MIN(fecha) as min_fecha, MAX(fecha) as max_fecha FROM ventas`
    );

    const tipos = await query<{ tipo: string; n: number }>(
      `SELECT tipo, COUNT(*) as n FROM ventas GROUP BY tipo ORDER BY n DESC LIMIT 10`
    );

    const muestra = await query(
      `SELECT * FROM ventas WHERE tipo='Contado' AND es_cabecera=0 LIMIT 2`
    );

    const [cnt2025] = await query<{ n: number }>(
      `SELECT COUNT(*) as n FROM ventas
       WHERE tipo IN ('Contado','Credito')
         AND es_cabecera = 0
         AND fecha >= '2025-01-01' AND fecha <= '2025-12-31'`
    );

    return NextResponse.json({
      tablas: tablas.map(t => t.name),
      ventas_total: cnt,
      tipos_distintos: tipos,
      muestra_contado: muestra,
      contado_credito_2025: cnt2025,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
