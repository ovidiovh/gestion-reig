// Enum de tipos de cálculo para el módulo de nóminas.
// Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §5.
export type TipoCalculoNomina =
  | "auxiliar_rotativo"        // §5.1 — Ani, Dulce, Leti, Yoli
  | "auxiliar_fijo_partido"    // §5.1 — Noelia
  | "farmaceutico_diurno"      // §5.3 — Julio, Celia
  | "farmaceutico_nocturno"    // §5.4 — María
  | "apoyo_estudiante_optica"  // §5.6 — Zule/Zuleica
  | "mirelus_mantenimiento"    // §5.5 — Javier
  | "mirelus_limpieza_fija"    // §5.7 — Tere
  | "mirelus_suplente"         // §5.7 — Dolores
  | "mirelus_fija_gestoria";   // §5.7 — Luisa

export interface Empleado {
  id: string;
  nombre: string;
  categoria: string;
  empresa: "reig" | "mirelus";
  farmaceutico: number;
  hace_guardia: number;
  cubre_nocturna: number;
  // Complemento salarial MENSUAL fijo en €. NO depende de cuántas guardias se hagan.
  // Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §4.
  complemento_mensual_eur: number;
  // Horas laborables/mes asociadas al complemento mensual (Julio/Celia=19, aux=9, María=0).
  h_lab_complemento_mensual: number;
  activo: number;
  orden: number;
  departamento: string;
  // Horario fijo en media-horas desde medianoche (null = usar HORARIO_DEFAULT)
  horario_inicio_a: number | null;
  horario_fin_a: number | null;
  horario_inicio_b: number | null;
  horario_fin_b: number | null;

  // ── Campos del módulo de nóminas (sesión 5, 2026-04-06) ──
  // Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §3–§5 y §9.
  //
  // Nombre con el que la gestoría registra a la persona. Ej: Yoli ↔ "REYES Gregoria".
  // null para empleados que no van a nómina (Ovidio, Bea, Davinia, etc.).
  nombre_formal_nomina: string | null;
  // Enum que dice qué función del engine de nóminas usar. null = no aplica.
  tipo_calculo: TipoCalculoNomina | null;
  // Horas extras fijas al mes (auxiliares farmacia: 4; Javier: 4; el resto: 0).
  h_extras_fijas_mes: number;
  // Horas extras fijas por semana cuando trabaja (Zule: 4 los viernes que cubre; el resto: 0).
  h_extras_fijas_semana: number;
  // Horas extras por día laborable trabajado (María: 0.5; Javier: 0.5; el resto: 0).
  h_extra_diaria: number;
  // Flag: los días de guardia no se paga la h_extra_diaria (solo María — ver §5.4 y §7).
  descuenta_media_en_guardia: number;
  // Flag: aparece en el PDF mensual de la gestoría. Distinto de `activo` (planning).
  incluir_en_nomina: number;
  // Flag: aparece en el módulo de vacaciones. Necesario porque Tere/Dolores no están en
  // el planning pero sí deben poder tener vacaciones registradas.
  incluir_vacaciones: number;
}

export interface Festivo {
  id: number;
  fecha: string;
  nombre: string;
  tipo: string;
  override: number;
}

export interface Guardia {
  id: number;
  fecha: string;
  tipo: "lab" | "fest";
  publicada: number;
  notas: string | null;
}

export interface GuardiaSlot {
  id: number;
  guardia_id: number;
  empleado_id: string;
  hora_inicio: number;
  hora_fin: number;
  hora_inicio2: number | null;
  hora_fin2: number | null;
  nombre: string;
  farmaceutico: number;
  empresa: string;
}

export interface Vacacion {
  id: number;
  empleado_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: "pend" | "conf" | "done";
  tipo: "vac" | "comp" | "ap";
  nombre: string;
  farmaceutico: number;
}

export interface TurnoConfig {
  turno: number;   // 0=Esp, 1=T1, 2=T2, 3=T3
  ia: number;      // inicio_a (media-horas)
  fa: number;      // fin_a
  ib: number | null;
  fb: number | null;
}

export interface BancoHoras {
  id: number;
  empleado_id: string;
  fecha: string;
  concepto: "deuda" | "recupera";
  minutos: number;
  notas: string | null;
  created_at: string;
}

export interface GuardiaStats {
  empleado_id: string;
  nombre: string;
  guardias_hechas: number;       // calculado: slots en fechas pasadas
  guardias_manual: number | null; // override manual (null = usar calculado)
}

export interface HorarioAsignacion {
  id: number;
  week_start: string;
  empleado_id: string;
  turno: number; // 0=especial/Zuleica, 1=T1, 2=T2, 3=T3
  notas: string | null;
  nombre?: string;
}

// ── Horarios rotativos ────────────────────────────────────────────────────────

// Semana ancla: lunes 23 marzo 2026 → Ani=T1, Yoli=T2, Leti=T2, Dulce=T3
export const ANCHOR_WEEK = "2026-03-23";

export const ANCHOR_TURNOS: Record<string, number> = {
  ani: 1, yoli: 2, leti: 2, dulce: 3,
};

export const TURNO_LABELS: Record<number, string> = {
  0: "Especial · 4h + V+4h",
  1: "T1 · 8:30–16:30",
  2: "T2 · 9–13 / 16–20",
  3: "T3 · 12:30–20:30",
};

export const TURNO_SHORT: Record<number, string> = {
  0: "Esp.", 1: "T1", 2: "T2", 3: "T3",
};

export const TURNO_COLORS: Record<number, { bg: string; color: string }> = {
  0: { bg: "#f3e8ff", color: "#7c3aed" },
  1: { bg: "#dbeafe", color: "#1d4ed8" },
  2: { bg: "#dcfce7", color: "#166534" },
  3: { bg: "#fef9c3", color: "#854d0e" },
};

// Empleados que rotan (solo Ani, Yoli, Leti, Dulce)
export const EMPLEADOS_ROTATIVOS = ["ani", "yoli", "leti", "dulce"];
// Zuleica: horario FIJO L-J 16:30-20:30, NO rotativo
export const EMPLEADOS_ESPECIALES: string[] = [];

/** Devuelve el lunes de la semana que contiene la fecha d */
export function getWeekStart(d: Date): string {
  const copy = new Date(d);
  const dow  = copy.getDay();
  const diff = (dow + 6) % 7; // lunes = 0
  copy.setDate(copy.getDate() - diff);
  return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, "0")}-${String(copy.getDate()).padStart(2, "0")}`;
}

/** Calcula el turno esperado para un empleado en una semana (por rotación, sin overrides de BD) */
export function getTurnoForWeek(empId: string, weekStart: string): number {
  if (empId === "zuleica") return 0;
  if (!(empId in ANCHOR_TURNOS)) return -1; // no rotativo
  const anchor     = new Date(ANCHOR_WEEK + "T00:00:00");
  const week       = new Date(weekStart + "T00:00:00");
  const weeksDiff  = Math.round((week.getTime() - anchor.getTime()) / (7 * 86400000));
  const anchorTurno = ANCHOR_TURNOS[empId];
  // ((anchorTurno-1 + weeksDiff) mod 3 + 3) mod 3 + 1  ← positivo siempre
  return (((anchorTurno - 1 + weeksDiff) % 3) + 3) % 3 + 1;
}

// ── Guardias precalculadas (cliente) ─────────────────────────────────────────
// Primera guardia 4 de abril 2026, cada 19 días
export function calcGuardDates(): Set<string> {
  const set = new Set<string>();

  const localStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const addDays = (d: Date, n: number): Date => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  };

  const anchor  = new Date(2026, 3, 4); // 4 abril 2026 (hora local)
  const inicio  = new Date(2026, 0, 1);
  const fin     = new Date(2026, 11, 31);

  // Hacia atrás (incluyendo el ancla)
  let d = new Date(anchor);
  while (d >= inicio) {
    set.add(localStr(d));
    d = addDays(d, -19);
  }

  // Hacia adelante
  d = addDays(anchor, 19);
  while (d <= fin) {
    set.add(localStr(d));
    d = addDays(d, 19);
  }

  return set;
}

// ── Horario visual por turno (media-horas desde medianoche) ─────────────────
// [inicio_a, fin_a, inicio_b | null, fin_b | null]
export const TURNO_HORARIO: Record<number, [number, number, number | null, number | null]> = {
  0: [17, 25, null, null],  // Esp (Zuleica): 8:30–12:30
  1: [17, 33, null, null],  // T1:  8:30–16:30
  2: [18, 26, 32, 40],      // T2:  9–13 / 16–20
  3: [25, 41, null, null],  // T3: 12:30–20:30
};

// Horario por defecto para empleados no rotativos (media-horas desde medianoche)
// Valores confirmados por la dirección. Se pueden sobreescribir por empleado en BD.
export const HORARIO_DEFAULT: Record<string, [number, number, number | null, number | null]> = {
  ovidio:  [23, 41, null, null],   // 11:30–20:30
  bea:     [14, 31, null, null],   // 7:00–15:30
  maria:   [25, 41, null, null],   // 12:30–20:30
  julio:   [18, 28, 34, 40],       // 9:00–14:00 / 17:00–20:00
  celia:   [18, 34, null, null],   // 9:00–17:00
  noelia:  [18, 26, 30, 37],       // 9:00–13:00 / 15:00–18:30
  miriam:  [18, 34, null, null],   // 9:00–17:00
  monica:  [18, 34, null, null],   // 9:00–17:00
  javier:  [18, 34, null, null],   // 9:00–17:00 (días sin guardia)
  zuleica: [33, 41, null, null],   // 16:30–20:30 (L-J fijo)
  davinia: [18, 28, null, null],   // 9:00–14:00 (en prácticas)
  teresa:  [17, 24, null, null],   // 8:30–12:00
  luisa:   [17, 24, null, null],
  jenny:   [18, 34, null, null],
};

/** Convierte media-hora (ej. 17=8:30, 26=13:00) a etiqueta "H:MM" */
export function hhToLabel(hh: number): string {
  const h = Math.floor(hh / 2);
  const m = hh % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
}

// Grid visual: 8:30 (17hh) a 20:30 (41hh) = 24 franjas de 30 min
export const GRID_START_HH = 17;  // 8:30
export const GRID_END_HH   = 41;  // 20:30
export const GRID_COLS     = GRID_END_HH - GRID_START_HH; // 24

export const MESES      = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
export const DIAS_SEMANA = ["L","M","X","J","V","S","D"];

export const GREEN       = "#2E7D32";
export const GREEN_DARK  = "#1B5E20";
export const GREEN_LIGHT = "#E8F5E9";

export function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000) + 1;
}

// Devuelve fecha local YYYY-MM-DD (sin conversión UTC que desplaza 1 día en España)
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
