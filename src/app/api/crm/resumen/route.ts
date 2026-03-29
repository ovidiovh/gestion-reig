import { NextRequest, NextResponse } from "next/server";
import { getCrmResumen } from "@/lib/crm-queries";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const desde = params.get("desde") || new Date().getFullYear() + "-01-01";
    const hasta = params.get("hasta") || new Date().toISOString().slice(0, 10);
    const data = await getCrmResumen(desde, hasta);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[crm/resumen]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
