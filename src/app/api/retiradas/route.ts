import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET — listar sesiones de retirada (o detalle de una sesión con ?sesion_id=X)
export async function GET(req: NextRequest) {
  try {
    const sesionId = req.nextUrl.searchParams.get("sesion_id");

    // ── Detalle de una sesión concreta ──
    if (sesionId) {
      const [cajasRes, auditRes] = await Promise.all([
        db.execute({
          sql: "SELECT * FROM retiradas_caja WHERE sesion_id = ? ORDER BY num_caja",
          args: [sesionId],
        }),
        db.execute({
          sql: "SELECT * FROM retiradas_audit WHERE sesion_id = ?",
          args: [sesionId],
        }),
      ]);
      return NextResponse.json({
        ok: true,
        cajas: cajasRes.rows,
        audit: auditRes.rows[0] || null,
      });
    }

    // ── Listado general ──
    const desde = req.nextUrl.searchParams.get("desde") || "2000-01-01";
    const result = await db.execute({
      sql: `SELECT s.*,
              (SELECT COUNT(*) FROM retiradas_caja c WHERE c.sesion_id = s.id) as num_cajas,
              r.estado as remesa_estado,
              r.confirmada_at as remesa_confirmada_at
       FROM retiradas_sesion s
       LEFT JOIN retiradas_remesa r ON s.remesa_id = r.id
       WHERE s.fecha >= ?
       ORDER BY s.fecha DESC, s.created_at DESC
       LIMIT 200`,
      args: [desde],
    });

    // ── Balance caja fuerte (todas las sesiones en caja_fuerte sin remesa) ──
    const balanceRes = await db.execute({
      sql: `SELECT
              COALESCE(SUM(CASE WHEN origen = 'farmacia' OR origen IS NULL THEN total_cajas ELSE 0 END), 0) as balance_farmacia,
              COALESCE(SUM(CASE WHEN origen = 'optica' THEN total_cajas ELSE 0 END), 0) as balance_optica,
              COALESCE(SUM(total_cajas), 0) as balance_total
            FROM retiradas_sesion
            WHERE destino = 'caja_fuerte' AND remesa_id IS NULL`,
      args: [],
    });

    return NextResponse.json({
      ok: true,
      data: result.rows,
      caja_fuerte: balanceRes.rows[0] || { balance_farmacia: 0, balance_optica: 0, balance_total: 0 },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// POST — crear nueva sesión de retirada
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fecha, destino, origen, cajas, audit } = body as {
      fecha: string;
      destino?: string;
      origen?: string;
      cajas: Array<{
        num_caja: number;
        b200: number; b100: number; b50: number;
        b20: number; b10: number; b5: number;
      }>;
      audit?: {
        b200: number; b100: number; b50: number;
        b20: number; b10: number; b5: number;
      };
    };

    if (!fecha || !cajas || cajas.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Faltan fecha y/o cajas" },
        { status: 400 }
      );
    }

    // No permitir crear retiradas con fecha pasada
    const hoy = new Date().toISOString().slice(0, 10);
    if (fecha !== hoy) {
      return NextResponse.json(
        { ok: false, error: "Solo se pueden crear retiradas con fecha de hoy" },
        { status: 400 }
      );
    }

    // Calcular totales por caja
    const cajasConTotal = cajas.map((c) => ({
      ...c,
      total: c.b200 * 200 + c.b100 * 100 + c.b50 * 50 + c.b20 * 20 + c.b10 * 10 + c.b5 * 5,
    }));

    const totalCajas = cajasConTotal.reduce((sum, c) => sum + c.total, 0);

    // Crear sesión
    const origenVal = origen === "optica" ? "optica" : "farmacia";
    const sesionResult = await db.execute({
      sql: `INSERT INTO retiradas_sesion (fecha, destino, total_cajas, origen) VALUES (?, ?, ?, ?)`,
      args: [fecha, destino || "caja_fuerte", totalCajas, origenVal],
    });

    const sesionId = Number(sesionResult.lastInsertRowid);

    // Insertar cada caja
    for (const c of cajasConTotal) {
      await db.execute({
        sql: `INSERT INTO retiradas_caja (sesion_id, num_caja, b200, b100, b50, b20, b10, b5, total)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [sesionId, c.num_caja, c.b200, c.b100, c.b50, c.b20, c.b10, c.b5, c.total],
      });
    }

    // Si viene auditoría, insertarla y comparar
    let auditada = 0;
    if (audit) {
      const totalAudit =
        audit.b200 * 200 + audit.b100 * 100 + audit.b50 * 50 +
        audit.b20 * 20 + audit.b10 * 10 + audit.b5 * 5;

      // Comparar billetes individuales
      const sumB200 = cajasConTotal.reduce((s, c) => s + c.b200, 0);
      const sumB100 = cajasConTotal.reduce((s, c) => s + c.b100, 0);
      const sumB50 = cajasConTotal.reduce((s, c) => s + c.b50, 0);
      const sumB20 = cajasConTotal.reduce((s, c) => s + c.b20, 0);
      const sumB10 = cajasConTotal.reduce((s, c) => s + c.b10, 0);
      const sumB5 = cajasConTotal.reduce((s, c) => s + c.b5, 0);

      const cuadra =
        audit.b200 === sumB200 && audit.b100 === sumB100 &&
        audit.b50 === sumB50 && audit.b20 === sumB20 &&
        audit.b10 === sumB10 && audit.b5 === sumB5 ? 1 : 0;

      await db.execute({
        sql: `INSERT INTO retiradas_audit (sesion_id, b200, b100, b50, b20, b10, b5, total, cuadra)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [sesionId, audit.b200, audit.b100, audit.b50, audit.b20, audit.b10, audit.b5, totalAudit, cuadra],
      });

      auditada = cuadra ? 1 : -1;
      await db.execute({
        sql: `UPDATE retiradas_sesion SET total_audit = ?, auditada = ? WHERE id = ?`,
        args: [totalAudit, auditada, sesionId],
      });
    }

    return NextResponse.json({
      ok: true,
      sesion_id: sesionId,
      total_cajas: totalCajas,
      auditada,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// PATCH — cambiar destino de una sesión (con bloqueo)
export async function PATCH(req: NextRequest) {
  try {
    const { id, destino } = (await req.json()) as {
      id: number;
      destino: string;
    };

    const validDestinos = ["caja_fuerte", "entrega_bea", "banco"];
    if (!id || !destino || !validDestinos.includes(destino)) {
      return NextResponse.json(
        { ok: false, error: "ID y destino válido requeridos (caja_fuerte, entrega_bea, banco)" },
        { status: 400 }
      );
    }

    // Verificar que la sesión existe y no está bloqueada
    const sesion = await db.execute({
      sql: "SELECT id, destino FROM retiradas_sesion WHERE id = ?",
      args: [id],
    });

    if (sesion.rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Sesión no encontrada" }, { status: 404 });
    }

    const actual = sesion.rows[0].destino as string;
    // Si ya está en banco o entrega_bea → bloqueado, no se puede cambiar
    if (actual === "banco" || actual === "entrega_bea") {
      return NextResponse.json(
        { ok: false, error: `Sesión bloqueada — destino final: ${actual}` },
        { status: 403 }
      );
    }

    await db.execute({
      sql: "UPDATE retiradas_sesion SET destino = ? WHERE id = ?",
      args: [destino, id],
    });

    return NextResponse.json({ ok: true, id, destino });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
