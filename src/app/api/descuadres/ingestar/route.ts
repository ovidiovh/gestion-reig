/**
 * Webhook Descuadres — POST
 * Endpoint protegido por API key para la tarea programada de Cowork.
 *
 * La tarea de las 8:30 (L-S) lee Gmail, parsea los emails de Farmatic
 * con subject "Cierre de caja", y los envía aquí ya procesados.
 *
 * Autenticación: header "x-api-key" debe coincidir con DESCUADRES_WEBHOOK_KEY env var.
 *
 * Body esperado:
 *   { emails: [{ messageId, fecha_cierre, hora_cierre, saldo, tarjetas_dia_anterior,
 *                descuadre, importe_apertura, email_fecha_envio }] }
 *
 * La asignación de caja por orden ya viene hecha desde la tarea de Cowork.
 */
import { NextRequest, NextResponse } from "next/server";
import { guardarCierresBatch, existeEmailId, type CierreInput } from "@/lib/descuadres";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Validar API key
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = process.env.DESCUADRES_WEBHOOK_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const cierres: CierreInput[] = body.emails || body.cierres || [];

    if (cierres.length === 0) {
      return NextResponse.json({ ok: true, insertados: 0, duplicados: 0, mensaje: "Sin datos" });
    }

    // Filtrar duplicados antes de insertar
    const nuevos: CierreInput[] = [];
    let duplicadosPrevios = 0;

    for (const cierre of cierres) {
      if (cierre.email_id && await existeEmailId(cierre.email_id)) {
        duplicadosPrevios++;
        continue;
      }
      nuevos.push(cierre);
    }

    const result = await guardarCierresBatch(nuevos);

    return NextResponse.json({
      ok: true,
      insertados: result.insertados,
      duplicados: duplicadosPrevios + result.duplicados,
      procesados: cierres.length,
    });
  } catch (e) {
    console.error("[api/descuadres/ingestar] POST:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
