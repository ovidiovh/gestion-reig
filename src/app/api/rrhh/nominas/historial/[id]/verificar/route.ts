// GET /api/rrhh/nominas/historial/[id]/verificar
//
// Verifica la integridad de un PDF archivado en el histórico:
//   1. Lee la fila de rrhh_nominas_historial por id.
//   2. Descarga el binario actual de Drive.
//   3. Calcula su SHA-256 y lo compara con `hash_pdf` almacenado.
//   4. Adicionalmente regenera el PDF desde `resumen_json` (snapshot congelado)
//      y compara también ese hash, para detectar tanto manipulación en Drive
//      como cambios en el motor que romperían la determinismo.
//
// Devuelve un informe { ok, hash_almacenado, hash_drive, hash_regenerado,
//                        match_drive, match_regenerado }.
//
// Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §9.1.

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getGoogleDriveAdapter } from "@/lib/nomina/storage/google-drive";
import { renderReigPDF } from "@/lib/nomina/pdf/template-reig";
import { renderMirelusPDF } from "@/lib/nomina/pdf/template-mirelus";
import type { ResumenMes } from "@/lib/nomina/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface FilaHistorial {
  id: string;
  mes: string;
  empresa: string;
  version: number;
  hash_pdf: string;
  drive_file_id: string;
  resumen_json: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const filas = await query<FilaHistorial>(
      `SELECT id, mes, empresa, version, hash_pdf, drive_file_id, resumen_json
         FROM rrhh_nominas_historial
        WHERE id = ?`,
      [id]
    );
    const fila = filas[0];
    if (!fila) {
      return NextResponse.json(
        { ok: false, error: "Versión no encontrada" },
        { status: 404 }
      );
    }

    // 1. Hash del binario actual en Drive
    const adapter = getGoogleDriveAdapter();
    let hashDrive: string | null = null;
    let driveError: string | null = null;
    try {
      const driveBuffer = await adapter.downloadPdf(fila.drive_file_id);
      hashDrive = createHash("sha256").update(driveBuffer).digest("hex");
    } catch (e) {
      driveError = String(e);
    }

    // 2. Hash del PDF regenerado desde el resumen congelado
    let hashRegenerado: string | null = null;
    let regenerError: string | null = null;
    try {
      const resumen = JSON.parse(fila.resumen_json) as ResumenMes;
      const buffer =
        fila.empresa === "reig"
          ? await renderReigPDF(resumen)
          : await renderMirelusPDF(resumen);
      hashRegenerado = createHash("sha256").update(buffer).digest("hex");
    } catch (e) {
      regenerError = String(e);
    }

    return NextResponse.json({
      ok: true,
      id: fila.id,
      mes: fila.mes,
      empresa: fila.empresa,
      version: fila.version,
      hash_almacenado: fila.hash_pdf,
      hash_drive: hashDrive,
      hash_regenerado: hashRegenerado,
      match_drive: hashDrive === fila.hash_pdf,
      match_regenerado: hashRegenerado === fila.hash_pdf,
      drive_error: driveError,
      regenerar_error: regenerError,
    });
  } catch (error) {
    console.error("[verificar]", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
