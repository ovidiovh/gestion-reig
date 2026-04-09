import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getVendedoresDia } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const check = await requireAuth();
  if ("error" in check) return check.error;

  const fecha = req.nextUrl.searchParams.get("fecha");
  if (!fecha) {
    return NextResponse.json({ error: "fecha requerida" }, { status: 400 });
  }

  const data = await getVendedoresDia(fecha, {});
  return NextResponse.json(data);
}
