import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// ONE-TIME cleanup — delete duplicate sessions, keep lowest ID per fecha
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("key");
  if (secret !== "reig-cleanup-2026") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Find duplicates: for each fecha, keep the MIN(id) and delete the rest
  const dupes = await db.execute(`
    SELECT id FROM retiradas_sesion
    WHERE id NOT IN (
      SELECT MIN(id) FROM retiradas_sesion GROUP BY fecha
    )
  `);

  const idsToDelete = dupes.rows.map((r) => Number(r.id));

  for (const id of idsToDelete) {
    await db.execute({ sql: "DELETE FROM retiradas_audit WHERE sesion_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM retiradas_caja WHERE sesion_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM retiradas_sesion WHERE id = ?", args: [id] });
  }

  // Verify what's left
  const remaining = await db.execute(
    "SELECT id, fecha, total_cajas FROM retiradas_sesion ORDER BY fecha"
  );

  return NextResponse.json({
    ok: true,
    deleted_ids: idsToDelete,
    remaining: remaining.rows,
  });
}
