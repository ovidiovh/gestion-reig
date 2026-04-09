// GET /api/rrhh/nominas?mes=YYYY-MM
//
// Calcula y devuelve los resultados del motor de nómina para el mes dado.
// Ver src/lib/nomina/engine.ts y REIG-BASE → nominas-rrhh.md §5 y §13.
//
// Respuesta:
//   {
//     ok: true,
//     mes: "2026-04",
//     total: 14,
//     resultados: [...],
//     resultados_farmacia: [...],
//     resultados_mirelus: [...],
//     warnings_globales: [...]
//   }
//
// No modifica BD. No genera PDFs (pendiente Paso 2.1).

import { NextRequest, NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";
import { calcularNominaMes } from "@/lib/nomina/engine";

export async function GET(req: NextRequest) {
  const check = await requirePermiso("rrhh_nominas");
  if ("error" in check) return check.error;

  try {
    const mes = req.nextUrl.searchParams.get("mes");
    if (!mes) {
      return NextResponse.json(
        { ok: false, error: "Parámetro 'mes' requerido (formato YYYY-MM)" },
        { status: 400 }
      );
    }

    const resumen = await calcularNominaMes(mes);
    return NextResponse.json({ ok: true, ...resumen });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
