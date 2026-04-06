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

interface FilaVacacion {
  empleado_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  tipo: string;
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
  vacacionesPorEmpleado: Map<string, FilaVacacion[]>;
  guardiasPorEmpleado: Map<string, FilaGuardiaSlot[]>;
}

/**
 * Una sola lectura global del mes. Se ejecuta una vez por request y se
 * reutiliza para todos los empleados.
 */
export async function cargarDatosMes(mes: string): Promise<DatosMesGlobales> {
  const { inicio, fin } = rangoMes(mes);

  const [festivos, vacaciones, guardiaSlots] = await Promise.all([
    query<FilaFestivo>(
      `SELECT fecha, nombre, tipo, override FROM rrhh_festivos
       WHERE fecha BETWEEN ? AND ?`,
      [inicio, fin]
    ),
    query<FilaVacacion>(
      `SELECT empleado_id, fecha_inicio, fecha_fin,
              COALESCE(estado, 'aprobada') as estado,
              COALESCE(tipo, 'vac') as tipo
       FROM rrhh_vacaciones
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
  const vacacionesPorEmpleado = new Map<string, FilaVacacion[]>();
  for (const v of vacaciones) {
    const arr = vacacionesPorEmpleado.get(v.empleado_id) ?? [];
    arr.push(v);
    vacacionesPorEmpleado.set(v.empleado_id, arr);
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
    vacacionesPorEmpleado,
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
    viernes_vacaciones_empleado: 0,
    guardias_empleado: [],
    warnings: [],
  };

  // Vacaciones L-V del empleado dentro del mes (incluyendo viernes)
  const vacs = datos.vacacionesPorEmpleado.get(emp.id) ?? [];
  const { inicio: mesIni, fin: mesFin } = rangoMes(datos.mes);
  let diasVacLV = 0;
  let viernesVac = 0;
  for (const v of vacs) {
    if (!rangosSolapan(v.fecha_inicio, v.fecha_fin, mesIni, mesFin)) continue;
    // Interseccionar con el mes
    const ini = v.fecha_inicio > mesIni ? v.fecha_inicio : mesIni;
    const fin = v.fecha_fin < mesFin ? v.fecha_fin : mesFin;
    // Recorrer día a día (rangos cortos — meses, no años)
    for (let f = ini; f <= fin; f = siguienteDia(f)) {
      if (esDiaLV(f)) {
        diasVacLV++;
        if (dowUTC(f) === 5) viernesVac++;
      }
    }
  }
  ctx.dias_vacaciones_empleado_labs = diasVacLV;
  ctx.viernes_vacaciones_empleado = viernesVac;

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
