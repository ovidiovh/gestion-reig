import { requireUser } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos";
import RRHHClient from "./RRHHClient";

/**
 * Server Component wrapper para RRHH.
 * Verifica permisos granulares y pasa flags al componente cliente:
 *   - Calendario: siempre visible (el layout ya comprobó rrhh_calendario)
 *   - Guardias:   solo si tiene rrhh_guardias
 *   - Vacaciones: solo si tiene rrhh_vacaciones
 */
export default async function RRHHPage() {
  const user = await requireUser();
  const [guardias, vacaciones] = await Promise.all([
    tienePermiso("rrhh_guardias", user.email, user.role),
    tienePermiso("rrhh_vacaciones", user.email, user.role),
  ]);

  return (
    <RRHHClient
      puedeVerGuardias={guardias}
      puedeVerVacaciones={vacaciones}
    />
  );
}
