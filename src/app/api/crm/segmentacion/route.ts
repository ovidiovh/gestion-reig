import { NextRequest, NextResponse } from "next/server";
import { getCrmSegmentacion } from "@/lib/crm-queries";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const desde = params.get("desde");
    const year = desde ? new Date(desde).getFullYear() : Number(params.get("year") || new Date().getFullYear());
    const data = await getCrmSegmentacion(year);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[crm/segmentacion]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
