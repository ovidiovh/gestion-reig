import { query, db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePermiso } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const check = await requireAuth();
  if ("error" in check) return check.error;

  try {
    const year = req.nextUrl.searchParams.get("year") || "2026";
    const festivos = await query(
      `SELECT * FROM rrhh_festivos WHERE fecha LIKE ? ORDER BY fecha ASC`,
      [`${year}%`]
    );
    return NextResponse.json({ ok: true, festivos });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// Toggle override: marcar/desmarcar un festivo
export async function POST(req: NextRequest) {
  const check = await requirePermiso("rrhh_guardias");
  if ("error" in check) return check.error;

  try {
    const body = await req.json();
    const { fecha, nombre, tipo } = body as { fecha: string; nombre?: string; tipo?: string };

    // Ver si ya existe
    const existing = await query<{ id: number; override: number }>(
      `SELECT id, override FROM rrhh_festivos WHERE fecha = ?`,
      [fecha]
    );

    if (existing.length > 0) {
      // Toggle override
      const newOverride = existing[0].override ? 0 : 1;
      await db.execute({
        sql: `UPDATE rrhh_festivos SET override = ? WHERE fecha = ?`,
        args: [newOverride, fecha],
      });
    } else {
      // Insertar festivo manual
      await db.execute({
        sql: `INSERT INTO rrhh_festivos (fecha, nombre, tipo, override) VALUES (?, ?, ?, 1)`,
        args: [fecha, nombre || "Festivo manual", tipo || "local"],
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
