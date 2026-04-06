// Motor de nómina — calculadores por tipo_calculo.
//
// Cada función recibe (empleado, contextoMes) y devuelve ResultadoNomina.
// Son funciones puras: todo lo que necesitan viene en los argumentos.
//
// Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §5 para las fórmulas.

import type { TipoCalculoNomina } from "@/app/(app)/rrhh/types";
import type { EmpleadoNomina, ContextoMes, ResultadoNomina, GuardiaAsignada } from "./tipos";
import { horasGuardiaMaria, VALORES_FIJOS_GESTORIA } from "./constantes";

// ─── Utilidad común ─────────────────────────────────────────────────────────

function resultadoBase(emp: EmpleadoNomina): ResultadoNomina {
  return {
    empleado_id: emp.id,
    nombre: emp.nombre,
    nombre_formal_nomina: emp.nombre_formal_nomina,
    empresa: emp.empresa,
    tipo_calculo: emp.tipo_calculo,
    laborables: 0,
    festivos: 0,
    nocturnas: 0,
    complementos_eur: 0,
    desglose: {},
    warnings: [],
  };
}

/**
 * Agrega las horas de todas las guardias del empleado aplicando la tabla §6.
 * Solo se usa para María (única que hace guardias nocturnas). Los auxiliares
 * no se calculan aquí — su horario de guardia es diurno y entra como "h_extras_fijas_mes".
 */
function horasGuardiasNocturnas(guardias: GuardiaAsignada[]): {
  laborables: number;
  festivas: number;
  nocturnas: number;
} {
  let laborables = 0;
  let festivas = 0;
  let nocturnas = 0;
  for (const g of guardias) {
    const h = horasGuardiaMaria(g.dow, g.es_festivo);
    laborables += h.laborables;
    festivas += h.festivas;
    nocturnas += h.nocturnas;
  }
  return { laborables, festivas, nocturnas };
}

/**
 * Días laborables efectivamente trabajados = días L-V del mes - vacaciones L-V
 * - festivos L-V. Este es el "días_mes" que cita §5.4 y §5.5 de nominas-rrhh.md.
 */
function diasLaborablesTrabajados(ctx: ContextoMes): number {
  return Math.max(
    0,
    ctx.dias_laborables_calendario -
      ctx.dias_laborables_festivos -
      ctx.dias_vacaciones_empleado_labs
  );
}

// ─── §5.1 Auxiliares rotativos (Dulce, Ani, Leti, Yoli) ────────────────────
// Yoli es variante con complemento 0€ pero el resto de fórmula es igual.
// (Si algún rotativo tuviera guardias nocturnas se trataría aparte — hoy no.)
function calcAuxiliarRotativo(
  emp: EmpleadoNomina,
  ctx: ContextoMes
): ResultadoNomina {
  const r = resultadoBase(emp);
  const fijas = emp.h_lab_complemento_mensual;      // típicamente 9 h
  const extrasMes = emp.h_extras_fijas_mes;         // típicamente 4 h
  r.laborables = fijas + extrasMes;
  r.complementos_eur = emp.complemento_mensual_eur;
  r.desglose = {
    fijas_mes: fijas,
    extras_fijas_mes: extrasMes,
    horas_guardia_laboral: 0,
    horas_guardia_festiva: 0,
  };
  r.warnings.push(
    "Las horas de guardia diurna de auxiliares están absorbidas en h_extras_fijas_mes según §5.1. " +
      "Verificar si hay guardias extraordinarias que haya que sumar manualmente."
  );
  return r;
}

// ─── §5.1 Auxiliar fijo partido (Noelia) ────────────────────────────────────
// Mismo cálculo que rotativo — el "fijo partido" solo afecta a su horario
// semanal, no a la nómina.
function calcAuxiliarFijoPartido(
  emp: EmpleadoNomina,
  ctx: ContextoMes
): ResultadoNomina {
  return calcAuxiliarRotativo(emp, ctx);
}

// ─── §5.3 Farmacéuticos diurnos (Julio, Celia) ─────────────────────────────
// Las 19 h fijas cubren toda su contribución de guardia. 0 festivos, 0 nocturnas.
function calcFarmaceuticoDiurno(
  emp: EmpleadoNomina,
  _ctx: ContextoMes
): ResultadoNomina {
  const r = resultadoBase(emp);
  r.laborables = emp.h_lab_complemento_mensual; // 19
  r.complementos_eur = emp.complemento_mensual_eur; // 280
  r.desglose = { fijas_mes: emp.h_lab_complemento_mensual };
  return r;
}

// ─── §5.4 Farmacéutica nocturna (María) ────────────────────────────────────
// Cálculo con descuento de ½h por día de guardia + guardias nocturnas por §6.
function calcFarmaceuticoNocturno(
  emp: EmpleadoNomina,
  ctx: ContextoMes
): ResultadoNomina {
  const r = resultadoBase(emp);

  const diasTrabajados = diasLaborablesTrabajados(ctx);
  const fijas = emp.h_lab_complemento_mensual; // 9 h base (según §5.4 "9 días laborables")
  const extrasDiariasMes = diasTrabajados * emp.h_extra_diaria; // 0.5/día
  const diasGuardia = ctx.guardias_empleado.length;
  // REGLA §5.4: el descuento de ½h sólo aplica a guardias de L-J (dow 1-4).
  // Razón: María entra al día siguiente y la compensación es por "pisar"
  // las dos jornadas. En V/S/D/festivo no trabaja al día siguiente → no hay
  // descuento. Confirmado por Beatriz 2026-04-06.
  const diasGuardiaLJ = ctx.guardias_empleado.filter(
    (g) => g.dow >= 1 && g.dow <= 4 && !g.es_festivo
  ).length;
  const descuentoGuardia = emp.descuenta_media_en_guardia ? diasGuardiaLJ * 0.5 : 0;

  const { laborables: guardiaLab, festivas: guardiaFest, nocturnas: guardiaNoct } =
    horasGuardiasNocturnas(ctx.guardias_empleado);

  const laborablesBase =
    fijas + extrasDiariasMes - descuentoGuardia;

  r.laborables = laborablesBase + guardiaLab;
  r.festivos = guardiaFest;
  r.nocturnas = guardiaNoct;
  r.complementos_eur = emp.complemento_mensual_eur; // 180 €
  r.desglose = {
    fijas_mes: fijas,
    extras_diarias_mes: extrasDiariasMes,
    dias_guardia_total: diasGuardia,
    dias_guardia_lj_con_descuento: diasGuardiaLJ,
    descuento_guardia_maria: descuentoGuardia,
    horas_guardia_laboral: guardiaLab,
    horas_guardia_festiva: guardiaFest,
    horas_guardia_nocturnas: guardiaNoct,
    dias_laborables_trabajados: diasTrabajados,
  };
  return r;
}

// ─── §5.6 Apoyo estudiante óptica (Zule / Zuleica) ─────────────────────────
// Contrato media jornada: 16 h/sem L-J + 4 h base V + 4 h extras V.
// Usamos viernes efectivamente trabajados (viernes del mes - viernes vacaciones).
// NOTA: §5.6 marca como pendiente crítico cómo declarar las 16h/sem a gestoría.
// Hasta resolverlo, el motor calcula horas EFECTIVAS del mes (opción 2 de las
// tres enumeradas en el doc) y emite warning.
function calcApoyoEstudianteOptica(
  emp: EmpleadoNomina,
  ctx: ContextoMes
): ResultadoNomina {
  const r = resultadoBase(emp);

  // Horas L-J base: 16 h por semana, prorrateado por semanas efectivas del mes
  // (aproximación: días L-J no festivos - días L-J vacaciones) * 4 h/día.
  // Simplificación razonable: contamos L-J efectivos.
  // TODO: mover a un helper dentro del contexto para que sea una constante
  // precomputada y el motor no tenga que saber de calendario.
  //
  // Para un primer cálculo, asumimos 16h × 4 semanas = 64 h base (fijas mes).
  // Cuando se resuelva el pendiente crítico se cambiará a la fórmula exacta.
  const fijasBase = 64;

  const viernesTrabajados = ctx.viernes_mes - ctx.viernes_vacaciones_empleado;
  const viernesBase = viernesTrabajados * 4;    // 4 h base por viernes
  const viernesExtras = viernesTrabajados * 4;  // 4 h extras por viernes

  r.laborables = fijasBase + viernesBase + viernesExtras;
  r.complementos_eur = 0;
  r.desglose = {
    fijas_mes: fijasBase,
    viernes_trabajados: viernesTrabajados,
    extras_fijas_semana: viernesExtras,
  };
  r.warnings.push(
    "Cálculo Zule usa 64 h L-J base fijas (16h × 4 sem). Pendiente crítico §5.6: confirmar " +
      "con Ovidio cómo declara la gestoría las 16h/sem base. Ajustar fijasBase cuando se resuelva."
  );
  return r;
}

// ─── §5.5 Mirelus mantenimiento (Javier) ───────────────────────────────────
// 9 h fijas + 4 h extras fijas + 0.5 × días trabajados L-V. Sin descuento de guardia
// (Javi no hace guardias nocturnas).
function calcMirelusMantenimiento(
  emp: EmpleadoNomina,
  ctx: ContextoMes
): ResultadoNomina {
  const r = resultadoBase(emp);
  const diasTrabajados = diasLaborablesTrabajados(ctx);
  const fijas = emp.h_lab_complemento_mensual; // 9
  const extrasMes = emp.h_extras_fijas_mes;    // 4
  const extrasDiarias = diasTrabajados * emp.h_extra_diaria; // 0.5/día

  r.laborables = fijas + extrasMes + extrasDiarias;
  r.complementos_eur = emp.complemento_mensual_eur; // 60
  r.desglose = {
    fijas_mes: fijas,
    extras_fijas_mes: extrasMes,
    extras_diarias_mes: extrasDiarias,
    dias_laborables_trabajados: diasTrabajados,
  };
  return r;
}

// ─── §5.7 Mirelus limpieza fija (Tere) ─────────────────────────────────────
// h_lab_complemento_mensual = 8 (overload semántico: son "horas fijas al mes",
// NO "horas asociadas a complemento"). Ver §3 nota overload.
function calcMirelusLimpiezaFija(
  emp: EmpleadoNomina,
  _ctx: ContextoMes
): ResultadoNomina {
  const r = resultadoBase(emp);
  r.laborables = emp.h_lab_complemento_mensual; // 8
  r.complementos_eur = 0;
  r.desglose = { fijas_mes: emp.h_lab_complemento_mensual };
  return r;
}

// ─── §5.7 Mirelus suplente (Dolores) ───────────────────────────────────────
// Solo cuando sustituye a Tere en vacaciones. Hasta que el motor cruce con las
// vacaciones de Tere, se devuelve 0 + warning. Ver TODO.
function calcMirelusSuplente(
  emp: EmpleadoNomina,
  _ctx: ContextoMes
): ResultadoNomina {
  const r = resultadoBase(emp);
  r.laborables = 0;
  r.complementos_eur = 0;
  r.warnings.push(
    "Dolores: devuelve 0 h por defecto. TODO: cruzar con vacaciones de Tere y sumar las 8h de los meses en que la suple. §5.7."
  );
  return r;
}

// ─── §5.7/§5.8 Fijas gestoría (Luisa, Miriam, Mónica) ──────────────────────
// Valores hardcodeados en constantes.ts. El motor no calcula nada — solo propaga.
function calcFijaGestoria(
  emp: EmpleadoNomina,
  _ctx: ContextoMes
): ResultadoNomina {
  const r = resultadoBase(emp);
  const v = VALORES_FIJOS_GESTORIA[emp.id];
  if (!v) {
    r.warnings.push(
      `Empleado ${emp.id}: marcado como fija gestoría pero no hay entrada en VALORES_FIJOS_GESTORIA. Devuelvo ceros.`
    );
    return r;
  }
  r.laborables = v.laborables;
  r.festivos = v.festivos;
  r.nocturnas = v.nocturnas;
  r.complementos_eur = v.complementos_eur;
  r.desglose = { valor_fijo_gestoria: true };
  if (v.placeholder) {
    r.warnings.push(
      `${emp.id}: valores fijos de gestoría son PLACEHOLDER. Pedir a Ovidio los reales y actualizar VALORES_FIJOS_GESTORIA en src/lib/nomina/constantes.ts.`
    );
  }
  return r;
}

// ─── Fallback para tipo_calculo = null ─────────────────────────────────────
function calcSinTipo(
  emp: EmpleadoNomina,
  _ctx: ContextoMes
): ResultadoNomina {
  const r = resultadoBase(emp);
  r.warnings.push(
    `Empleado ${emp.id} con tipo_calculo=null no debería estar en la nómina (incluir_en_nomina=1). ` +
      "Revisar la ficha en /rrhh/equipo."
  );
  return r;
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

type Calculador = (emp: EmpleadoNomina, ctx: ContextoMes) => ResultadoNomina;

const DISPATCH: Record<TipoCalculoNomina, Calculador> = {
  auxiliar_rotativo:       calcAuxiliarRotativo,
  auxiliar_fijo_partido:   calcAuxiliarFijoPartido,
  farmaceutico_diurno:     calcFarmaceuticoDiurno,
  farmaceutico_nocturno:   calcFarmaceuticoNocturno,
  apoyo_estudiante_optica: calcApoyoEstudianteOptica,
  mirelus_mantenimiento:   calcMirelusMantenimiento,
  mirelus_limpieza_fija:   calcMirelusLimpiezaFija,
  mirelus_suplente:        calcMirelusSuplente,
  mirelus_fija_gestoria:   calcFijaGestoria,
  reig_fija_gestoria:      calcFijaGestoria,
};

/** Entry point público: calcula la nómina de un empleado en un mes dado. */
export function calcularNominaEmpleado(
  emp: EmpleadoNomina,
  ctx: ContextoMes
): ResultadoNomina {
  if (!emp.tipo_calculo) return calcSinTipo(emp, ctx);
  const fn = DISPATCH[emp.tipo_calculo];
  if (!fn) {
    const r = resultadoBase(emp);
    r.warnings.push(`Tipo de cálculo desconocido: ${emp.tipo_calculo}`);
    return r;
  }
  const res = fn(emp, ctx);
  // Propagar warnings del contexto (ej: vacaciones sin empleado conocido)
  if (ctx.warnings.length) res.warnings.push(...ctx.warnings);
  return res;
}
