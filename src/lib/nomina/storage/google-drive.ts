// Implementación del NominaStorageAdapter contra Google Drive vía service account.
//
// Setup necesario en Vercel (variables de entorno):
//   GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON  → JSON completo de la cuenta de servicio
//                                        (descargado desde Google Cloud Console).
//   GOOGLE_DRIVE_NOMINAS_FOLDER_ID    → ID de la carpeta padre donde viven los
//                                        históricos. La carpeta debe estar
//                                        compartida con el email del service
//                                        account con permiso de Editor.
//
// La carpeta padre alberga subcarpetas por mes (`2026-04`, `2026-05`, ...) que
// se crean on-demand la primera vez que se cierra ese mes. Dentro de cada
// subcarpeta los PDFs se nombran `nomina_{mes}_{empresa}_v{version}.pdf`.
//
// Para evitar crear la subcarpeta dos veces, esta implementación cachea el
// `folderId` en memoria por proceso (`folderCache`). En serverless de Vercel
// el caché muere entre invocaciones, pero antes de crear una subcarpeta nueva
// hace una `files.list` por nombre, así que es idempotente.
//
// Decisión 2026-04-07 (sesión 9): Drive es la primera implementación.
// Migración futura a OneDrive (Microsoft Graph) implica solo escribir otra
// clase que cumpla `NominaStorageAdapter`. Ver `./types.ts`.

import { google } from "googleapis";
import type { drive_v3 } from "googleapis";
import type {
  NominaStorageAdapter,
  NominaStorageUploadInput,
  NominaStorageUploadResult,
} from "./types";

const FOLDER_MIME = "application/vnd.google-apps.folder";

let driveClient: drive_v3.Drive | null = null;
const folderCache: Map<string, string> = new Map(); // mes → subfolderId

function getDrive(): drive_v3.Drive {
  if (driveClient) return driveClient;

  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "Falta GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON en variables de entorno"
    );
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON no es JSON válido: ${String(e)}`
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

function getRootFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_NOMINAS_FOLDER_ID;
  if (!id) {
    throw new Error(
      "Falta GOOGLE_DRIVE_NOMINAS_FOLDER_ID en variables de entorno"
    );
  }
  return id;
}

/**
 * Devuelve el ID de la subcarpeta del mes (`YYYY-MM`) dentro de la carpeta
 * raíz del histórico de nóminas. Si no existe, la crea. Si existe, la
 * reutiliza. Cachea el resultado en memoria del proceso.
 */
async function ensureMonthFolder(mes: string): Promise<string> {
  const cached = folderCache.get(mes);
  if (cached) return cached;

  const drive = getDrive();
  const rootId = getRootFolderId();

  // Buscar primero por nombre dentro de la carpeta padre.
  // supportsAllDrives + includeItemsFromAllDrives son obligatorios para que
  // la API mire dentro de Unidades Compartidas (Shared Drives). Sin ellos
  // la cuenta de servicio no ve nada aunque sea miembro de la unidad.
  const list = await drive.files.list({
    q: `name = '${mes}' and mimeType = '${FOLDER_MIME}' and '${rootId}' in parents and trashed = false`,
    fields: "files(id, name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const found = list.data.files?.[0];
  if (found?.id) {
    folderCache.set(mes, found.id);
    return found.id;
  }

  // No existe → crearla
  const created = await drive.files.create({
    requestBody: {
      name: mes,
      mimeType: FOLDER_MIME,
      parents: [rootId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  if (!created.data.id) {
    throw new Error(`No se pudo crear la subcarpeta de Drive para ${mes}`);
  }

  folderCache.set(mes, created.data.id);
  return created.data.id;
}

export class GoogleDriveAdapter implements NominaStorageAdapter {
  async uploadPdf(
    input: NominaStorageUploadInput
  ): Promise<NominaStorageUploadResult> {
    const drive = getDrive();
    const folderId = await ensureMonthFolder(input.mes);

    // googleapis acepta un stream o un Buffer. Para PDFs pequeños (<100 KB)
    // es perfectamente válido pasar el Buffer directo vía Readable.from().
    const { Readable } = await import("stream");
    const body = Readable.from(input.buffer);

    const created = await drive.files.create({
      requestBody: {
        name: input.filename,
        parents: [folderId],
        mimeType: "application/pdf",
      },
      media: {
        mimeType: "application/pdf",
        body,
      },
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });

    if (!created.data.id) {
      throw new Error("Drive no devolvió file ID al subir el PDF");
    }

    // webViewLink no siempre llega en la primera respuesta dependiendo del
    // tipo de cuenta. Si falta, hacemos una segunda llamada explícita.
    let webViewLink = created.data.webViewLink;
    if (!webViewLink) {
      const re = await drive.files.get({
        fileId: created.data.id,
        fields: "webViewLink",
        supportsAllDrives: true,
      });
      webViewLink = re.data.webViewLink || `https://drive.google.com/file/d/${created.data.id}/view`;
    }

    return {
      fileId: created.data.id,
      webViewLink,
      folderId,
    };
  }

  async deletePdf(fileId: string): Promise<void> {
    const drive = getDrive();
    await drive.files.delete({ fileId, supportsAllDrives: true });
  }

  async downloadPdf(fileId: string): Promise<Buffer> {
    const drive = getDrive();
    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );
    // res.data es un ArrayBuffer cuando responseType es "arraybuffer"
    return Buffer.from(res.data as ArrayBuffer);
  }
}

/** Singleton para reutilizar el adapter entre invocaciones del mismo proceso. */
let adapterSingleton: GoogleDriveAdapter | null = null;

export function getGoogleDriveAdapter(): GoogleDriveAdapter {
  if (!adapterSingleton) adapterSingleton = new GoogleDriveAdapter();
  return adapterSingleton;
}
