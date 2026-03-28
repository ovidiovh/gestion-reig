export interface Empleado {
  id: string;
  nombre: string;
  categoria: string;
  empresa: "reig" | "mirelus";
  farmaceutico: number;
  hace_guardia: number;
  complemento_eur: number;
  h_lab_complemento: number;
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
  nombre: string;
  farmaceutico: number;
}

// Guardias precalculadas cada 19 días desde 4 abril 2026
export function calcGuardDates(): Set<string> {
  const set = new Set<string>();
  const anchor = new Date(2026, 3, 4); // 4 abril 2026

  // Hacia atrás
  let d = new Date(anchor);
  while (d >= new Date(2026, 0, 1)) {
    set.add(d.toISOString().split("T")[0]);
    d = new Date(d.getTime() - 19 * 86400000);
  }

  // Hacia adelante
  d = new Date(anchor.getTime() + 19 * 86400000);
  while (d <= new Date(2026, 11, 31)) {
    set.add(d.toISOString().split("T")[0]);
    d = new Date(d.getTime() + 19 * 86400000);
  }

  return set;
}

export const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
export const DIAS_SEMANA = ["L","M","X","J","V","S","D"];

export const GREEN = "#1a8c3a";
export const GREEN_DARK = "#14702e";
export const GREEN_LIGHT = "#e8f5ec";

export function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000) + 1;
}

export function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}
