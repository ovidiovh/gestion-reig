import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { getVendedoresDia } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const fecha = req.nextUrl.searchParams.get("fecha");
  if (!fecha) {
    return NextResponse.json({ error: "fecha requerida" }, { status: 400 });
  }

  const data = await getVendedoresDia(fecha, {});
  return NextResponse.json(data);
}
