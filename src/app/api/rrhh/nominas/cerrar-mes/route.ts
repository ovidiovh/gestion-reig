// POST /api/rrhh/nominas/cerrar-mes
//
// Body: { mes: "YYYY-MM", notas?: string }
//
// Genera los DOS PDFs (Farmacia + Mirelus), los hashea, los sube a Google
// Drive y crea dos filas en `rrhh_nominas_historial` (una por empresa).
// Cada llamada incrementa el `version` para ese (mes, empresa). Nunca
// sobrescribe — el versionado es la auditoría.
//
// El `resumen_json` que se persiste es el snapshot completo del cálculo del
// motor en el momento del cierre. Esto permite, mucho tiempo después,
// regenerar el PDF bit a bit y entender exactamente con qué datos se generó.
//
// Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §9.1 (sesión 9).

import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { db, query } from "@/lib/db";
import { requirePermiso } from "@/lib/auth";
import { calcularNominaMes, type ResumenMes } from "@/lib/nomina/engine";
import { renderReigPDF } from "@/lib/nomina/pdf/template-reig";
import { renderMirelusPDF } from "@/lib/nomina/pdf/template-mirelus";
import { getGoogleDriveAdapter } from "@/lib/nomina/storage/google-drive";
import type { NominaStorageAdapter } from "@/lib/nomina/storage/types";

export const dynamic = "force-dynamic";
// Cierre del mes puede tardar 5-10 segundos (2 PDFs + 2 uploads a Drive).
// Aumentamos el límite por encima del default de Vercel.
export const maxDuration = 60;

interface VersionMaxRow {
  max_version: number | null;
}

interface CierreEmpresaResultado {
  empresa: "reig" | "mirelus";
  version: number;
  hash_pdf: string;
  bytes_pdf: number;
  drive_file_id: string;
  drive_web_view_link: string;
  drive_folder_id: string;
  filename: string;
}

async function siguienteVersion(
  mes: string,
  empresa: "reig" | "mirelus"
): Promise<number> {
  const rows = await query<VersionMaxRow>(
    `SELECT MAX(version) AS max_version
       FROM rrhh_nominas_historial
      WHERE mes = ? AND empresa = ?`,
    [mes, empresa]
  );
  const max = rows[0]?.max_version ?? 0;
  return (max || 0) + 1;
}

async function archivarEmpresa(
  adapter: NominaStorageAdapter,
  resumen: ResumenMes,
  mes: string,
  empresa: "reig" | "mirelus",
  cerradoPorEmail: string,
  notas: string | null
): Promise<CierreEmpresaResultado> {
  // 1. Renderizar PDF
  const buffer =
    empresa === "reig"
      ? await renderReigPDF(resumen)
      : await renderMirelusPDF(resumen);

  // 2. Calcular hash y siguiente versión
  const hash = createHash("sha256").update(buffer).digest("hex");
  const version = await siguienteVersion(mes, empresa);
  const sufijo = empresa === "reig" ? "FARMACIA_REIG" : "MIRELUS";
  const filename = `nomina_${mes}_${sufijo}_v${version}.pdf`;

  // 3. Subir a Drive
  const upload = await adapter.uploadPdf({
    mes,
    empresa,
    version,
    buffer,
    filename,
  });

  // 4. Insertar en historial
  // resumen_json incluye el ResumenMes ENTERO de las dos empresas porque
  // el cálculo es global; lo guardamos una vez por empresa por simetría
  // (mismas dos filas pueden compararse independientemente). Pesa ~5-10 KB.
  const id = randomUUID();
  const cerradoAt = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO rrhh_nominas_historial
          (id, mes, empresa, version, cerrado_at, cerrado_por_email,
           hash_pdf, bytes_pdf, drive_file_id, drive_web_view_link,
           drive_folder_id, resumen_json, notas, obsoleto)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    args: [
      id,
      mes,
      empresa,
      version,
      cerradoAt,
      cerradoPorEmail,
      hash,
      buffer.byteLength,
      upload.fileId,
      upload.webViewLink,
      upload.folderId,
      JSON.stringify(resumen),
      notas,
    ],
  });

  // 5. Audit log (cross-cutting)
  try {
    await db.execute({
      sql: `INSERT INTO audit_log (usuario_email, usuario_nombre, accion, modulo, detalle)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        cerradoPorEmail,
        "",
        "cierre_nomina",
        "rrhh_nominas",
        JSON.stringify({
          mes,
          empresa,
          version,
          hash_pdf: hash,
          bytes_pdf: buffer.byteLength,
          drive_file_id: upload.fileId,
        }),
      ],
    });
  } catch {
    // audit_log puede no existir en deploys antiguos; no bloquear el cierre
  }

  return {
    empresa,
    version,
    hash_pdf: hash,
    bytes_pdf: buffer.byteLength,
    drive_file_id: upload.fileId,
    drive_web_view_link: upload.webViewLink,
    drive_folder_id: upload.folderId,
    filename,
  };
}

export async function POST(req: NextRequest) {
  const check = await requirePermiso("rrhh_nominas");
  if ("error" in check) return check.error;
  const { user } = check;

  try {

    let body: { mes?: string; notas?: string } = {};
    try {
      body = (await req.json()) as { mes?: string; notas?: string };
    } catch {
      return NextResponse.json(
        { ok: false, error: "Body JSON inválido" },
        { status: 400 }
      );
    }

    const mes = body.mes;
    const notas = body.notas?.trim() || null;

    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json(
        { ok: false, error: "Parámetro 'mes' requerido (formato YYYY-MM)" },
        { status: 400 }
      );
    }

    // 1. Calcular el resumen UNA sola vez (los dos PDFs leen del mismo)
    const resumen = await calcularNominaMes(mes);

    // 2. Archivar las dos empresas
    const adapter = getGoogleDriveAdapter();
    const farmacia = await archivarEmpresa(
      adapter,
      resumen,
      mes,
      "reig",
      user.email,
      notas
    );
    const mirelus = await archivarEmpresa(
      adapter,
      resumen,
      mes,
      "mirelus",
      user.email,
      notas
    );

    return NextResponse.json({
      ok: true,
      mes,
      cerrado_por: user.email,
      cerrado_at: new Date().toISOString(),
      farmacia,
      mirelus,
    });
  } catch (error) {
    console.error("[cerrar-mes]", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
