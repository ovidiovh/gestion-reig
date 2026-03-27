import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { getTicketsVendedor } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

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
