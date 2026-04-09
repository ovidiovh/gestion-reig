import { NextRequest, NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";
import { getCrmCronograma } from "@/lib/crm-queries";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const check = await requirePermiso("marketing_crm");
  if ("error" in check) return check.error;

  try {
    const params = req.nextUrl.searchParams;
    const desde = params.get("desde") || new Date().getFullYear() + "-01-01";
    const hasta = params.get("hasta") || new Date().toISOString().slice(0, 10);
    const data = await getCrmCronograma(desde, hasta);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[crm/cronograma]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
