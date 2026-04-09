/**
 * API Tarjetas (cobros con tarjeta por caja)
 *
 * GET /api/tarjetas?vista=dia&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 * GET /api/tarjetas?vista=semana&desde=...&hasta=...
 * GET /api/tarjetas?vista=mes&desde=...&hasta=...
 * GET /api/tarjetas?vista=dia_semana&desde=...&hasta=...
 * GET /api/tarjetas?vista=stats&desde=...&hasta=...
 *
 * Los datos provienen de descuadres_cierre.tarjetas_dia_anterior.
 * La fecha real de cobro se calcula según hora_cierre:
 *   < 14:00 → día anterior | >= 14:00 → mismo día
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";
import {
  tarjetasPorDia,
  tarjetasPorSemana,
  tarjetasPorMes,
  tarjetasPorDiaSemana,
  tarjetasEstadisticas,
} from "@/lib/tarjetas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const check = await requirePermiso("financiero_tarjetas");
  if ("error" in check) return check.error;

  try {
    const sp = req.nextUrl.searchParams;
    const vista = sp.get("vista") || "dia";
    const hoy = new Date().toISOString().slice(0, 10);

    // Por defecto: mes en curso
    const desde = sp.get("desde") || `${hoy.slice(0, 7)}-01`;
    const hasta = sp.get("hasta") || hoy;

    switch (vista) {
      case "dia":
        return NextResponse.json(await tarjetasPorDia(desde, hasta));

      case "semana":
        return NextResponse.json(await tarjetasPorSemana(desde, hasta));

      case "mes":
        return NextResponse.json(await tarjetasPorMes(desde, hasta));

      case "dia_semana":
        return NextResponse.json(await tarjetasPorDiaSemana(desde, hasta));

      case "stats":
        return NextResponse.json(await tarjetasEstadisticas(desde, hasta));

      default:
        return NextResponse.json({ error: `Vista '${vista}' no reconocida` }, { status: 400 });
    }
  } catch (e) {
    console.error("[api/tarjetas] GET:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
