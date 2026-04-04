/**
 * REIG-BASE Sync — GET
 * Endpoint público (protegido por API key) que devuelve un snapshot
 * de todos los datos maestros de RRHH para sincronizar con REIG-BASE.
 *
 * Autenticación: header "x-api-key" debe coincidir con REIG_BASE_SYNC_KEY env var.
 *
 * Devuelve: empleados activos, turnos configurados, horarios de la semana actual,
 * guardias del año, vacaciones del año y festivos.
 */
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Validar API key
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = process.env.REIG_BASE_SYNC_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const year = req.nextUrl.searchParams.get("year") || new Date().getFullYear().toString();

    // Semana actual (lunes)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;

    // Ejecutar todas las queries en paralelo
    const [empleados, turnos, horarios, guardias, vacaciones, festivos] = await Promise.all([
      // Empleados activos
      query(
        `SELECT id, nombre, categoria, empresa, farmaceutico, hace_guardia,
                horario_inicio_a, horario_fin_a, horario_inicio_b, horario_fin_b,
                departamento, orden, activo
         FROM rrhh_empleados WHERE activo = 1 ORDER BY orden ASC`
      ),

      // Configuración de turnos
      query(`SELECT * FROM rrhh_turnos_config ORDER BY turno ASC`),

      // Horarios de la semana actual (4 semanas para contexto)
      query(
        `SELECT ha.week_start, ha.empleado_id, ha.turno, ha.notas, e.nombre
         FROM rrhh_horarios_asignacion ha
         JOIN rrhh_empleados e ON e.id = ha.empleado_id
         WHERE ha.week_start >= ?
         ORDER BY ha.week_start, e.orden`,
        [weekStart]
      ),

      // Guardias del año con slots
      query(
        `SELECT g.id, g.fecha, g.tipo, g.publicada, g.notas,
                s.empleado_id, s.hora_inicio, s.hora_fin, s.hora_inicio2, s.hora_fin2,
                e.nombre as empleado_nombre, e.farmaceutico
         FROM rrhh_guardias g
         LEFT JOIN rrhh_guardia_slots s ON s.guardia_id = g.id
         LEFT JOIN rrhh_empleados e ON e.id = s.empleado_id
         WHERE g.fecha LIKE ?
         ORDER BY g.fecha ASC, e.orden ASC`,
        [`${year}%`]
      ),

      // Vacaciones del año
      query(
        `SELECT v.id, v.empleado_id, v.fecha_inicio, v.fecha_fin, v.estado,
                COALESCE(v.tipo, 'vac') as tipo, e.nombre
         FROM rrhh_vacaciones v
         JOIN rrhh_empleados e ON e.id = v.empleado_id
         WHERE v.fecha_inicio LIKE ? OR v.fecha_fin LIKE ?
         ORDER BY v.fecha_inicio ASC`,
        [`${year}%`, `${year}%`]
      ),

      // Festivos del año
      query(
        `SELECT * FROM rrhh_festivos WHERE fecha LIKE ? ORDER BY fecha ASC`,
        [`${year}%`]
      ),
    ]);

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      year,
      week_start: weekStart,
      empleados,
      turnos,
      horarios,
      guardias,
      vacaciones,
      festivos,
    });
  } catch (error) {
    console.error("[api/reig-base/sync] GET:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
