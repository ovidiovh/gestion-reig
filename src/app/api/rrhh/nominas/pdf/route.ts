// GET /api/rrhh/nominas/pdf?mes=YYYY-MM&empresa=farmacia|mirelus
//
// Genera el PDF de nómina de la empresa indicada para el mes dado.
// Llama al motor (calcularNominaMes) y despacha al template correspondiente.
// Devuelve el binario con Content-Disposition para que el navegador lo
// descargue como NOMINAS_YYYY-MM_<EMPRESA>.pdf.
//
// Paso 2.1 — primera entrega: solo descarga, sin firma ni archivo en BD.
// La persistencia (rrhh_nominas_envios) llega en una segunda tanda.
//
// Sin auth explícita aquí porque el middleware NextAuth ya protege /api/rrhh/*.

import { NextRequest, NextResponse } from "next/server";
import { calcularNominaMes } from "@/lib/nomina/engine";
import { renderReigPDF } from "@/lib/nomina/pdf/template-reig";
import { renderMirelusPDF } from "@/lib/nomina/pdf/template-mirelus";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const mes = req.nextUrl.searchParams.get("mes");
    const empresa = req.nextUrl.searchParams.get("empresa");

    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json(
        { ok: false, error: "Parámetro 'mes' requerido (formato YYYY-MM)" },
        { status: 400 }
      );
    }
    if (empresa !== "farmacia" && empresa !== "mirelus") {
      return NextResponse.json(
        { ok: false, error: "Parámetro 'empresa' requerido (farmacia | mirelus)" },
        { status: 400 }
      );
    }

    const resumen = await calcularNominaMes(mes);

    const buffer =
      empresa === "farmacia"
        ? await renderReigPDF(resumen)
        : await renderMirelusPDF(resumen);

    const sufijo = empresa === "farmacia" ? "FARMACIA_REIG" : "MIRELUS";
    const filename = `NOMINAS_${mes}_${sufijo}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
