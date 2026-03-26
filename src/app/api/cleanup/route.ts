import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("key") !== "reig-cleanup-2026") {
    return NextResponse.json({ error: "no" }, { status: 401 });
  }

  // Hardcoded duplicate IDs to delete: keep 1,4,7 — delete 2,3,5,6,8,9
  await db.executeMultiple(`
    DELETE FROM retiradas_audit WHERE sesion_id IN (2,3,5,6,8,9);
    DELETE FROM retiradas_caja WHERE sesion_id IN (2,3,5,6,8,9);
    DELETE FROM retiradas_sesion WHERE id IN (2,3,5,6,8,9);
  `);

  const r = await db.execute("SELECT id, fecha, total_cajas FROM retiradas_sesion ORDER BY fecha");
  return NextResponse.json({ ok: true, remaining: r.rows });
}
