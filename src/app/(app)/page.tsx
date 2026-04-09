import { requireUser } from "@/lib/auth";
import { listarPermisosUsuario } from "@/lib/permisos";
import Dashboard from "./Dashboard";

export default async function HomePage() {
  const user = await requireUser();
  const email = user?.email ?? "";
  const role = user?.role ?? "usuario";
  const modulosPermitidos = await listarPermisosUsuario(email, role);

  return (
    <Dashboard
      userName={user?.nombre || user?.email || ""}
      role={role}
      modulosPermitidos={modulosPermitidos}
    />
  );
}
