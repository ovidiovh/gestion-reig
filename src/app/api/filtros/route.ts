import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { getVendedores, getRangoFechas } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const [vendedores, rango] = await Promise.all([
    getVendedores(),
    getRangoFechas(),
  ]);

  return NextResponse.json({ vendedores, rango });
}
