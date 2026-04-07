// Script de PREVIEW del template PDF de Mirelus.
//
// Genera un PDF con datos mock realistas (los que daría el motor para abril
// 2026) y lo guarda en el path indicado por argumento. Pensado para validar
// el diseño visual antes de enchufar el endpoint a BD real.
//
// Uso:
//   npx tsx scripts/preview-nomina-pdf.ts <ruta-salida.pdf>
//
// No toca BD, no toca Vercel, no toca Turso.

import { writeFileSync } from "fs";
import { renderMirelusPDF } from "../src/lib/nomina/pdf/template-mirelus";
import { renderReigPDF } from "../src/lib/nomina/pdf/template-reig";
import type { ResumenMes } from "../src/lib/nomina/engine";
import type { ResultadoNomina } from "../src/lib/nomina/tipos";

interface MockArgs {
  id: string;
  nombre: string;
  formal: string;
  empresa: "reig" | "mirelus";
  laborables?: number;
  noct_lab?: number;
  noct_fest?: number;
  festivos?: number;
  complementos?: number;
  tipo: ResultadoNomina["tipo_calculo"];
}

function mock(a: MockArgs): ResultadoNomina {
  return {
    empleado_id: a.id,
    nombre: a.nombre,
    nombre_formal_nomina: a.formal,
    empresa: a.empresa,
    tipo_calculo: a.tipo,
    laborables: a.laborables ?? 0,
    nocturnas_laborables: a.noct_lab ?? 0,
    nocturnas_festivas: a.noct_fest ?? 0,
    festivos: a.festivos ?? 0,
    complementos_eur: a.complementos ?? 0,
    desglose: {},
    warnings: [],
  };
}

// Datos basados en la NÓMINA de marzo 2026 (REIG-BASE/06-OPERATIVA-FARMACIA/historico-nominas/),
// adaptados a abril 2026 con la nueva fórmula de Zule (commit 42109f1) y el split de nocturnas (fda1160).
// 22 días laborables, sin festivos especiales en abril 2026.
const farmacia: ResultadoNomina[] = [
  mock({ id: "yoli",   nombre: "Yoli",    formal: "REYES Gregoria",     empresa: "reig", laborables: 4,            tipo: "auxiliar_rotativo" }),
  mock({ id: "dulce",  nombre: "Dulce",   formal: "MORALES Dulce",      empresa: "reig", laborables: 13, complementos: 30, tipo: "auxiliar_rotativo" }),
  mock({ id: "ani",    nombre: "Ani",     formal: "LORENZO Ana",        empresa: "reig", laborables: 13, complementos: 30, tipo: "auxiliar_rotativo" }),
  mock({ id: "noelia", nombre: "Noelia",  formal: "LORENZO Noelia",     empresa: "reig", laborables: 13, complementos: 30, tipo: "auxiliar_fijo_partido" }),
  mock({ id: "leti",   nombre: "Leti",    formal: "Ruiz, Leticia",      empresa: "reig", laborables: 13, complementos: 30, tipo: "auxiliar_rotativo" }),
  mock({ id: "maria",  nombre: "María",   formal: "NARANJO María",      empresa: "reig", laborables: 19, noct_lab: 8, complementos: 180, tipo: "farmaceutico_nocturno" }),
  mock({ id: "julio",  nombre: "Julio",   formal: "AUYANET Julio",      empresa: "reig", laborables: 19, complementos: 280, tipo: "farmaceutico_diurno" }),
  mock({ id: "celia",  nombre: "Celia",   formal: "BAUBY, Celia",       empresa: "reig", laborables: 19, complementos: 280, tipo: "farmaceutico_diurno" }),
  // Zule: solo extras de viernes. Abril 2026 tiene 4 viernes (3,10,17,24) pero
  // el 3 es Viernes Santo (festivo) → 3 viernes efectivos × 4 h = 12 h.
  mock({ id: "zuleica",nombre: "Zule",    formal: "Cruz, Zule",         empresa: "reig", laborables: 12,                    tipo: "apoyo_estudiante_optica" }),
  mock({ id: "miriam", nombre: "Miriam",  formal: "Miriam (óptica)",    empresa: "reig",                                    tipo: "reig_fija_gestoria" }),
  mock({ id: "monica", nombre: "Mónica",  formal: "Mónica (ortopedia)", empresa: "reig",                                    tipo: "reig_fija_gestoria" }),
];

const mirelus: ResultadoNomina[] = [
  mock({ id: "javier",  nombre: "Javier",  formal: "Martel, Javier",     empresa: "mirelus", laborables: 24, complementos: 60, tipo: "mirelus_mantenimiento" }),
  mock({ id: "teresa",  nombre: "Teresa",  formal: "Santana, M Teresa",  empresa: "mirelus", laborables: 8,  tipo: "mirelus_limpieza_fija" }),
  mock({ id: "dolores", nombre: "Dolores", formal: "Estupiñán, Dolores", empresa: "mirelus", tipo: "mirelus_suplente" }),
  mock({ id: "luisa",   nombre: "Luisa",   formal: "Schmidt, Luisa",     empresa: "mirelus", tipo: "mirelus_fija_gestoria" }),
];

// Días laborables efectivos abril 2026: 22 L-V - 1 (Viernes Santo 3 abr) = 21.
const resumen: ResumenMes = {
  mes: "2026-04",
  dias_laborables_mes: 21,
  resultados: [...farmacia, ...mirelus],
  resultados_farmacia: farmacia,
  resultados_mirelus: mirelus,
  warnings_globales: [],
  total: farmacia.length + mirelus.length,
};

async function main() {
  const empresa = process.argv[2];
  const out = process.argv[3];
  if (!out || (empresa !== "reig" && empresa !== "mirelus")) {
    console.error("Uso: npx tsx scripts/preview-nomina-pdf.ts <reig|mirelus> <ruta-salida.pdf>");
    process.exit(1);
  }
  const buffer = empresa === "reig"
    ? await renderReigPDF(resumen)
    : await renderMirelusPDF(resumen);
  writeFileSync(out, buffer);
  console.log(`PDF generado: ${out} (${buffer.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
