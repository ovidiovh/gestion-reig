export interface Empleado {
  id: string;
  nombre: string;
  categoria: string;
  empresa: "reig" | "mirelus";
  farmaceutico: number;
  hace_guardia: number;
  complemento_eur: number;
  h_lab_complemento: number;
  activo: number;
  orden: number;
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
  tipo: "vac" | "comp";
  nombre: string;
  farmaceutico: number;
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

// Empleados que rotan (no Zuleica, no farmacéuticos, no externos)
export const EMPLEADOS_ROTATIVOS = ["ani", "yoli", "leti", "dulce"];
export const EMPLEADOS_ESPECIALES = ["zuleica"];

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

export const MESES      = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
export const DIAS_SEMANA = ["L","M","X","J","V","S","D"];

export const GREEN       = "#1a8c3a";
export const GREEN_DARK  = "#14702e";
export const GREEN_LIGHT = "#e8f5ec";

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
