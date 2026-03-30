import { NextRequest, NextResponse } from "next/server";
import { getCrmTendencia } from "@/lib/crm-queries";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const year = Number(params.get("year") || new Date().getFullYear());
    const data = await getCrmTendencia(year);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[crm/tendencia]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
