import { NextRequest, NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";
import { parseFilters } from "@/lib/api-helpers";
import { getKpis } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const check = await requirePermiso("marketing_crm");
  if ("error" in check) return check.error;

  const filters = parseFilters(req.nextUrl.searchParams);
  const kpis = await getKpis(filters);
  return NextResponse.json(kpis);
}
