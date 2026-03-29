import { NextResponse } from "next/server";
import { getCrmComparativa } from "@/lib/crm-queries";

export async function GET() {
  try {
    const data = await getCrmComparativa();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[crm/comparativa]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
