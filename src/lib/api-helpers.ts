import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Filters } from "./queries";
import type { UserSession } from "./auth";

/**
 * Verifica autenticación en API routes.
 * Devuelve el usuario o un error 401.
 */
export async function requireAuth(): Promise<{
  error: NextResponse | null;
  user: UserSession | null;
}> {
  const session = await auth();
  if (!session?.user?.email) {
    return {
      error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
      user: null,
    };
  }

  const user: UserSession = {
    email: session.user.email,
    nombre: (session.user as Record<string, unknown>).nombre as string || session.user.name || "",
    role: ((session.user as Record<string, unknown>).role as string || "usuario") as "admin" | "usuario",
    departamento: ((session.user as Record<string, unknown>).departamento as string || "farmacia") as "farmacia" | "optica" | "ambos",
    activo: (session.user as Record<string, unknown>).activo as number ?? 1,
    image: session.user.image,
  };

  return { error: null, user };
}

export function parseFilters(params: URLSearchParams): Filters {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    desde: params.get("desde") || firstOfMonth.toISOString().slice(0, 10),
    hasta: params.get("hasta") || now.toISOString().slice(0, 10),
    vendedor: params.get("vendedor") || undefined,
    tipoVenta: (params.get("tipoVenta") as Filters["tipoVenta"]) || undefined,
    tipoPago: params.get("tipoPago") || undefined,
    diaSemana: params.has("diaSemana")
      ? Number(params.get("diaSemana"))
      : undefined,
    franjaHoraria:
      (params.get("franjaHoraria") as Filters["franjaHoraria"]) || undefined,
  };
}
