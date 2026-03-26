import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// ONE-TIME import endpoint — DELETE after use
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("key");
  if (secret !== "reig-import-2026") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = [
    {
      fecha: "2026-03-23", cajas: [
        { n: 1, b100: 0, b50: 3, b20: 0, b10: 0, b5: 0 },
        { n: 2, b100: 1, b50: 1, b20: 0, b10: 0, b5: 0 },
        { n: 3, b100: 0, b50: 9, b20: 0, b10: 0, b5: 0 },
        { n: 4, b100: 0, b50: 3, b20: 0, b10: 0, b5: 0 },
        { n: 5, b100: 0, b50: 5, b20: 0, b10: 0, b5: 0 },
        { n: 6, b100: 1, b50: 5, b20: 0, b10: 0, b5: 0 },
        { n: 7, b100: 0, b50: 3, b20: 0, b10: 0, b5: 0 },
      ],
      audit: { b100: 2, b50: 29, b20: 0, b10: 0, b5: 0 },
    },
    {
      fecha: "2026-03-24", cajas: [
        { n: 1, b100: 0, b50: 6, b20: 10, b10: 0, b5: 0 },
        { n: 2, b100: 0, b50: 5, b20: 5, b10: 0, b5: 0 },
        { n: 3, b100: 0, b50: 5, b20: 5, b10: 0, b5: 0 },
        { n: 4, b100: 0, b50: 2, b20: 5, b10: 0, b5: 0 },
        { n: 5, b100: 0, b50: 2, b20: 5, b10: 0, b5: 0 },
        { n: 6, b100: 0, b50: 5, b20: 0, b10: 0, b5: 0 },
        { n: 7, b100: 0, b50: 4, b20: 0, b10: 0, b5: 0 },
      ],
      audit: { b100: 0, b50: 29, b20: 30, b10: 0, b5: 0 },
    },
    {
      fecha: "2026-03-26", cajas: [
        { n: 1, b100: 0, b50: 1, b20: 5, b10: 0, b5: 0 },
        { n: 2, b100: 0, b50: 3, b20: 0, b10: 0, b5: 0 },
        { n: 3, b100: 0, b50: 0, b20: 5, b10: 0, b5: 0 },
        { n: 5, b100: 0, b50: 0, b20: 5, b10: 0, b5: 0 },
        { n: 6, b100: 0, b50: 0, b20: 5, b10: 0, b5: 0 },
        { n: 7, b100: 0, b50: 1, b20: 5, b10: 0, b5: 0 },
      ],
      audit: { b100: 0, b50: 5, b20: 25, b10: 0, b5: 0 },
    },
  ];

  const results = [];

  for (const d of data) {
    const cajasT = d.cajas.map((c) => {
      const total = (c.b100 || 0) * 100 + (c.b50 || 0) * 50 + (c.b20 || 0) * 20 + (c.b10 || 0) * 10 + (c.b5 || 0) * 5;
      return { ...c, total, b200: 0 };
    });
    const totalCajas = cajasT.reduce((s, c) => s + c.total, 0);

    const r = await db.execute({
      sql: "INSERT INTO retiradas_sesion (fecha, destino, total_cajas) VALUES (?, ?, ?)",
      args: [d.fecha, "caja_fuerte", totalCajas],
    });
    const sid = Number(r.lastInsertRowid);

    for (const c of cajasT) {
      await db.execute({
        sql: "INSERT INTO retiradas_caja (sesion_id, num_caja, b200, b100, b50, b20, b10, b5, total) VALUES (?,?,?,?,?,?,?,?,?)",
        args: [sid, c.n, 0, c.b100 || 0, c.b50 || 0, c.b20 || 0, c.b10 || 0, c.b5 || 0, c.total],
      });
    }

    const a = d.audit;
    const tA = (a.b100 || 0) * 100 + (a.b50 || 0) * 50 + (a.b20 || 0) * 20 + (a.b10 || 0) * 10 + (a.b5 || 0) * 5;
    const sB = (k: string) => cajasT.reduce((s, c) => s + ((c as Record<string, number>)[k] || 0), 0);
    const cuadra = (a.b100 || 0) === sB("b100") && (a.b50 || 0) === sB("b50") && (a.b20 || 0) === sB("b20") && (a.b10 || 0) === sB("b10") && (a.b5 || 0) === sB("b5") ? 1 : 0;

    await db.execute({
      sql: "INSERT INTO retiradas_audit (sesion_id, b200, b100, b50, b20, b10, b5, total, cuadra) VALUES (?,?,?,?,?,?,?,?,?)",
      args: [sid, 0, a.b100 || 0, a.b50 || 0, a.b20 || 0, a.b10 || 0, a.b5 || 0, tA, cuadra],
    });
    await db.execute({
      sql: "UPDATE retiradas_sesion SET total_audit=?, auditada=? WHERE id=?",
      args: [tA, cuadra ? 1 : -1, sid],
    });

    results.push({ fecha: d.fecha, id: sid, total: totalCajas, audit: tA, cuadra });
  }

  return NextResponse.json({ ok: true, imported: results });
}
