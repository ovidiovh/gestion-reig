// Motor de nómina — Paso 2.0 (2026-04-06)
//
// Este módulo calcula las 4 columnas que la gestoría espera en el PDF mensual:
//   laborables, festivos, nocturnas, complementos (€).
//
// Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §2 y §5 para la
// definición exacta de cada columna y las fórmulas por tipo_calculo.
//
// IMPORTANTE: el motor NO conoce la BD. Recibe todo precalculado como
// ContextoMes. Quien invoca el motor (el endpoint /api/rrhh/nominas) se
// encarga de materializar ese contexto desde Turso. Esto hace el motor
// testeable en unit tests sin BD real.

import type { TipoCalculoNomina } from "@/app/(app)/rrhh/types";

// ─── Entrada ────────────────────────────────────────────────────────────────

/** Empleado tal y como llega de rrhh_empleados. Incluye solo lo que el motor necesita. */
export interface EmpleadoNomina {
  id: string;
  nombre: string;
  nombre_formal_nomina: string | null;
  categoria: string;
  empresa: "reig" | "mirelus" | string;
  farmaceutico: number;
  hace_guardia: number;
  cubre_nocturna: number;
  tipo_calculo: TipoCalculoNomina | null;
  complemento_mensual_eur: number;
  h_lab_complemento_mensual: number; // ver overload §3 para mirelus_limpieza_fija
  h_extras_fijas_mes: number;
  h_extras_fijas_semana: number;
  h_extra_diaria: number;
  descuenta_media_en_guardia: number;
}

/** Una guardia asignada a este empleado en el mes objetivo. */
export interface GuardiaAsignada {
  fecha: string;      // YYYY-MM-DD
  dow: number;        // 0=dom, 1=lun, …, 6=sab
  es_festivo: boolean;
  hora_inicio: number | null;
  hora_fin: number | null;
  hora_inicio2: number | null;
  hora_fin2: number | null;
}

/** Contexto precomputado para UN empleado en UN mes concreto. */
export interface ContextoMes {
  /** Mes objetivo "YYYY-MM". */
  mes: string;
  /** Número de días laborables L-V del calendario (sin restar vacaciones ni festivos). */
  dias_laborables_calendario: number;
  /** Número de días laborables L-V que caen en festivo oficial. */
  dias_laborables_festivos: number;
  /** Número de viernes del mes (para cálculo de Zule). */
  viernes_mes: number;
  /** Días laborables L-V que el empleado está de vacaciones. */
  dias_vacaciones_empleado_labs: number;
  /** Viernes del mes que el empleado está de vacaciones (Zule). */
  viernes_vacaciones_empleado: number;
  /** Guardias efectivamente asignadas al empleado en el mes. */
  guardias_empleado: GuardiaAsignada[];
  /** Warnings acumulados durante la construcción del contexto (ej: datos sospechosos). */
  warnings: string[];
}

// ─── Salida ─────────────────────────────────────────────────────────────────

/** Las 5 columnas que recibe la gestoría + metadatos de trazabilidad. */
export interface ResultadoNomina {
  empleado_id: string;
  nombre: string;
  nombre_formal_nomina: string | null;
  empresa: "reig" | "mirelus" | string;
  tipo_calculo: TipoCalculoNomina | null;

  /** Horas laborables totales (fijas mensuales + extras fijas + extras diarias + guardia laboral). */
  laborables: number;
  /** Horas en festivo (solo guardia festiva o domingo). */
  festivos: number;
  /**
   * Horas nocturnas en día laborable. SUBSECCIÓN de `laborables` (NO aditiva).
   * Van en columna aparte porque la gestoría las paga con suplemento distinto.
   */
  nocturnas_laborables: number;
  /**
   * Horas nocturnas en día festivo/domingo. SUBSECCIÓN de `festivos` (NO aditiva).
   * Se pagan más que las nocturnas laborables → columna aparte.
   */
  nocturnas_festivas: number;
  /** Complemento fijo mensual en €. */
  complementos_eur: number;

  /** Desglose con los sub-componentes que dieron la suma final (para depurar). */
  desglose: {
    fijas_mes?: number;
    extras_fijas_mes?: number;
    extras_fijas_semana?: number;
    extras_diarias_mes?: number;
    descuento_vacaciones?: number;
    descuento_guardia_maria?: number;
    horas_guardia_laboral?: number;
    horas_guardia_festiva?: number;
    horas_guardia_nocturnas_lab?: number;
    horas_guardia_nocturnas_fest?: number;
    valor_fijo_gestoria?: boolean;
    dias_laborables_trabajados?: number;
    viernes_trabajados?: number;
    dias_guardia_total?: number;
    dias_guardia_lj_con_descuento?: number;
  };

  /** Avisos (placeholder, dato faltante, fórmula estimada…). */
  warnings: string[];
}
