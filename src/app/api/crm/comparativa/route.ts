import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { getCrmComparativa } from "@/lib/crm-queries";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const data = await getCrmComparativa();
  return NextResponse.json(data);
}
