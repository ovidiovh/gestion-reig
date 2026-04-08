// Entry point del motor de nómina.
//
// Uso típico desde un route handler:
//
//   import { calcularNominaMes } from "@/lib/nomina/engine";
//   const { resultados, warnings } = await calcularNominaMes("2026-04");
//
// El motor hace UNA lectura global del mes y luego evalúa en memoria cada
// empleado con incluir_en_nomina=1. Devuelve un array ordenado por orden de
// ficha, listo para renderizarse en tabla o para alimentar el generador de PDF.

import { query } from "@/lib/db";
import type { EmpleadoNomina, ResultadoNomina } from "./tipos";
import { cargarDatosMes, contextoPara } from "./contexto";
import { calcularNominaEmpleado } from "./calculadores";

export interface ResumenMes {
  mes: string;
  /**
   * Días laborables L-V efectivos del mes (calendario menos festivos oficiales).
   * Sale en la cabecera de la hoja de horas a la gestoría como "Días trabajados: N".
   */
  dias_laborables_mes: number;
  resultados: ResultadoNomina[];
  resultados_farmacia: ResultadoNomina[];
  resultados_mirelus: ResultadoNomina[];
  warnings_globales: string[];
  /** Número de empleados procesados. */
  total: number;
}

/**
 * Calcula la nómina de TODOS los empleados con incluir_en_nomina=1 para el
 * mes dado. Devuelve resultados divididos por empresa (farmacia=reig, mirelus).
 */
export async function calcularNominaMes(mes: string): Promise<ResumenMes> {
  // Validación básica del formato
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    throw new Error(`Mes inválido: ${mes}. Formato esperado YYYY-MM.`);
  }

  const empleados = await query<EmpleadoNomina>(
    `SELECT id, nombre, nombre_formal_nomina, categoria, empresa,
            farmaceutico, hace_guardia, cubre_nocturna,
            tipo_calculo, complemento_mensual_eur, h_lab_complemento_mensual,
            h_extras_fijas_mes, h_extras_fijas_semana, h_extra_diaria,
            descuenta_media_en_guardia
     FROM rrhh_empleados
     WHERE incluir_en_nomina = 1
     ORDER BY orden ASC`
  );

  const datos = await cargarDatosMes(mes);
  const warnings_globales: string[] = [];
  const resultados: ResultadoNomina[] = [];

  for (const emp of empleados) {
    const ctx = contextoPara(emp, datos);
    const res = calcularNominaEmpleado(emp, ctx);
    // La 5ª columna "Notas" del PDF (ver template-reig.ts y
    // template-mirelus.ts) se rellena con las ausencias del mes que no son
    // vacaciones normales. El contexto ya las trae formateadas en notas_ausencias;
    // el motor las concatena con " · " para que el template solo tenga que
    // pintarlas tal cual. Ver ausencias-y-permisos.md §7 y sesión 10 (2026-04-08).
    res.notas_mes = ctx.notas_ausencias.join(" · ");
    resultados.push(res);
  }

  return {
    mes,
    dias_laborables_mes:
      datos.dias_laborables_calendario - datos.dias_laborables_festivos,
    resultados,
    resultados_farmacia: resultados.filter((r) => r.empresa === "reig"),
    resultados_mirelus: resultados.filter((r) => r.empresa === "mirelus"),
    warnings_globales,
    total: resultados.length,
  };
}
