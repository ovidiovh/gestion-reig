import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

/**
 * Singleton de conexión a Turso.
 * Lee las credenciales de las variables de entorno de Vercel.
 */
export function getTurso(): Client {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error(
      "Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN en variables de entorno"
    );
  }

  client = createClient({ url, authToken });
  return client;
}

/**
 * Helper para ejecutar una query y devolver filas tipadas.
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  args: (string | number | null)[] = []
): Promise<T[]> {
  const db = getTurso();
  const result = await db.execute({ sql, args });
  return result.rows as unknown as T[];
}

/**
 * Helper para ejecutar un batch de statements (migraciones, etc.)
 */
export async function batch(
  statements: { sql: string; args?: (string | number | null)[] }[]
): Promise<void> {
  const db = getTurso();
  await db.batch(
    statements.map((s) => ({
      sql: s.sql,
      args: s.args || [],
    }))
  );
}

/**
 * Backward-compatible export for routes that do `import { db } from "@/lib/db"`.
 * Uses a Proxy to lazily initialize the Turso client on first property access.
 */
export const db: Client = new Proxy({} as Client, {
  get(_, prop) {
    const c = getTurso();
    const value = (c as Record<string, unknown>)[prop as string];
    return typeof value === "function" ? (value as Function).bind(c) : value;
  },
});
