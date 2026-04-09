import { NextRequest, NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";
import { getCrmTendencia } from "@/lib/crm-queries";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const check = await requirePermiso("marketing_crm");
  if ("error" in check) return check.error;

  try {
    const params = req.nextUrl.searchParams;
    const desde = params.get("desde");
    const year = desde ? new Date(desde).getFullYear() : Number(params.get("year") || new Date().getFullYear());
    const data = await getCrmTendencia(year);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[crm/tendencia]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
