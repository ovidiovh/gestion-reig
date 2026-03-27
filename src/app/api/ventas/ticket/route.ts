import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { getLineasTicket } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const numDoc = req.nextUrl.searchParams.get("numDoc");
  if (!numDoc) {
    return NextResponse.json({ error: "numDoc requerido" }, { status: 400 });
  }

  const data = await getLineasTicket(numDoc);
  return NextResponse.json(data);
}
