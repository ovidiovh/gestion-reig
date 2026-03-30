import { NextRequest, NextResponse } from "next/server";
import { getCrmResumen } from "@/lib/crm-queries";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const desde = params.get("desde");
    const year = desde ? new Date(desde).getFullYear() : Number(params.get("year") || new Date().getFullYear());
    const data = await getCrmResumen(year);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[crm/resumen]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
