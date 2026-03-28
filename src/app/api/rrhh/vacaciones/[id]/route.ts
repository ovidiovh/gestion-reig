import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// PUT /api/rrhh/vacaciones/[id] — actualizar estado
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { estado } = await req.json() as { estado: string };

    await db.execute({
      sql: `UPDATE rrhh_vacaciones SET estado = ? WHERE id = ?`,
      args: [estado, id],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// DELETE /api/rrhh/vacaciones/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.execute({ sql: `DELETE FROM rrhh_vacaciones WHERE id = ?`, args: [id] });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
