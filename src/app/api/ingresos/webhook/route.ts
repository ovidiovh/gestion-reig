/**
 * Webhook Ingresos — POST
 * Endpoint público (protegido por API key) para que el Apps Script
 * envíe los datos de cada email procesado a Turso.
 *
 * El Apps Script llama a este endpoint con cada ingreso confirmado
 * por email del Santander, para que la app tenga los mismos datos
 * que el Google Sheet.
 *
 * Autenticación: header "x-api-key" debe coincidir con INGRESOS_WEBHOOK_KEY env var.
 */
import { NextRequest, NextResponse } from "next/server";
import { guardarIngreso, existeEmailId } from "@/lib/ingresos";

export async function POST(req: NextRequest) {
  // Validar API key
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = process.env.INGRESOS_WEBHOOK_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Puede recibir un ingreso individual o un array
    const ingresos: Array<{
      fecha: string;
      hora?: string;
      concepto: string;
      importe: number;
      num_operacion?: string;
      email_id?: string;
    }> = Array.isArray(body) ? body : [body];

    let insertados = 0;
    let duplicados = 0;

    for (const ing of ingresos) {
      // Validar campos mínimos
      if (!ing.fecha || !ing.concepto || !ing.importe) {
        continue;
      }

      // Evitar duplicados por email_id
      if (ing.email_id) {
        const existe = await existeEmailId(ing.email_id);
        if (existe) {
          duplicados++;
          continue;
        }
      }

      await guardarIngreso({
        fecha: ing.fecha,
        hora: ing.hora || undefined,
        concepto: ing.concepto,
        importe: ing.importe,
        num_operacion: ing.num_operacion || undefined,
        origen: "email",
        email_id: ing.email_id || undefined,
        usuario_email: "ingresos@farmaciareig.net",
        usuario_nombre: "Script Santander",
      });

      insertados++;
    }

    return NextResponse.json({
      ok: true,
      insertados,
      duplicados,
      total: ingresos.length,
    });
  } catch (e) {
    console.error("[api/ingresos/webhook] POST:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
