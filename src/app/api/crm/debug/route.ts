import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Diagnóstico rápido — solo queries de metadata (< 1s)
export async function GET() {
  try {
    const cols = await query<{ cid: number; name: string; type: string }>(
      `PRAGMA table_info(ventas)`
    );
    const indexes = await query<{ name: string; tbl_name: string }>(
      `SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND tbl_name='ventas'`
    );
    const tablas = await query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    );

    return NextResponse.json({
      columnas_ventas: cols.map(c => ({ name: c.name, type: c.type })),
      indices_ventas: indexes.map(i => i.name),
      tablas: tablas.map(t => t.name),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
