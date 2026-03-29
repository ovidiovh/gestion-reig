import { NextRequest, NextResponse } from "next/server";
import { getCrmVendedores } from "@/lib/crm-queries";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const desde = params.get("desde") || new Date().getFullYear() + "-01-01";
    const hasta = params.get("hasta") || new Date().toISOString().slice(0, 10);
    const data = await getCrmVendedores(desde, hasta);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[crm/vendedores]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
