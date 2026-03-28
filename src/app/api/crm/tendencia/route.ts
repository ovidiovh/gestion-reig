import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { getCrmTendencia } from "@/lib/crm-queries";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const params = req.nextUrl.searchParams;
  const desde = params.get("desde") || new Date().getFullYear() + "-01-01";
  const hasta = params.get("hasta") || new Date().toISOString().slice(0, 10);

  const data = await getCrmTendencia(desde, hasta);
  return NextResponse.json(data);
}
