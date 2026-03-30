import { NextRequest, NextResponse } from "next/server";
import { getCrmProductos } from "@/lib/crm-queries";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const year = Number(params.get("year") || new Date().getFullYear());
    const orderBy = (params.get("orderBy") as "facturacion" | "unidades") || "facturacion";
    const limit = Number(params.get("limit") || 20);
    const data = await getCrmProductos(year, limit, orderBy);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[crm/productos]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
