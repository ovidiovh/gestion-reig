// Construye el ContextoMes de cada empleado desde Turso. Este es el único
// archivo del motor de nómina que habla con la BD.
//
// Estrategia: una única lectura de festivos/vacaciones/guardias para todo el
// mes objetivo, y luego por cada empleado se filtra en memoria. Así evitamos
// N+1 queries y hacemos el batch rápido.

import { query } from "@/lib/db";
import type { ContextoMes, GuardiaAsignada, EmpleadoNomina } from "./tipos";
import {
  contarDiasLV,
  contarViernes,
  dowUTC,
  esDiaLV,
  fechasDelMes,
  rangoMes,
  rangosSolapan,
} from "./calendario";

interface FilaAusencia {
  empleado_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  tipo: string;
  retribuida: number;
}

/**
 * Tipos de ausencia que reducen la base salarial del mes (lo que Reig paga
 * como "fijas" en el motor). El resto de tipos (matrimonio, fallecimiento,
 * hospitalización, lactancia, fuerza mayor, etc.) son permisos retribuidos:
 * el empleado cobra el mes íntegro, no se descuenta nada de Reig.
 *
 * Ver REIG-BASE → ausencias-y-permisos.md §7 y §5.1.
 */
const TIPOS_DESCUENTAN_BASE = new Set<string>([
  "vac",            // vacaciones ordinarias
  "ap",             // asuntos propios
  "comp",           // compensatorio guardia
  "permiso_parental", // art. 48 bis ET — no retribuido
]);

const TIPOS_IT = new Set<string>([
  "it_enf",
  "it_enfermedad",
  "it_enfermedad_comun",
  "it_acc",
  "it_accidente",
  "it_accidente_no_laboral",
  "it_acc_laboral",
  "it_accidente_laboral",
  "it_enfermedad_profesional",
]);

/** Umbral de IT "corta" en días naturales (decisión interna 2026-04-08). */
const UMBRAL_IT_CORTA_DIAS = 7;

function diasNaturalesRango(fi: string, ff: string): number {
  const a = new Date(fi + "T00:00:00Z").getTime();
  const b = new Date(ff + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000) + 1;
}

function fmtNotaFecha(f: string): string {
  const [, m, d] = f.split("-");
  const MESES_CORTOS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(d, 10)} ${MESES_CORTOS[parseInt(m, 10) - 1]}`;
}

function etiquetaTipo(tipo: string): string {
  if (TIPOS_IT.has(tipo)) return "IT";
  switch (tipo) {
    case "matrimonio": return "Matrimonio";
    case "fallecimiento": return "Fallecimiento";
    case "hospitalizacion": return "Hospitalización";
    case "intervencion_reposo": return "Intervención";
    case "mudanza": return "Mudanza";
    case "deber_publico": return "Deber público";
    case "lactancia": return "Lactancia";
    case "lactancia_acumulada": return "Lactancia acum.";
    case "permiso_parental": return "Permiso parental";
    case "fuerza_mayor": return "Fuerza mayor";
    case "catastrofe": return "Catástrofe";
    case "cuidado_menor_grave": return "Cuidado menor";
    case "embarazo_riesgo": return "Riesgo embarazo";
    case "examenes": return "Exámenes";
    case "medico_propio": return "Médico";
    case "medico_acompanante": return "Acompañamiento";
    default: return tipo;
  }
}

interface FilaFestivo {
  fecha: string;
  nombre: string;
  tipo: string;
  override: number;
}

interface FilaGuardiaSlot {
  fecha: string;
  empleado_id: string;
  tipo: string; // lab | fest
  hora_inicio: number | null;
  hora_fin: number | null;
  hora_inicio2: number | null;
  hora_fin2: number | null;
}

export interface DatosMesGlobales {
  mes: string;
  dias_laborables_calendario: number;
  dias_laborables_festivos: number;
  viernes_mes: number;
  viernes_festivos_mes: number;
  festivosFechas: Set<string>;
  ausenciasPorEmpleado: Map<string, FilaAusencia[]>;
  guardiasPorEmpleado: Map<string, FilaGuardiaSlot[]>;
}

/**
 * Una sola lectura global del mes. Se ejecuta una vez por request y se
 * reutiliza para todos los empleados.
 */
export async function cargarDatosMes(mes: string): Promise<DatosMesGlobales> {
  const { inicio, fin } = rangoMes(mes);

  const [festivos, ausencias, guardiaSlots] = await Promise.all([
    query<FilaFestivo>(
      `SELECT fecha, nombre, tipo, override FROM rrhh_festivos
       WHERE fecha BETWEEN ? AND ?`,
      [inicio, fin]
    ),
    // Paso 3 (sesión 10, 2026-04-08): el motor lee rrhh_ausencias en vez de
    // rrhh_vacaciones. La tabla rrhh_ausencias unifica vacaciones + IT +
    // permisos con un campo `tipo` que la lógica de `contextoPara` usa para
    // aplicar la regla de los 7 días y la separación retribuido/no
    // retribuido. La migración idempotente en /api/rrhh/migrate copia todas
    // las filas históricas de rrhh_vacaciones a rrhh_ausencias, así que el
    // cambio es transparente para los meses ya cerrados. Ver
    // REIG-BASE → ausencias-y-permisos.md §7.
    query<FilaAusencia>(
      `SELECT empleado_id, fecha_inicio, fecha_fin,
              COALESCE(estado, 'pend') as estado,
              COALESCE(tipo, 'vac') as tipo,
              COALESCE(retribuida, 1) as retribuida
       FROM rrhh_ausencias
       WHERE fecha_inicio <= ? AND fecha_fin >= ?`,
      [fin, inicio]
    ),
    query<FilaGuardiaSlot>(
      `SELECT g.fecha, s.empleado_id, g.tipo,
              s.hora_inicio, s.hora_fin, s.hora_inicio2, s.hora_fin2
       FROM rrhh_guardia_slots s
       JOIN rrhh_guardias g ON g.id = s.guardia_id
       WHERE g.fecha BETWEEN ? AND ?`,
      [inicio, fin]
    ),
  ]);

  const festivosFechas = new Set<string>(festivos.map((f) => f.fecha));

  // Recuento global del mes
  const diasLabCalendario = contarDiasLV(mes);
  const diasLabFestivos = fechasDelMes(mes).filter(
    (f) => esDiaLV(f) && festivosFechas.has(f)
  ).length;
  const viernesMes = contarViernes(mes);
  const viernesFestivosMes = fechasDelMes(mes).filter(
    (f) => dowUTC(f) === 5 && festivosFechas.has(f)
  ).length;

  // Indexar por empleado
  const ausenciasPorEmpleado = new Map<string, FilaAusencia[]>();
  for (const a of ausencias) {
    const arr = ausenciasPorEmpleado.get(a.empleado_id) ?? [];
    arr.push(a);
    ausenciasPorEmpleado.set(a.empleado_id, arr);
  }

  const guardiasPorEmpleado = new Map<string, FilaGuardiaSlot[]>();
  for (const g of guardiaSlots) {
    const arr = guardiasPorEmpleado.get(g.empleado_id) ?? [];
    arr.push(g);
    guardiasPorEmpleado.set(g.empleado_id, arr);
  }

  return {
    mes,
    dias_laborables_calendario: diasLabCalendario,
    dias_laborables_festivos: diasLabFestivos,
    viernes_mes: viernesMes,
    viernes_festivos_mes: viernesFestivosMes,
    festivosFechas,
    ausenciasPorEmpleado,
    guardiasPorEmpleado,
  };
}

/** A partir de los datos globales del mes, calcula el ContextoMes para UN empleado. */
export function contextoPara(
  emp: EmpleadoNomina,
  datos: DatosMesGlobales
): ContextoMes {
  const ctx: ContextoMes = {
    mes: datos.mes,
    dias_laborables_calendario: datos.dias_laborables_calendario,
    dias_laborables_festivos: datos.dias_laborables_festivos,
    viernes_mes: datos.viernes_mes,
    viernes_festivos_mes: datos.viernes_festivos_mes,
    dias_vacaciones_empleado_labs: 0,
    fechas_descontables: new Set<string>(),
    viernes_vacaciones_empleado: 0,
    notas_ausencias: [],
    guardias_empleado: [],
    warnings: [],
  };

  // Ausencias L-V del empleado dentro del mes. Aquí se aplica la lógica de
  // clasificación por tipo que define si la ausencia reduce la base salarial
  // de Reig o solo se anota en la 5ª columna del PDF para que la gestoría
  // la tramite (pero Reig paga el mes íntegro).
  const auss = datos.ausenciasPorEmpleado.get(emp.id) ?? [];
  const { inicio: mesIni, fin: mesFin } = rangoMes(datos.mes);
  let diasDescuentoLV = 0;
  let viernesDescuento = 0;

  for (const a of auss) {
    if (!rangosSolapan(a.fecha_inicio, a.fecha_fin, mesIni, mesFin)) continue;

    // Clasificación:
    //   - vac / ap / comp / permiso_parental → descuentan siempre.
    //   - it_*                → descuentan SOLO si la ausencia dura ≥ 7 días
    //                           naturales (umbral decisión 2026-04-08).
    //                           Las IT cortas se anotan en la columna Notas
    //                           del PDF pero NO tocan la base salarial.
    //   - resto (permisos retribuidos: matrimonio, fallecimiento,
    //     hospitalización, lactancia, fuerza mayor, catástrofe, cuidado
    //     menor grave, embarazo_riesgo, exámenes, médico propio/
    //     acompañante, mudanza, deber público, etc.) → NO descuentan,
    //     solo se anotan en la columna Notas.
    const esIT = TIPOS_IT.has(a.tipo);
    const duracionNatural = diasNaturalesRango(a.fecha_inicio, a.fecha_fin);
    const itLarga = esIT && duracionNatural >= UMBRAL_IT_CORTA_DIAS;
    const descuenta = TIPOS_DESCUENTAN_BASE.has(a.tipo) || itLarga;

    // Siempre anotamos en notas_ausencias el tipo (salvo vac/ap/comp que
    // ya se traducen en huecos visuales en el PDF y no requieren texto).
    if (a.tipo !== "vac" && a.tipo !== "ap" && a.tipo !== "comp") {
      const ini = a.fecha_inicio > mesIni ? a.fecha_inicio : mesIni;
      const fin = a.fecha_fin < mesFin ? a.fecha_fin : mesFin;
      ctx.notas_ausencias.push(
        `${etiquetaTipo(a.tipo)} ${fmtNotaFecha(ini)}-${fmtNotaFecha(fin)}`
      );
    }

    if (!descuenta) continue;

    // Interseccionar con el mes y contar días L-V descontables + registrar
    // TODAS las fechas naturales descontables (incluidos sábados/domingos/
    // festivos) en fechas_descontables, para que los calculadores puedan
    // descartar guardias de fin de semana que el empleado no llegó a cubrir.
    const ini = a.fecha_inicio > mesIni ? a.fecha_inicio : mesIni;
    const fin = a.fecha_fin < mesFin ? a.fecha_fin : mesFin;
    for (let f = ini; f <= fin; f = siguienteDia(f)) {
      ctx.fechas_descontables.add(f);
      if (esDiaLV(f)) {
        diasDescuentoLV++;
        if (dowUTC(f) === 5) viernesDescuento++;
      }
    }
  }
  ctx.dias_vacaciones_empleado_labs = diasDescuentoLV;
  ctx.viernes_vacaciones_empleado = viernesDescuento;

  // Guardias del empleado
  const gSlots = datos.guardiasPorEmpleado.get(emp.id) ?? [];
  const guardias: GuardiaAsignada[] = gSlots.map((g) => ({
    fecha: g.fecha,
    dow: dowUTC(g.fecha),
    es_festivo: datos.festivosFechas.has(g.fecha) || g.tipo === "fest",
    hora_inicio: g.hora_inicio,
    hora_fin: g.hora_fin,
    hora_inicio2: g.hora_inicio2,
    hora_fin2: g.hora_fin2,
  }));
  ctx.guardias_empleado = guardias;

  return ctx;
}

function siguienteDia(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
