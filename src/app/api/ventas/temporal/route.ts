import { NextRequest, NextResponse } from "next/server";
import { requireAuth, parseFilters } from "@/lib/api-helpers";
import { getTimeSeries } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const params = req.nextUrl.searchParams;
  const filters = parseFilters(params);
  const agrupacion = (params.get("agrupacion") as "mes" | "semana" | "dia") || "mes";

  const data = await getTimeSeries(filters, agrupacion);
  return NextResponse.json(data);
}
