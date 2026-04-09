import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getTicketsVendedor } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const check = await requireAuth();
  if ("error" in check) return check.error;

  const p = req.nextUrl.searchParams;
  const fecha = p.get("fecha");
  const vendedor = p.get("vendedor");

  if (!fecha || !vendedor) {
    return NextResponse.json(
      { error: "fecha y vendedor requeridos" },
      { status: 400 }
    );
  }

  const data = await getTicketsVendedor(fecha, vendedor);
  return NextResponse.json(data);
}
