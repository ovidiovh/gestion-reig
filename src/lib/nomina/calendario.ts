// Helpers de calendario para el motor de nómina.
// Todo en UTC para evitar sorpresas con DST.

/** Número de días del mes "YYYY-MM". */
export function diasDelMes(mes: string): number {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Primer y último día del mes en formato "YYYY-MM-DD". */
export function rangoMes(mes: string): { inicio: string; fin: string } {
  const dias = diasDelMes(mes);
  return {
    inicio: `${mes}-01`,
    fin: `${mes}-${String(dias).padStart(2, "0")}`,
  };
}

/** Day-of-week UTC (0=dom, 1=lun, …, 6=sáb). */
export function dowUTC(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Itera todas las fechas "YYYY-MM-DD" del mes. */
export function fechasDelMes(mes: string): string[] {
  const dias = diasDelMes(mes);
  const out: string[] = [];
  for (let d = 1; d <= dias; d++) {
    out.push(`${mes}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

/** ¿Es un día laborable L-V? (ignora festivos, solo mira el dow). */
export function esDiaLV(fecha: string): boolean {
  const d = dowUTC(fecha);
  return d >= 1 && d <= 5;
}

/** Cuenta cuántos días L-V tiene el mes. */
export function contarDiasLV(mes: string): number {
  return fechasDelMes(mes).filter(esDiaLV).length;
}

/** Cuenta cuántos viernes tiene el mes. */
export function contarViernes(mes: string): number {
  return fechasDelMes(mes).filter((f) => dowUTC(f) === 5).length;
}

/** ¿Está la fecha dentro del rango [inicio, fin] inclusive? */
export function fechaEnRango(fecha: string, inicio: string, fin: string): boolean {
  return fecha >= inicio && fecha <= fin;
}

/** ¿Dos rangos se solapan? */
export function rangosSolapan(
  aIni: string, aFin: string,
  bIni: string, bFin: string
): boolean {
  return aIni <= bFin && bIni <= aFin;
}
