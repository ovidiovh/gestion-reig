import { NextRequest, NextResponse } from "next/server";
import { getCrmProductos } from "@/lib/crm-queries";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const desde = params.get("desde") || new Date().getFullYear() + "-01-01";
    const hasta = params.get("hasta") || new Date().toISOString().slice(0, 10);
    const orderBy = (params.get("orderBy") as "facturacion" | "unidades") || "facturacion";
    const limit = Number(params.get("limit") || 20);
    const data = await getCrmProductos(desde, hasta, limit, orderBy);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[crm/productos]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
