import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";
import { getCrmComparativa } from "@/lib/crm-queries";

export const maxDuration = 60;

export async function GET() {
  const check = await requirePermiso("marketing_crm");
  if ("error" in check) return check.error;

  try {
    const data = await getCrmComparativa();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[crm/comparativa]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
