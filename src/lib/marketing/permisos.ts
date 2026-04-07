/**
 * Whitelist de acceso al módulo Marketing → Clientes.
 *
 * Por decisión de Ovidio (2026-04-07), el dashboard epidemiológico solo es
 * visible para Ovidio y Beatriz. El resto del equipo no debe verlo, ni
 * siquiera la entrada en el Sidebar.
 *
 * Doble check:
 *   1. middleware.ts → bloquea la ruta a nivel edge.
 *   2. layout del segmento (src/app/(app)/marketing/clientes/layout.tsx)
 *      → re-chequea en Server Component por si el middleware se cae.
 *   3. Sidebar.tsx → oculta el item del menú si el email no está aquí.
 */
export const MARKETING_CLIENTES_WHITELIST: ReadonlyArray<string> = [
  "ovidio@farmaciareig.net",
  "brs@farmaciareig.net",
];

export function puedeVerMarketingClientes(email: string | null | undefined): boolean {
  if (!email) return false;
  return MARKETING_CLIENTES_WHITELIST.includes(email.toLowerCase());
}
