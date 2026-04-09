import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * Mapa ruta → módulo para clasificar page views automáticamente.
 * Las rutas se comparan con startsWith — orden importa (más específico primero).
 */
const RUTA_A_MODULO: [string, string][] = [
  ["/retiradas", "financiero"],
  ["/ingresos", "financiero"],
  ["/ventas", "financiero"],
  ["/crm", "marketing"],
  ["/marketing", "marketing"],
  ["/fichas", "marketing"],
  ["/rrhh", "rrhh"],
  ["/admin", "admin"],
];

function detectarModulo(ruta: string): string {
  for (const [prefix, modulo] of RUTA_A_MODULO) {
    if (ruta.startsWith(prefix)) return modulo;
  }
  return ruta === "/" ? "inicio" : "otro";
}

/**
 * POST /api/admin/pageview
 * Body: { ruta: string }
 *
 * Registra una visita a página. Llamado desde el hook usePageView del cliente.
 * No bloqueante — si falla, no pasa nada.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const body = await req.json();
    const ruta = typeof body?.ruta === "string" ? body.ruta : "/";
    const modulo = detectarModulo(ruta);

    await db.execute({
      sql: `INSERT INTO page_views (usuario_email, usuario_nombre, ruta, modulo, timestamp)
            VALUES (?, ?, ?, ?, datetime('now'))`,
      args: [user.email, user.nombre || "", ruta, modulo],
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // No romper la experiencia del usuario si el tracking falla
    console.error("[pageview]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * GET /api/admin/pageview?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&email=x
 *
 * Devuelve page views con filtros opcionales. Solo admin.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const desde = params.get("desde");
    const hasta = params.get("hasta");
    const email = params.get("email");
    const limit = Math.min(Number(params.get("limit")) || 500, 5000);

    let sql = `SELECT id, usuario_email, usuario_nombre, ruta, modulo, timestamp
               FROM page_views WHERE 1=1`;
    const args: (string | number)[] = [];

    if (desde) {
      sql += ` AND timestamp >= ?`;
      args.push(desde);
    }
    if (hasta) {
      sql += ` AND timestamp <= ?`;
      args.push(hasta + " 23:59:59");
    }
    if (email) {
      sql += ` AND usuario_email = ?`;
      args.push(email.toLowerCase());
    }

    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    args.push(limit);

    const result = await db.execute({ sql, args });

    return NextResponse.json({ ok: true, total: result.rows.length, rows: result.rows });
  } catch (err) {
    console.error("[pageview GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
