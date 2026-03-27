import { NextRequest, NextResponse } from "next/server";
import { requireAuth, parseFilters } from "@/lib/api-helpers";
import { getKpis } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const filters = parseFilters(req.nextUrl.searchParams);
  const kpis = await getKpis(filters);
  return NextResponse.json(kpis);
}
