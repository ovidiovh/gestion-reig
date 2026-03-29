import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Diagnóstico rápido — sin auth, solo queries de metadata (< 1s)
export async function GET() {
  try {
    const cols = await query<{ cid: number; name: string; type: string }>(
      `PRAGMA table_info(ventas)`
    );

    const tablas = await query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    );

    // Verificar es_cabecera
    let esCabeceraInfo: unknown = "not_checked";
    try {
      const r = await query<{ es_cabecera: unknown; n: number }>(
        `SELECT es_cabecera, COUNT(*) as n FROM ventas GROUP BY es_cabecera LIMIT 5`
      );
      esCabeceraInfo = r;
    } catch (e) {
      esCabeceraInfo = { error: String(e) };
    }

    // Muestra 1 fila real
    let muestra: unknown = null;
    try {
      const r = await query(`SELECT * FROM ventas LIMIT 1`);
      muestra = r[0] ?? null;
    } catch (e) {
      muestra = { error: String(e) };
    }

    return NextResponse.json({
      columnas_ventas: cols.map(c => ({ name: c.name, type: c.type })),
      tablas: tablas.map(t => t.name),
      es_cabecera_check: esCabeceraInfo,
      muestra_fila: muestra,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
