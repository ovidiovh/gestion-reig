// Template PDF — pestaña Farmacia Reig
//
// Diseño "corporativo light": cabecera con banda verde Reig, título y mes,
// línea de "Días trabajados", tabla idéntica en estructura a la de Mirelus
// (6 columnas) pero con el header de tabla en verde corporativo.
//
// Recibe el ResumenMes del motor (src/lib/nomina/engine.ts) y devuelve un
// Buffer con el PDF listo para descargar o archivar.

import PDFDocument from "pdfkit";
import type { ResumenMes } from "@/lib/nomina/engine";
import type { ResultadoNomina } from "@/lib/nomina/tipos";
import {
  FONT_REGULAR,
  FONT_BOLD,
  MARGEN,
  REIG_VERDE,
  REIG_VERDE_OSCURO,
  GRIS_LINEA,
  NEGRO,
  BLANCO,
} from "./colors";

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function nombreMes(mes: string): string {
  const [y, m] = mes.split("-");
  return `${MESES_ES[parseInt(m, 10) - 1]} ${y}`;
}

function fmtNum(n: number): string {
  if (n === 0) return "";
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
 * Genera el PDF de Farmacia Reig en memoria y devuelve el Buffer.
 * Lee `dias_laborables_mes` directamente del ResumenMes que produce el motor.
 */
export function renderReigPDF(resumen: ResumenMes): Promise<Buffer> {
  const diasTrabajados = resumen.dias_laborables_mes;
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: MARGEN,
        info: {
          Title: `Nómina Farmacia Reig ${resumen.mes}`,
          Author: "Farmacia Reig",
          Subject: "Hoja de horas mensual para gestoría",
          CreationDate: new Date(),
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const anchoPagina = doc.page.width;
      const anchoUtil = anchoPagina - 2 * MARGEN;

      // ── 1. Banda verde con título ──────────────────────────────────
      const bandaY = MARGEN;
      const bandaAlto = 50;
      doc.rect(MARGEN, bandaY, anchoUtil, bandaAlto).fill(REIG_VERDE);

      doc.font(FONT_BOLD).fontSize(18).fillColor(BLANCO);
      doc.text("FARMACIA REIG", MARGEN + 14, bandaY + 8, {
        width: anchoUtil - 28,
        align: "left",
      });
      doc.font(FONT_REGULAR).fontSize(11).fillColor(BLANCO);
      doc.text(`Hoja de nómina · ${nombreMes(resumen.mes)}`, MARGEN + 14, bandaY + 30, {
        width: anchoUtil - 28,
        align: "left",
      });

      doc.fillColor(NEGRO);
      doc.y = bandaY + bandaAlto + 14;

      // ── 2. Línea de días trabajados ────────────────────────────────
      doc.font(FONT_REGULAR).fontSize(10);
      doc.text(`Días trabajados: ${diasTrabajados}`, MARGEN, doc.y);
      doc.moveDown(0.8);

      // ── 3. Tabla ───────────────────────────────────────────────────
      drawTabla(doc, resumen.resultados_farmacia);

      // ── 4. Pie ─────────────────────────────────────────────────────
      doc.moveDown(2);
      doc.font(FONT_REGULAR).fontSize(8).fillColor("#666666");
      const ahora = new Date().toLocaleString("es-ES", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
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
  const anchoTabla = cols.reduce((s, c) => s + c.width, 0);

  // Header con fondo verde corporativo
  doc.rect(startX, y, anchoTabla, rowHeight).fill(REIG_VERDE_OSCURO);
  doc.font(FONT_BOLD).fontSize(9).fillColor(BLANCO);
  let x = startX;
  for (const col of cols) {
    doc.text(col.label, x + 3, y + 5, { width: col.width - 6, align: col.align });
    x += col.width;
  }
  y += rowHeight;

  // Filas alternadas
  doc.font(FONT_REGULAR).fontSize(9).fillColor(NEGRO);
  let zebra = false;
  for (const fila of filas) {
    if (zebra) {
      doc.rect(startX, y, anchoTabla, rowHeight).fill("#F2F8F5");
      doc.fillColor(NEGRO);
    }
    x = startX;
    for (const col of cols) {
      doc.text(col.get(fila), x + 3, y + 5, { width: col.width - 6, align: col.align });
      x += col.width;
    }
    doc.strokeColor(GRIS_LINEA).lineWidth(0.5)
      .moveTo(startX, y + rowHeight)
      .lineTo(startX + anchoTabla, y + rowHeight)
      .stroke();
    y += rowHeight;
    zebra = !zebra;
  }

  // Cierre tabla con línea más gruesa en verde
  doc.strokeColor(REIG_VERDE_OSCURO).lineWidth(1.2)
    .moveTo(startX, y)
    .lineTo(startX + anchoTabla, y)
    .stroke();

  doc.y = y + 6;
}
