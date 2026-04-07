// Motor de nómina — calculadores por tipo_calculo.
//
// Cada función recibe (empleado, contextoMes) y devuelve ResultadoNomina.
// Son funciones puras: todo lo que necesitan viene en los argumentos.
//
// Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §5 para las fórmulas.

import type { TipoCalculoNomina } from "@/app/(app)/rrhh/types";
import type { EmpleadoNomina, ContextoMes, ResultadoNomina, GuardiaAsignada, GuardiaDesglose } from "./tipos";
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
    nocturnas_laborables: 0,
    nocturnas_festivas: 0,
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
  nocturnas_laborables: number;
  nocturnas_festivas: number;
} {
  let laborables = 0;
  let festivas = 0;
  let nocturnas_laborables = 0;
  let nocturnas_festivas = 0;
  for (const g of guardias) {
    const h = horasGuardiaMaria(g.dow, g.es_festivo);
    laborables += h.laborables;
    festivas += h.festivas;
    nocturnas_laborables += h.nocturnas_laborables;
    nocturnas_festivas += h.nocturnas_festivas;
  }
  return { laborables, festivas, nocturnas_laborables, nocturnas_festivas };
}

/**
 * Horas reales de UNA guardia (suma de los dos posibles slots).
 * Las horas se almacenan como ENTEROS = horas del día (ver migrate/route.ts:
 * ani 9→14 = 5h, maría 21→33 = 12h), NO en media-horas. La duración es
 * simplemente (fin - inicio).
 */
function horasGuardiaSlots(g: GuardiaAsignada): number {
  let h = 0;
  if (g.hora_inicio != null && g.hora_fin != null) {
    h += g.hora_fin - g.hora_inicio;
  }
  if (g.hora_inicio2 != null && g.hora_fin2 != null) {
    h += g.hora_fin2 - g.hora_inicio2;
  }
  return h;
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
  const extrasMes = emp.h_extras_fijas_mes;         // típicamente 4 h (estimación de guardias)
  r.laborables = fijas + extrasMes;
  r.complementos_eur = emp.complemento_mensual_eur;

  // Solo las guardias de FIN DE SEMANA o FESTIVO añaden horas reales por
  // encima del turno habitual de la auxiliar. En L-V no festivo, "estar de
  // guardia" significa simplemente que ese día le toca su turno normal — no
  // genera ninguna hora extra. Los únicos con horario alterado en L-V son
  // María (mañana + 21:00) y Javi (20:00-23:00), y ninguno es auxiliar.
  // Confirmado por Ovidio 2026-04-07 (sesión nóminas).
  const guardiasExtra = ctx.guardias_empleado.filter(
    (g) => g.es_festivo || g.dow === 0 || g.dow === 6
  );

  // Visibilidad de guardias reales asignadas en el mes (no afecta al cálculo,
  // solo deja a Beatriz comparar el estimado h_extras_fijas_mes contra lo real).
  // §5.1 absorbe las guardias diurnas en una constante mensual; este desglose
  // permite detectar meses con muchas más guardias de lo habitual.
  const numGuardias = guardiasExtra.length;
  const horasGuardiasReales = guardiasExtra.reduce(
    (sum, g) => sum + horasGuardiaSlots(g),
    0
  );

  const guardiasDetalle: GuardiaDesglose[] = guardiasExtra.map((g) => ({
    fecha: g.fecha,
    dow: g.dow,
    horas: horasGuardiaSlots(g),
    es_festivo: g.es_festivo,
  }));

  r.desglose = {
    fijas_mes: fijas,
    extras_fijas_mes: extrasMes,
    num_guardias_asignadas: numGuardias,
    horas_guardias_reales: horasGuardiasReales,
    guardias_detalle: guardiasDetalle,
  };

  // Warning solo si hay desviación significativa (> 2 h respecto al estimado).
  if (numGuardias > 0 && Math.abs(horasGuardiasReales - extrasMes) > 2) {
    r.warnings.push(
      `Guardias reales este mes: ${numGuardias} (${horasGuardiasReales} h) ` +
        `vs estimación fija ${extrasMes} h. Considera ajustar manualmente si procede.`
    );
  }
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
// Base: 19 h fijas mensuales (h_lab_complemento_mensual) + complemento €.
// ENCIMA de eso, solo las guardias de FIN DE SEMANA o FESTIVO añaden horas
// reales por encima del horario habitual. Las guardias L-V no festivas son
// turno normal: Julio y Celia hacen el mismo horario que cualquier día —
// "estar de guardia" en L-V no significa horas extra, igual que para las
// auxiliares. Los únicos con horario alterado en L-V son María (mañana +
// 21:00) y Javi (20:00-23:00). Confirmado por Ovidio 2026-04-07 (sesión
// nóminas) — corrige el comportamiento del commit 90ee585 que sumaba todas.
// Sin nocturnas (eso es solo María) y sin descuento de ½h (eso aplica solo
// a `descuenta_media_en_guardia=1`).
function calcFarmaceuticoDiurno(
  emp: EmpleadoNomina,
  ctx: ContextoMes
): ResultadoNomina {
  const r = resultadoBase(emp);
  const fijas = emp.h_lab_complemento_mensual; // 19

  const guardiasExtra = ctx.guardias_empleado.filter(
    (g) => g.es_festivo || g.dow === 0 || g.dow === 6
  );

  let horasGuardiaLab = 0;
  let horasGuardiaFest = 0;
  for (const g of guardiasExtra) {
    const h = horasGuardiaSlots(g);
    if (g.es_festivo) horasGuardiaFest += h;
    else horasGuardiaLab += h;
  }

  r.laborables = fijas + horasGuardiaLab;
  r.festivos = horasGuardiaFest;
  r.complementos_eur = emp.complemento_mensual_eur; // 280

  const guardiasDetalle: GuardiaDesglose[] = guardiasExtra.map((g) => ({
    fecha: g.fecha,
    dow: g.dow,
    horas: horasGuardiaSlots(g),
    es_festivo: g.es_festivo,
  }));

  r.desglose = {
    fijas_mes: fijas,
    num_guardias_asignadas: guardiasExtra.length,
    horas_guardia_laboral: horasGuardiaLab,
    horas_guardia_festiva: horasGuardiaFest,
    guardias_detalle: guardiasDetalle,
  };
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

  const {
    laborables: guardiaLab,
    festivas: guardiaFest,
    nocturnas_laborables: guardiaNoctLab,
    nocturnas_festivas: guardiaNoctFest,
  } = horasGuardiasNocturnas(ctx.guardias_empleado);

  const laborablesBase =
    fijas + extrasDiariasMes - descuentoGuardia;

  r.laborables = laborablesBase + guardiaLab;
  r.festivos = guardiaFest;
  r.nocturnas_laborables = guardiaNoctLab;
  r.nocturnas_festivas = guardiaNoctFest;
  r.complementos_eur = emp.complemento_mensual_eur; // 180 €
  // Detalle día a día — usado por la pantalla para mostrar "sáb 4 (12) + jue 23 (9)…"
  const guardiasDetalle: GuardiaDesglose[] = ctx.guardias_empleado.map((g) => {
    const h = horasGuardiaMaria(g.dow, g.es_festivo);
    return {
      fecha: g.fecha,
      dow: g.dow,
      horas: h.totales,
      es_festivo: g.es_festivo,
    };
  });

  r.desglose = {
    fijas_mes: fijas,
    extras_diarias_mes: extrasDiariasMes,
    dias_guardia_total: diasGuardia,
    dias_guardia_lj_con_descuento: diasGuardiaLJ,
    descuento_guardia_maria: descuentoGuardia,
    horas_guardia_laboral: guardiaLab,
    horas_guardia_festiva: guardiaFest,
    horas_guardia_nocturnas_lab: guardiaNoctLab,
    horas_guardia_nocturnas_fest: guardiaNoctFest,
    dias_laborables_trabajados: diasTrabajados,
    guardias_detalle: guardiasDetalle,
  };
  return r;
}

// ─── §5.6 Apoyo estudiante óptica (Zule / Zuleica) ─────────────────────────
// Contrato fijo de media jornada L-V: la base mensual la conoce la gestoría
// desde el contrato y NO se reporta en la hoja de horas mensual. Lo único
// VARIABLE mes a mes son las 4 h extras del viernes, y solo cuando Zule
// efectivamente cubre ese viernes (no festivo, no vacaciones).
//
// Confirmado por Ovidio 2026-04-07 (sesión 6, durante el diseño del PDF):
//   "Zule tiene un contrato fijo a media jornada de lunes a viernes, y los
//    viernes tiene 4 horas extras. Solo hay que poner las 4 horas extras del
//    viernes cuando lo trabaja."
//
// Esto sustituye la fórmula `dias_LV_trabajados × 4 + viernes × 4` del commit
// 42109f1 (que sí enviaba las horas base a la gestoría — error). Mismo patrón
// que Luisa/Miriam/Mónica (contrato fijo conocido por la gestoría), con la
// diferencia de que Zule sí tiene un componente variable.
function calcApoyoEstudianteOptica(
  emp: EmpleadoNomina,
  ctx: ContextoMes
): ResultadoNomina {
  const r = resultadoBase(emp);

  // Solo los viernes que realmente trabaja: 4 h extras cada uno.
  const viernesEfectivos = Math.max(
    0,
    ctx.viernes_mes - ctx.viernes_vacaciones_empleado - ctx.viernes_festivos_mes
  );
  const horasExtrasViernes = viernesEfectivos * 4;

  r.laborables = horasExtrasViernes;
  r.complementos_eur = 0;
  r.desglose = {
    viernes_trabajados: viernesEfectivos,
    extras_fijas_semana: horasExtrasViernes,
  };
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
// 8 horas extras fijas al mes → h_extras_fijas_mes = 8. Sin complemento.
function calcMirelusLimpiezaFija(
  emp: EmpleadoNomina,
  _ctx: ContextoMes
): ResultadoNomina {
  const r = resultadoBase(emp);
  r.laborables = emp.h_extras_fijas_mes; // 8
  r.complementos_eur = 0;
  r.desglose = { extras_fijas_mes: emp.h_extras_fijas_mes };
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
  r.nocturnas_laborables = v.nocturnas_laborables;
  r.nocturnas_festivas = v.nocturnas_festivas;
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
