/**
 * Layout del segmento Marketing → Clientes.
 *
 * Doble check de acceso (defensa en profundidad):
 * el middleware ya bloquea esta ruta a nivel edge para emails no autorizados,
 * pero esto re-verifica desde el Server Component por si en algún despliegue
 * futuro el middleware se reconfigura por error.
 *
 * Whitelist controlada en src/lib/marketing/permisos.ts.
 */
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { puedeVerMarketingClientes } from "@/lib/marketing/permisos";

export default async function MarketingClientesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!puedeVerMarketingClientes(user.email)) {
    redirect("/?error=sin-permisos-marketing");
  }
  return <>{children}</>;
}
