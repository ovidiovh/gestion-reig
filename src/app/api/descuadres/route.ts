/**
 * API Descuadres de Caja
 *
 * GET  /api/descuadres?vista=dia&fecha=YYYY-MM-DD
 * GET  /api/descuadres?vista=rango&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 * GET  /api/descuadres?vista=agregado&tipo=dia|semana|mes|caja|dia_semana|semana_mes&desde=...&hasta=...
 * GET  /api/descuadres?vista=stats&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 * POST /api/descuadres  { action: "ingestar" }  → parsea emails de Gmail y graba
 * POST /api/descuadres  { action: "reset" }      → borra todos los datos (para arranque limpio)
 * PATCH /api/descuadres { id, caja }             → corregir caja de un cierre
 * DELETE /api/descuadres { id }                   → eliminar un cierre
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";
import { insertAuditLog } from "@/lib/audit";
import {
  actualizarCaja,
  eliminarCierre,
  cierresDelDia,
  cierresPorRango,
  agregadoPorDia,
  agregadoPorSemana,
  agregadoPorMes,
  agregadoPorCaja,
  agregadoPorDiaSemana,
  agregadoPorSemanaDelMes,
  estadisticasPeriodo,
  guardarCierresBatch,
  resetDescuadres,
  parsearEmailCierre,
  existeEmailId,
  CAJAS_ORDEN,
  type CierreInput,
} from "@/lib/descuadres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ────────── GET ────────── */

export async function GET(req: NextRequest) {
  const check = await requirePermiso("financiero_descuadres");
  if ("error" in check) return check.error;

  try {
    const sp = req.nextUrl.searchParams;
    const vista = sp.get("vista") || "dia";
    const fecha = sp.get("fecha") || new Date().toISOString().slice(0, 10);
    const desde = sp.get("desde") || fecha;
    const hasta = sp.get("hasta") || fecha;

    switch (vista) {
      case "dia": {
        const cierres = await cierresDelDia(fecha);
        return NextResponse.json({ ok: true, fecha, cierres });
      }

      case "rango": {
        const cierres = await cierresPorRango(desde, hasta);
        return NextResponse.json({ ok: true, desde, hasta, cierres });
      }

      case "agregado": {
        const tipo = sp.get("tipo") || "dia";
        let data;
        switch (tipo) {
          case "dia":         data = await agregadoPorDia(desde, hasta); break;
          case "semana":      data = await agregadoPorSemana(desde, hasta); break;
          case "mes":         data = await agregadoPorMes(desde, hasta); break;
          case "caja":        data = await agregadoPorCaja(desde, hasta); break;
          case "dia_semana":  data = await agregadoPorDiaSemana(desde, hasta); break;
          case "semana_mes":  data = await agregadoPorSemanaDelMes(desde, hasta); break;
          default:            data = await agregadoPorDia(desde, hasta);
        }
        return NextResponse.json({ ok: true, tipo, desde, hasta, data });
      }

      case "stats": {
        const stats = await estadisticasPeriodo(desde, hasta);
        return NextResponse.json({ ok: true, desde, hasta, stats });
      }

      default:
        return NextResponse.json({ error: `Vista desconocida: ${vista}` }, { status: 400 });
    }
  } catch (e) {
    console.error("[api/descuadres] GET:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/* ────────── POST ────────── */

export async function POST(req: NextRequest) {
  const check = await requirePermiso("financiero_descuadres");
  if ("error" in check) return check.error;
  const { user } = check;

  try {
    const body = await req.json();
    const action = body.action;

    if (action === "reset") {
      await resetDescuadres();

      await insertAuditLog({
        usuario_email: user.email,
        usuario_nombre: user.nombre,
        accion: "eliminar",
        modulo: "descuadres", // casting temporal hasta ampliar AuditModulo
        detalle: "Reset completo de descuadres_cierre (arranque limpio)",
      });

      return NextResponse.json({ ok: true, mensaje: "Tabla descuadres_cierre vaciada" });
    }

    if (action === "ingestar") {
      // body.emails = array de { messageId, body, date } ya extraídos del cliente
      const emails: { messageId: string; body: string; date: string }[] = body.emails || [];

      if (emails.length === 0) {
        return NextResponse.json({ ok: true, insertados: 0, duplicados: 0, mensaje: "Sin emails nuevos" });
      }

      // Agrupar por fecha de cierre y asignar caja por orden
      const parseados: (CierreInput & { _orden: number })[] = [];

      for (const email of emails) {
        // Comprobar duplicado
        if (email.messageId && await existeEmailId(email.messageId)) continue;

        const datos = parsearEmailCierre(email.body);
        if (!datos) {
          console.warn(`[descuadres] No se pudo parsear email ${email.messageId}`);
          continue;
        }

        parseados.push({
          fecha_cierre: datos.fecha,
          hora_cierre: datos.hora,
          caja: -1, // se asigna después por orden
          saldo: datos.saldo,
          tarjetas_dia_anterior: datos.retirado,
          descuadre: datos.diferencias,
          importe_apertura: datos.importe_apertura,
          email_id: email.messageId,
          email_fecha_envio: email.date,
          _orden: 0,
        });
      }

      // Agrupar por fecha y asignar caja por orden de hora
      const porFecha = new Map<string, typeof parseados>();
      for (const p of parseados) {
        const arr = porFecha.get(p.fecha_cierre) || [];
        arr.push(p);
        porFecha.set(p.fecha_cierre, arr);
      }

      const cierresFinales: CierreInput[] = [];
      for (const [, grupo] of porFecha) {
        // Ordenar por hora de cierre
        grupo.sort((a, b) => a.hora_cierre.localeCompare(b.hora_cierre));
        // Asignar caja por posición
        grupo.forEach((cierre, idx) => {
          cierre.caja = idx < CAJAS_ORDEN.length ? CAJAS_ORDEN[idx] : 99;
          cierresFinales.push({
            fecha_cierre: cierre.fecha_cierre,
            hora_cierre: cierre.hora_cierre,
            caja: cierre.caja,
            saldo: cierre.saldo,
            tarjetas_dia_anterior: cierre.tarjetas_dia_anterior,
            descuadre: cierre.descuadre,
            importe_apertura: cierre.importe_apertura,
            email_id: cierre.email_id,
            email_fecha_envio: cierre.email_fecha_envio,
          });
        });
      }

      const result = await guardarCierresBatch(cierresFinales);

      await insertAuditLog({
        usuario_email: user.email,
        usuario_nombre: user.nombre,
        accion: "crear",
        modulo: "descuadres",
        detalle: `Ingesta descuadres: ${result.insertados} insertados, ${result.duplicados} duplicados, ${cierresFinales.length} procesados`,
      });

      return NextResponse.json({
        ok: true,
        ...result,
        procesados: cierresFinales.length,
      });
    }

    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (e) {
    console.error("[api/descuadres] POST:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/* ────────── PATCH — corregir caja ────────── */

export async function PATCH(req: NextRequest) {
  const check = await requirePermiso("financiero_descuadres");
  if ("error" in check) return check.error;
  const { user } = check;

  try {
    const body = await req.json();
    const { id, caja } = body;

    if (typeof id !== "number" || typeof caja !== "number") {
      return NextResponse.json({ error: "Faltan id y caja (numéricos)" }, { status: 400 });
    }

    const ok = await actualizarCaja(id, caja);
    if (!ok) {
      return NextResponse.json({ error: `Cierre id=${id} no encontrado` }, { status: 404 });
    }

    await insertAuditLog({
      usuario_email: user.email,
      usuario_nombre: user.nombre,
      accion: "modificar",
      modulo: "descuadres",
      detalle: `Corregir caja cierre id=${id} → caja ${caja}`,
    });

    return NextResponse.json({ ok: true, id, caja });
  } catch (e) {
    console.error("[api/descuadres] PATCH:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/* ────────── DELETE — eliminar cierre ────────── */

export async function DELETE(req: NextRequest) {
  const check = await requirePermiso("financiero_descuadres");
  if ("error" in check) return check.error;
  const { user } = check;

  try {
    const body = await req.json();
    const { id } = body;

    if (typeof id !== "number") {
      return NextResponse.json({ error: "Falta id (numérico)" }, { status: 400 });
    }

    const ok = await eliminarCierre(id);
    if (!ok) {
      return NextResponse.json({ error: `Cierre id=${id} no encontrado` }, { status: 404 });
    }

    await insertAuditLog({
      usuario_email: user.email,
      usuario_nombre: user.nombre,
      accion: "eliminar",
      modulo: "descuadres",
      detalle: `Eliminar cierre id=${id}`,
    });

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[api/descuadres] DELETE:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
