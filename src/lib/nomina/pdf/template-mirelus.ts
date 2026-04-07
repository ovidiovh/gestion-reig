// Template PDF — pestaña Mirelus
//
// "A palo seco": sin colores corporativos, sin datos legales de Mirelus SL,
// solo la tabla de horas y complementos. Decisión 2026-04-07 (Beatriz):
// "es trabajo no remunerado ni reconocido y no merece la pena diseñarlo".
//
// Recibe el ResumenMes del motor (src/lib/nomina/engine.ts) y devuelve un
// Buffer con el PDF listo para descargar o archivar.
//
// Estructura:
//   1. Cabecera: "NÓMINA MIRELUS — [MES AÑO]"
//   2. Línea con "Días trabajados: N"
//   3. Tabla 6 columnas: Empleado | Laborables | Noct.lab. | Festivos | Noct.fest. | Complemento €
//   4. Pie: fecha de generación + nota legal mínima

import PDFDocument from "pdfkit";
import type { ResumenMes } from "@/lib/nomina/engine";
import type { ResultadoNomina } from "@/lib/nomina/tipos";
import {
  FONT_REGULAR,
  FONT_BOLD,
  MARGEN,
  GRIS_LINEA,
  NEGRO,
} from "./colors";

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function nombreMes(mes: string): string {
  // mes = "YYYY-MM"
  const [y, m] = mes.split("-");
  return `${MESES_ES[parseInt(m, 10) - 1]} ${y}`;
}

function fmtNum(n: number): string {
  if (n === 0) return "";
  // Una decimal solo si hace falta
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

function fmtEur(n: number): string {
  if (n === 0) return "";
  return `${fmtNum(n)} €`;
}

function nombreEmpleado(r: ResultadoNomina): string {
  return r.nombre_formal_nomina || r.nombre;
}

/**
 * Genera el PDF de Mirelus en memoria y devuelve el Buffer.
 * Lee `dias_laborables_mes` directamente del ResumenMes que produce el motor.
 */
export function renderMirelusPDF(resumen: ResumenMes): Promise<Buffer> {
  const diasTrabajados = resumen.dias_laborables_mes;
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: MARGEN,
        info: {
          Title: `Nómina Mirelus ${resumen.mes}`,
          Author: "Farmacia Reig",
          Subject: "Hoja de horas mensual para gestoría",
          CreationDate: new Date(),
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // ── 1. Cabecera ────────────────────────────────────────────────
      doc.font(FONT_BOLD).fontSize(16).fillColor(NEGRO);
      doc.text(`NÓMINA MIRELUS — ${nombreMes(resumen.mes).toUpperCase()}`, {
        align: "left",
      });
      doc.moveDown(0.3);

      doc.font(FONT_REGULAR).fontSize(10);
      doc.text(`Días trabajados: ${diasTrabajados}`);
      doc.moveDown(0.8);

      // ── 2. Tabla ───────────────────────────────────────────────────
      const filas = resumen.resultados_mirelus;
      drawTabla(doc, filas);

      // ── 3. Pie ─────────────────────────────────────────────────────
      doc.moveDown(2);
      doc.font(FONT_REGULAR).fontSize(8).fillColor("#666666");
      const ahora = new Date().toLocaleString("es-ES", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      const anchoUtil = doc.page.width - 2 * MARGEN;
      doc.text(`Generado por gestion.vidalreig.com el ${ahora}`, MARGEN, doc.y, {
        width: anchoUtil,
        align: "right",
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ── Helpers de tabla ────────────────────────────────────────────────────────

interface Columna {
  label: string;
  width: number;
  align: "left" | "right" | "center";
  get: (r: ResultadoNomina) => string;
}

function drawTabla(doc: InstanceType<typeof PDFDocument>, filas: ResultadoNomina[]) {
  const cols: Columna[] = [
    { label: "Empleado",     width: 170, align: "left",  get: (r) => nombreEmpleado(r) },
    { label: "Laborables",   width: 70,  align: "right", get: (r) => fmtNum(r.laborables) },
    { label: "Noct. lab.",   width: 65,  align: "right", get: (r) => fmtNum(r.nocturnas_laborables) },
    { label: "Festivos",     width: 65,  align: "right", get: (r) => fmtNum(r.festivos) },
    { label: "Noct. fest.",  width: 65,  align: "right", get: (r) => fmtNum(r.nocturnas_festivas) },
    { label: "Complemento",  width: 70,  align: "right", get: (r) => fmtEur(r.complementos_eur) },
  ];

  const startX = MARGEN;
  let y = doc.y;
  const rowHeight = 18;

  // Header
  doc.font(FONT_BOLD).fontSize(9).fillColor(NEGRO);
  let x = startX;
  for (const col of cols) {
    doc.text(col.label, x + 3, y + 4, { width: col.width - 6, align: col.align });
    x += col.width;
  }
  // Línea bajo header
  doc.strokeColor(NEGRO).lineWidth(1)
    .moveTo(startX, y + rowHeight)
    .lineTo(x, y + rowHeight)
    .stroke();

  y += rowHeight;

  // Filas
  doc.font(FONT_REGULAR).fontSize(9);
  for (const fila of filas) {
    x = startX;
    for (const col of cols) {
      doc.text(col.get(fila), x + 3, y + 4, { width: col.width - 6, align: col.align });
      x += col.width;
    }
    // Línea separadora suave
    doc.strokeColor(GRIS_LINEA).lineWidth(0.5)
      .moveTo(startX, y + rowHeight)
      .lineTo(x, y + rowHeight)
      .stroke();
    y += rowHeight;
  }

  // Cierre tabla con línea más gruesa
  doc.strokeColor(NEGRO).lineWidth(1)
    .moveTo(startX, y)
    .lineTo(startX + cols.reduce((s, c) => s + c.width, 0), y)
    .stroke();

  doc.y = y + 6;
}
