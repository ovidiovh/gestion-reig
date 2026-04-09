import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { parseFilters } from "@/lib/api-helpers";
import { getTimeSeries } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const check = await requireAuth();
  if ("error" in check) return check.error;

  const params = req.nextUrl.searchParams;
  const filters = parseFilters(params);
  const agrupacion = (params.get("agrupacion") as "mes" | "semana" | "dia") || "mes";

  const data = await getTimeSeries(filters, agrupacion);
  return NextResponse.json(data);
}
