// GET /api/rrhh/nominas/historial?mes=YYYY-MM
//
// Sin parámetro `mes`: devuelve los últimos 24 meses con conteo de versiones.
// Con `mes`: devuelve TODAS las versiones de ese mes (Farmacia + Mirelus,
// ordenadas por empresa y versión descendente).
//
// Solo metadatos — el `resumen_json` se omite por defecto porque puede pesar
// 5-10 KB por fila y la UI no lo necesita para el listado. Para verificar
// integridad de un PDF concreto, usar /api/rrhh/nominas/historial/[id]/verificar.
//
// Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §9.1.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface FilaHistorial {
  id: string;
  mes: string;
  empresa: string;
  version: number;
  cerrado_at: string;
  cerrado_por_email: string;
  hash_pdf: string;
  bytes_pdf: number;
  drive_file_id: string;
  drive_web_view_link: string;
  notas: string | null;
  obsoleto: number;
}

interface ResumenMesFila {
  mes: string;
  total_versiones: number;
  ultima_cerrada_at: string;
  ultima_cerrada_por: string;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const mes = req.nextUrl.searchParams.get("mes");

    if (mes) {
      if (!/^\d{4}-\d{2}$/.test(mes)) {
        return NextResponse.json(
          { ok: false, error: "Formato de mes inválido (YYYY-MM)" },
          { status: 400 }
        );
      }
      const filas = await query<FilaHistorial>(
        `SELECT id, mes, empresa, version, cerrado_at, cerrado_por_email,
                hash_pdf, bytes_pdf, drive_file_id, drive_web_view_link,
                notas, obsoleto
           FROM rrhh_nominas_historial
          WHERE mes = ?
          ORDER BY empresa ASC, version DESC`,
        [mes]
      );
      return NextResponse.json({ ok: true, mes, total: filas.length, filas });
    }

    // Sin mes → últimos 24 meses agrupados (resumen)
    const meses = await query<ResumenMesFila>(
      `SELECT mes,
              COUNT(*) AS total_versiones,
              MAX(cerrado_at) AS ultima_cerrada_at,
              (SELECT cerrado_por_email
                 FROM rrhh_nominas_historial h2
                WHERE h2.mes = h1.mes
                ORDER BY h2.cerrado_at DESC
                LIMIT 1) AS ultima_cerrada_por
         FROM rrhh_nominas_historial h1
        GROUP BY mes
        ORDER BY mes DESC
        LIMIT 24`
    );

    return NextResponse.json({ ok: true, total: meses.length, meses });
  } catch (error) {
    console.error("[historial]", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
