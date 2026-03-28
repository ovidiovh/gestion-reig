import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { getCrmVendedores } from "@/lib/crm-queries";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const params = req.nextUrl.searchParams;
  const desde = params.get("desde") || new Date().getFullYear() + "-01-01";
  const hasta = params.get("hasta") || new Date().toISOString().slice(0, 10);

  const data = await getCrmVendedores(desde, hasta);
  return NextResponse.json(data);
}
