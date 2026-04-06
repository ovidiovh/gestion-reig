// Motor de nómina — constantes hardcodeadas
// Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §6.

/**
 * Horas que genera una guardia nocturna de María según el tipo de día
 * en que cae la guardia. NO es el reloj real: la categoría (laborable/
 * festiva) se decide por el tipo de DÍA completo, no por las horas en sí.
 *
 * - laborables: horas que van a la columna 'laborables' del PDF
 * - festivas:   horas que van a la columna 'festivos' del PDF
 * - nocturnas:  subsección dentro de laborables/festivas (no aditivas)
 */
export interface HorasGuardia {
  totales: number;
  laborables: number;
  festivas: number;
  /**
   * Nocturnas en día laborable. SUBSECCIÓN de `laborables` (no aditiva).
   * Se paga distinto que nocturnas festivas → va en columna separada.
   */
  nocturnas_laborables: number;
  /**
   * Nocturnas en día festivo/domingo. SUBSECCIÓN de `festivas` (no aditiva).
   * Se paga distinto que nocturnas laborables.
   */
  nocturnas_festivas: number;
}

/**
 * Tabla §6 de nominas-rrhh.md. dow = new Date(fecha).getDay() (0=dom…6=sáb).
 * Confirmada por Beatriz 2026-04-06:
 *
 *          | L-M-X-J | VIERNES | SÁBADO | DOMINGO/FESTIVO |
 * LAB      |    9    |   11    |   12   |        0        |
 * NOCT LAB |    8    |    8    |    8   |        0        |
 * FEST     |    0    |    0    |    0   |       12        |
 * NOCT FEST|    0    |    0    |    0   |        8        |
 *
 * Regla: las nocturnas SON una subsección de la franja correspondiente
 * (laborable o festiva), NO se suman por separado.
 */
export function horasGuardiaMaria(dow: number, esFestivo: boolean): HorasGuardia {
  // Festivo o domingo → 12 festivas de las cuales 8 son nocturnas festivas
  if (esFestivo || dow === 0) {
    return { totales: 12, laborables: 0, festivas: 12, nocturnas_laborables: 0, nocturnas_festivas: 8 };
  }
  // Sábado
  if (dow === 6) {
    return { totales: 12, laborables: 12, festivas: 0, nocturnas_laborables: 8, nocturnas_festivas: 0 };
  }
  // Viernes
  if (dow === 5) {
    return { totales: 11, laborables: 11, festivas: 0, nocturnas_laborables: 8, nocturnas_festivas: 0 };
  }
  // L-M-X-J
  return { totales: 9, laborables: 9, festivas: 0, nocturnas_laborables: 8, nocturnas_festivas: 0 };
}

// ─── Valores fijos de gestoría (placeholders) ──────────────────────────────
//
// Miriam, Mónica y Luisa tienen nómina fija ya cerrada con la gestoría. El
// motor debe devolverlas como registro impreso pero NO calcular nada. Estos
// valores son placeholders hasta que Ovidio facilite los reales. Ver §5.7 y
// §5.8 de nominas-rrhh.md — marcado como pendiente crítico.
//
// Cuando lleguen los datos reales, cambiar aquí y el motor los propagará al
// PDF sin más cambios en código.

export interface ValoresFijosGestoria {
  laborables: number;
  festivos: number;
  nocturnas_laborables: number;
  nocturnas_festivas: number;
  complementos_eur: number;
  /** Si es true, el motor emite un warning al usar este valor. */
  placeholder: boolean;
}

export const VALORES_FIJOS_GESTORIA: Record<string, ValoresFijosGestoria> = {
  // Luisa Schmidt — nómina Mirelus fija. TODO: pedir a Ovidio los valores reales.
  luisa: {
    laborables: 0,
    festivos: 0,
    nocturnas_laborables: 0,
    nocturnas_festivas: 0,
    complementos_eur: 0,
    placeholder: true,
  },
  // Miriam — óptica Reig fija. TODO: pedir a Ovidio los valores reales.
  miriam: {
    laborables: 0,
    festivos: 0,
    nocturnas_laborables: 0,
    nocturnas_festivas: 0,
    complementos_eur: 0,
    placeholder: true,
  },
  // Mónica — ortopedia Reig fija. TODO: pedir a Ovidio los valores reales.
  monica: {
    laborables: 0,
    festivos: 0,
    nocturnas_laborables: 0,
    nocturnas_festivas: 0,
    complementos_eur: 0,
    placeholder: true,
  },
};
