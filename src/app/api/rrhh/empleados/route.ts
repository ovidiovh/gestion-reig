import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const empleados = await query(
      `SELECT * FROM rrhh_empleados WHERE activo = 1 ORDER BY orden ASC`
    );
    return NextResponse.json({ ok: true, empleados });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
