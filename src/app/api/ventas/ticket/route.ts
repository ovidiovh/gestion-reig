import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getLineasTicket } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const check = await requireAuth();
  if ("error" in check) return check.error;

  const numDoc = req.nextUrl.searchParams.get("numDoc");
  if (!numDoc) {
    return NextResponse.json({ error: "numDoc requerido" }, { status: 400 });
  }

  const data = await getLineasTicket(numDoc);
  return NextResponse.json(data);
}
