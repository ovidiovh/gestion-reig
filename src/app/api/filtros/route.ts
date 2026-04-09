import { NextRequest, NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";
import { getVendedores, getRangoFechas } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const check = await requirePermiso("marketing_clientes");
  if ("error" in check) return check.error;

  const [vendedores, rango] = await Promise.all([
    getVendedores(),
    getRangoFechas(),
  ]);

  return NextResponse.json({ vendedores, rango });
}
