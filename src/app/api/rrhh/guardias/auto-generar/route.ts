import { query, db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/auth";

// Calcula todas las fechas de guardia del año (cada 19 días desde 4 abril 2026)
function calcGuardDates(year: number): string[] {
  const dates: string[] = [];
  const localStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  const anchor = new Date(2026, 3, 4); // 4 abril 2026
  const inicio = new Date(year, 0, 1);
  const fin    = new Date(year, 11, 31);

  let d = new Date(anchor);
  while (d >= inicio) { if (d.getFullYear() === year) dates.push(localStr(d)); d = addDays(d, -19); }
  d = addDays(anchor, 19);
  while (d <= fin)    { dates.push(localStr(d)); d = addDays(d, 19); }

  return dates.sort();
}

// POST /api/rrhh/guardias/auto-generar?year=2026
// Crea todas las guardias del año que no existan todavía (con sus slots por defecto)
export async function POST() {
  const check = await requirePermiso("rrhh_guardias");
  if ("error" in check) return check.error;

  try {
    const year = 2026;
    const guardDates = calcGuardDates(year);

    // Fechas que ya existen en BD
    const existing = await query<{ fecha: string }>(
      `SELECT fecha FROM rrhh_guardias WHERE fecha LIKE ?`,
      [`${year}%`]
    );
    const existingSet = new Set(existing.map(r => r.fecha));

    // Defaults de guardia
    const defaults = await query<{
      empleado_id: string; hora_inicio: number; hora_fin: number;
      hora_inicio2: number | null; hora_fin2: number | null;
    }>(
      `SELECT gd.empleado_id, gd.hora_inicio, gd.hora_fin, gd.hora_inicio2, gd.hora_fin2
       FROM rrhh_guardia_defaults gd
       JOIN rrhh_empleados e ON e.id = gd.empleado_id
       WHERE e.activo = 1 AND e.hace_guardia = 1`
    );

    let created = 0;
    for (const fecha of guardDates) {
      if (existingSet.has(fecha)) continue;

      // Tipo: domingo → fest, resto → lab
      const dow = new Date(fecha + "T00:00:00").getDay();
      const tipo = dow === 0 ? "fest" : "lab";

      await db.execute({
        sql: `INSERT OR IGNORE INTO rrhh_guardias (fecha, tipo) VALUES (?, ?)`,
        args: [fecha, tipo],
      });

      const rows = await query<{ id: number }>(`SELECT id FROM rrhh_guardias WHERE fecha = ?`, [fecha]);
      const guardiaId = rows[0]?.id;
      if (!guardiaId) continue;

      for (const slot of defaults) {
        await db.execute({
          sql: `INSERT OR IGNORE INTO rrhh_guardia_slots
                (guardia_id, empleado_id, hora_inicio, hora_fin, hora_inicio2, hora_fin2)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [guardiaId, slot.empleado_id, slot.hora_inicio, slot.hora_fin,
                 slot.hora_inicio2 ?? null, slot.hora_fin2 ?? null],
        });
      }
      created++;
    }

    return NextResponse.json({ ok: true, total: guardDates.length, created });
  } catch (error) {
    console.error("[guardias/auto-generar]", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
