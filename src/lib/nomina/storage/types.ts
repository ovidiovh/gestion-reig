// Interfaz abstracta del storage adapter para PDFs de nóminas archivadas.
//
// El módulo /rrhh/nominas tiene un botón "🔒 Cerrar mes" que genera los PDFs
// de Farmacia + Mirelus, los hashea, los sube a un almacén externo y guarda
// la metadata en `rrhh_nominas_historial`. Este fichero define la interfaz
// que cualquier almacén debe cumplir.
//
// Implementación actual: GoogleDriveAdapter (ver ./google-drive.ts).
// El día que se quiera migrar a OneDrive, S3, Vercel Blob o el almacenamiento
// que sea, basta con escribir otra clase que cumpla esta interfaz y cambiar
// la línea de instanciación en `cerrar-mes/route.ts`.
//
// Decisión 2026-04-07 (sesión 9): el storage definitivo del histórico de
// nóminas vive en Google Drive del propietario (`ovidiov@gmail.com`),
// dentro de una carpeta compartida con el email de farmacia. Esto sustituye
// al envío automático por email (Resend) que estaba previsto en Paso 2.2,
// porque tener los PDFs en una carpeta Drive compartida cubre el caso de
// distribución a la gestoría sin necesidad de SMTP. Ver REIG-BASE →
// 06-OPERATIVA-FARMACIA/nominas-rrhh.md §9.1 y §14.

export interface NominaStorageUploadInput {
  /** Mes en formato YYYY-MM, p. ej. "2026-04". */
  mes: string;
  /** Empresa: "reig" (Farmacia) o "mirelus". */
  empresa: "reig" | "mirelus";
  /** Versión incremental dentro del mes/empresa (1, 2, 3...). */
  version: number;
  /** Buffer del PDF ya generado. */
  buffer: Buffer;
  /** Nombre de fichero a usar en el almacén. */
  filename: string;
}

export interface NominaStorageUploadResult {
  /** ID del fichero subido (depende del proveedor). */
  fileId: string;
  /** URL pública para abrir el fichero (Drive: webViewLink). */
  webViewLink: string;
  /** ID de la carpeta padre donde se subió. */
  folderId: string;
}

export interface NominaStorageAdapter {
  /** Sube un PDF al almacén y devuelve los metadatos del fichero creado. */
  uploadPdf(input: NominaStorageUploadInput): Promise<NominaStorageUploadResult>;

  /** Elimina (soft o hard, según implementación) un fichero por su ID. */
  deletePdf(fileId: string): Promise<void>;

  /** Devuelve el binario del fichero como Buffer (para verificar integridad). */
  downloadPdf?(fileId: string): Promise<Buffer>;
}
