import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// ONE-TIME cleanup — delete duplicate sessions using single SQL statements
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("key");
  if (secret !== "reig-cleanup-2026") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Delete audit records for duplicate sessions in one go
  await db.execute(`
    DELETE FROM retiradas_audit WHERE sesion_id NOT IN (
      SELECT MIN(id) FROM retiradas_sesion GROUP BY fecha
    )
  `);

  // Delete caja records for duplicate sessions
  await db.execute(`
    DELETE FROM retiradas_caja WHERE sesion_id NOT IN (
      SELECT MIN(id) FROM retiradas_sesion GROUP BY fecha
    )
  `);

  // Delete duplicate sessions themselves
  await db.execute(`
    DELETE FROM retiradas_sesion WHERE id NOT IN (
      SELECT MIN(id) FROM retiradas_sesion GROUP BY fecha
    )
  `);

  // Verify
  const remaining = await db.execute(
    "SELECT id, fecha, total_cajas, destino FROM retiradas_sesion ORDER BY fecha"
  );

  return NextResponse.json({ ok: true, remaining: remaining.rows });
}
