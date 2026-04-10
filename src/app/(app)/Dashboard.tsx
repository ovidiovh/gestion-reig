"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ───── Tipos ───── */

interface DashboardProps {
  userName: string;
  role: string;
  modulosPermitidos: string[];
}

interface VentasDia {
  vendedor: string;
  facturacion: number;
  tickets: number;
  ticketMedio: number;
  unidades: number;
}

interface Descuadre {
  id: number;
  fecha_cierre: string;
  hora_cierre: string;
  caja: number;
  saldo: number;
  descuadre: number;
}

interface Guardia {
  id: number;
  fecha: string;
  tipo: string;
  es_festivo: number;
}

interface Vacacion {
  id: number;
  empleado_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  tipo: string;
  nombre: string;
}

interface Horario {
  week_start: string;
  empleado_id: number;
  turno: string;
  notas: string;
  nombre: string;
}

interface TarjetasDia {
  fecha: string;
  total: number;
  count: number;
}

interface Festivo {
  fecha: string;
  nombre: string;
}

/* ───── Constantes de rotación ───── */

const ANCHOR_WEEK = "2026-03-23";
const ANCHOR_TURNOS: Record<string, number> = { ani: 1, yoli: 2, leti: 2, dulce: 3 };
const TURNO_SHORT: Record<number, string> = { 0: "Esp", 1: "T1", 2: "T2", 3: "T3" };
const TURNO_COLORS: Record<number, { bg: string; color: string }> = {
  0: { bg: "#f3e8ff", color: "#7c3aed" },
  1: { bg: "#dbeafe", color: "#1d4ed8" },
  2: { bg: "#dcfce7", color: "#166534" },
  3: { bg: "#fef9c3", color: "#854d0e" },
};
const FIRST_GUARD = new Date("2026-04-04T12:00:00");

function getTurnoForWeek(empId: string, weekStart: string): number {
  if (empId === "zuleica") return 0;
  if (!(empId in ANCHOR_TURNOS)) return -1;
  const anchor = new Date(ANCHOR_WEEK + "T00:00:00");
  const week = new Date(weekStart + "T00:00:00");
  const weeksDiff = Math.round((week.getTime() - anchor.getTime()) / (7 * 86400000));
  const anchorTurno = ANCHOR_TURNOS[empId];
  return (((anchorTurno - 1 + weeksDiff) % 3) + 3) % 3 + 1;
}

function isGuardDate(fecha: string): boolean {
  const d = new Date(fecha + "T12:00:00");
  const diff = Math.round((d.getTime() - FIRST_GUARD.getTime()) / (86400000));
  return diff >= 0 && diff % 19 === 0;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay() || 7;
  const days: (string | null)[] = [];
  for (let i = 1; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dd = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push(dd);
  }
  return days;
}

/* ───── Helpers ───── */

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function lunesDeSemana(fecha: string) {
  const d = new Date(fecha + "T12:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const lunes = new Date(d.setDate(diff));
  return lunes.toISOString().slice(0, 10);
}

function formatEur(n: number) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatEurDecimal(n: number) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}

function formatFecha(fecha: string) {
  if (!fecha) return "—";
  const d = new Date(fecha + "T12:00:00");
  if (isNaN(d.getTime())) return "—";
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]}`;
}

function formatFechaCorta(fecha: string) {
  if (!fecha) return "—";
  const d = new Date(fecha + "T12:00:00");
  if (isNaN(d.getTime())) return "—";
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
}

function diasHasta(fecha: string) {
  const hoyMs = new Date(hoy() + "T00:00:00").getTime();
  const fechaMs = new Date(fecha + "T00:00:00").getTime();
  return Math.ceil((fechaMs - hoyMs) / (1000 * 60 * 60 * 24));
}

/* ───── Calendario mensual ───── */

function CalendarioMes({ festivos }: { festivos: Festivo[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = getMonthDays(year, month);
  const todayStr = hoy();
  const festivoSet = new Set(festivos.map((f) => f.fecha));
  const festivoNames: Record<string, string> = {};
  festivos.forEach((f) => { festivoNames[f.fecha] = f.nombre; });
  const DIAS_HDR = ["L", "M", "X", "J", "V", "S", "D"];
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div className="card">
      {/* Título */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="section-title" style={{ marginBottom: 0 }}>{meses[month]} {year}</h2>
          <p className="text-xs mt-1" style={{ color: "var(--color-reig-text-muted)" }}>
            Guardias · festivos · turnos
          </p>
        </div>
        <Link href="/rrhh" className="btn btn-secondary btn-sm">Ver completo</Link>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {[1, 2, 3].map((t) => (
          <span key={t} className="badge" style={{
            background: TURNO_COLORS[t].bg, color: TURNO_COLORS[t].color,
          }}>{TURNO_SHORT[t]}</span>
        ))}
        <span className="badge badge-green">Guardia</span>
        <span className="badge badge-red">Festivo</span>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {DIAS_HDR.map((d, i) => (
          <div key={d} style={{
            textAlign: "center", fontSize: 10, fontWeight: 700,
            color: i >= 5 ? "var(--color-reig-text-muted)" : "var(--color-reig-text-secondary)",
            paddingBottom: 6,
          }}>{d}</div>
        ))}

        {days.map((fecha, i) => {
          if (!fecha) return <div key={`e-${i}`} />;

          const dayNum = parseInt(fecha.slice(-2));
          const d = new Date(fecha + "T12:00:00");
          const dow = d.getDay();
          const isToday = fecha === todayStr;
          const isFestivo = festivoSet.has(fecha);
          const isWeekend = dow === 0 || dow === 6;
          const isGuard = isGuardDate(fecha);
          const weekMonday = lunesDeSemana(fecha);
          const turnoThisWeek = getTurnoForWeek("ani", weekMonday);

          let cellBg = "var(--color-reig-surface)";
          let numColor = "var(--color-reig-text)";
          let border = "1px solid var(--color-reig-border-light)";

          if (isToday) {
            cellBg = "var(--color-reig-green)";
            numColor = "#fff";
            border = "1px solid var(--color-reig-green)";
          } else if (isGuard) {
            cellBg = "var(--color-reig-green-light)";
            numColor = "var(--color-reig-green-dark)";
            border = "1px solid var(--color-reig-green-mid)";
          } else if (isFestivo) {
            cellBg = "var(--color-reig-danger-light)";
            numColor = "var(--color-reig-danger)";
            border = "1px solid #fecaca";
          } else if (isWeekend) {
            cellBg = "#FAFAFA";
            numColor = "var(--color-reig-text-muted)";
          }

          return (
            <div key={fecha} style={{
              textAlign: "center", padding: "6px 2px 5px",
              borderRadius: 8, background: cellBg, border,
              minHeight: 44,
            }}
              title={isFestivo ? festivoNames[fecha] : isGuard ? "Guardia" : undefined}
            >
              <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: numColor }}>
                {dayNum}
              </span>
              {!isWeekend && !isFestivo && !isToday && turnoThisWeek > 0 && (
                <div style={{ marginTop: 2 }}>
                  <span style={{
                    fontSize: 7, fontWeight: 700, padding: "1px 4px", borderRadius: 3,
                    background: TURNO_COLORS[turnoThisWeek]?.bg,
                    color: TURNO_COLORS[turnoThisWeek]?.color,
                  }}>{TURNO_SHORT[turnoThisWeek]}</span>
                </div>
              )}
              {isGuard && !isToday && (
                <div style={{ marginTop: 2 }}>
                  <span style={{
                    fontSize: 7, fontWeight: 800, color: "var(--color-reig-green-dark)",
                    background: "var(--color-reig-green-light)", padding: "1px 4px", borderRadius: 3,
                  }}>G</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───── Componente principal ───── */

export default function Dashboard({ userName, role, modulosPermitidos }: DashboardProps) {
  const [ventas, setVentas] = useState<VentasDia[] | null>(null);
  const [ventasFecha, setVentasFecha] = useState<string>("");
  const [descuadres, setDescuadres] = useState<Descuadre[] | null>(null);
  const [tarjetas, setTarjetas] = useState<TarjetasDia | null>(null);
  const [horarios, setHorarios] = useState<Horario[] | null>(null);
  const [vacaciones, setVacaciones] = useState<Vacacion[] | null>(null);
  const [guardias, setGuardias] = useState<Guardia[] | null>(null);
  const [festivos, setFestivos] = useState<Festivo[]>([]);
  const [loading, setLoading] = useState(true);

  const puede = (mod: string) => role === "admin" || modulosPermitidos.includes(mod);

  useEffect(() => {
    const today = hoy();
    const monday = lunesDeSemana(today);
    const year = today.slice(0, 4);
    const fetches: Promise<void>[] = [];

    if (puede("marketing_crm")) {
      fetches.push(
        (async () => {
          for (let i = 0; i < 7; i++) {
            const d = new Date(today + "T12:00:00");
            d.setDate(d.getDate() - i);
            const fecha = d.toISOString().slice(0, 10);
            try {
              const r = await fetch(`/api/ventas/dia?fecha=${fecha}`);
              if (r.ok) {
                const data = await r.json();
                // La API devuelve un array directo de VendedorDia[]
                const vendedores = Array.isArray(data) ? data : data.vendedores;
                if (vendedores && vendedores.length > 0) {
                  setVentas(vendedores);
                  setVentasFecha(fecha);
                  return;
                }
              }
            } catch { /* continue */ }
          }
          setVentas([]);
        })()
      );
    }
    if (puede("financiero_descuadres")) {
      fetches.push(
        fetch(`/api/descuadres?vista=dia&fecha=${today}`)
          .then((r) => r.json())
          .then((data) => setDescuadres(data.cierres || []))
          .catch(() => setDescuadres([]))
      );
    }
    if (puede("financiero_tarjetas")) {
      fetches.push(
        fetch(`/api/tarjetas?vista=dia&desde=${today}&hasta=${today}`)
          .then((r) => r.json())
          .then((data) => {
            const dias = data.data || [];
            setTarjetas(dias.length > 0 ? dias[0] : { fecha: today, total: 0, count: 0 });
          })
          .catch(() => setTarjetas({ fecha: today, total: 0, count: 0 }))
      );
    }
    if (puede("rrhh_equipo")) {
      fetches.push(
        fetch(`/api/rrhh/horarios?week=${monday}&weeks=1`)
          .then((r) => r.json())
          .then((data) => setHorarios(data.asignaciones || []))
          .catch(() => setHorarios([]))
      );
    }
    if (puede("rrhh_vacaciones")) {
      fetches.push(
        fetch(`/api/rrhh/vacaciones?year=${year}`)
          .then((r) => r.json())
          .then((data) => {
            const all = data.vacaciones || [];
            setVacaciones(all.filter(
              (v: Vacacion) => v.fecha_inicio <= today && v.fecha_fin >= today && v.estado === "aprobada"
            ));
          })
          .catch(() => setVacaciones([]))
      );
    }
    if (puede("rrhh_calendario")) {
      fetches.push(
        fetch(`/api/rrhh/guardias?year=${year}`)
          .then((r) => r.json())
          .then((data) => {
            const all: Guardia[] = data.guardias || [];
            setGuardias(
              all.filter((g) => g.fecha >= today)
                .sort((a, b) => a.fecha.localeCompare(b.fecha))
                .slice(0, 3)
            );
          })
          .catch(() => setGuardias([]))
      );
      fetches.push(
        fetch(`/api/rrhh/festivos?year=${year}`)
          .then((r) => r.json())
          .then((data) => setFestivos(data.festivos || []))
          .catch(() => setFestivos([]))
      );
    }
    Promise.allSettled(fetches).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Cálculos ── */
  const ventasTotal = ventas?.reduce((s, v) => s + v.facturacion, 0) ?? 0;
  const ticketsTotal = ventas?.reduce((s, v) => s + v.tickets, 0) ?? 0;
  const ticketMedio = ticketsTotal > 0 ? ventasTotal / ticketsTotal : 0;
  const descuadreNeto = descuadres?.reduce((s, d) => s + d.descuadre, 0) ?? 0;
  const hayAlertaDescuadre = Math.abs(descuadreNeto) > 2;
  const proximaGuardia = guardias && guardias.length > 0 ? guardias[0] : null;
  const diasParaGuardia = proximaGuardia ? diasHasta(proximaGuardia.fecha) : null;

  const hora = new Date().getHours();
  const saludo = hora < 14 ? "Buenos días" : hora < 21 ? "Buenas tardes" : "Buenas noches";
  const nombre = userName.split(" ")[0];

  const tieneVentasDetalle = ventas !== null && ventas.length > 0;
  const tieneDescuadresDetalle = descuadres !== null && descuadres.length > 0;
  const tieneCalendario = puede("rrhh_calendario");

  return (
    <div className="max-w-6xl">

      {/* ── HEADER ── */}
      <div className="mb-6">
        <h1 className="section-title" style={{ fontSize: 22, marginBottom: 2 }}>
          {saludo}, {nombre}
        </h1>
        <p className="text-sm" style={{ color: "var(--color-reig-text-muted)", textTransform: "capitalize" }}>
          {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="kpi-card" style={{ height: 100 }}>
              <div className="skeleton" style={{ width: "60%", height: 10, marginBottom: 12, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: "40%", height: 24, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">

          {/* ═══ FILA 1: KPIs ═══ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

            {/* Ventas */}
            {ventas !== null && (
              <Link href="/crm" className="kpi-card group hover:shadow-md transition-shadow block"
                style={{ textDecoration: "none", color: "inherit" }}>
                <p className="kpi-label">
                  {ventasFecha
                    ? `Ventas · ${ventasFecha === hoy() ? "hoy" : formatFechaCorta(ventasFecha)}`
                    : "Ventas"}
                </p>
                <p className="kpi-value" style={ventasFecha ? {} : { color: "var(--color-reig-text-muted)" }}>
                  {ventasFecha ? formatEur(ventasTotal) : "—"}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--color-reig-text-muted)" }}>
                  {ventasFecha
                    ? `${ticketsTotal} tickets · media ${formatEurDecimal(ticketMedio)}`
                    : "Sin datos recientes"}
                </p>
              </Link>
            )}

            {/* Descuadres */}
            {descuadres !== null && (
              <Link href="/descuadres" className="kpi-card group hover:shadow-md transition-shadow block"
                style={{
                  textDecoration: "none", color: "inherit",
                  borderLeftColor: hayAlertaDescuadre ? "var(--color-reig-warn)" : "var(--color-reig-green)",
                }}>
                <p className="kpi-label">Descuadre · hoy</p>
                <p className="kpi-value" style={hayAlertaDescuadre ? { color: "var(--color-reig-warn)" } : {}}>
                  {descuadreNeto >= 0 ? "+" : ""}{formatEurDecimal(descuadreNeto)}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--color-reig-text-muted)" }}>
                  {descuadres.length} caja{descuadres.length !== 1 ? "s" : ""} registrada{descuadres.length !== 1 ? "s" : ""}
                </p>
              </Link>
            )}

            {/* Tarjetas */}
            {tarjetas !== null && (
              <Link href="/tarjetas" className="kpi-card group hover:shadow-md transition-shadow block"
                style={{
                  textDecoration: "none", color: "inherit",
                  borderLeftColor: "var(--color-reig-optica)",
                }}>
                <p className="kpi-label">Tarjetas · hoy</p>
                <p className="kpi-value">{formatEur(tarjetas.total)}</p>
                <p className="text-xs mt-1" style={{ color: "var(--color-reig-text-muted)" }}>
                  {tarjetas.count || 0} operaciones
                </p>
              </Link>
            )}

            {/* Guardia */}
            {proximaGuardia && (
              <Link href="/rrhh" className="kpi-card group hover:shadow-md transition-shadow block"
                style={{
                  textDecoration: "none", color: "inherit",
                  borderLeftColor: diasParaGuardia !== null && diasParaGuardia <= 2
                    ? "var(--color-reig-danger)" : "var(--color-reig-green)",
                }}>
                <p className="kpi-label">Próxima guardia</p>
                <p className="kpi-value" style={{
                  fontSize: 17,
                  color: diasParaGuardia !== null && diasParaGuardia <= 2
                    ? "var(--color-reig-danger)" : "var(--color-reig-text)",
                }}>
                  {formatFecha(proximaGuardia.fecha)}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--color-reig-text-muted)" }}>
                  {diasParaGuardia === 0 ? "Hoy" : diasParaGuardia === 1 ? "Mañana" : `En ${diasParaGuardia} días`}
                  {" · "}{proximaGuardia.es_festivo ? "Festivo" : proximaGuardia.tipo === "fest" ? "Fin de semana" : "Laborable"}
                </p>
              </Link>
            )}
          </div>

          {/* ═══ FILA 2: Contenido principal — 2 columnas ═══ */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

            {/* ── COLUMNA IZQ (3/5): Ventas detalle + Calendario ── */}
            <div className="xl:col-span-3 space-y-4">

              {/* Ventas por vendedor */}
              {tieneVentasDetalle && (
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-bold" style={{ color: "var(--color-reig-text)" }}>
                        Ventas por vendedor
                      </h2>
                      <p className="text-xs" style={{ color: "var(--color-reig-text-muted)" }}>
                        {!ventasFecha ? "Sin datos" : ventasFecha === hoy() ? "Hoy" : formatFecha(ventasFecha)}
                      </p>
                    </div>
                    <Link href="/crm" className="btn btn-secondary btn-sm">Ver CRM</Link>
                  </div>
                  {/* Tabla estilo Reig */}
                  <table className="table-reig">
                    <thead>
                      <tr>
                        <th>Vendedor</th>
                        <th style={{ textAlign: "right" }}>Tickets</th>
                        <th style={{ textAlign: "right" }}>Facturación</th>
                        <th style={{ textAlign: "right" }}>% Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventas!.sort((a, b) => b.facturacion - a.facturacion).map((v) => {
                        const pct = ventasTotal > 0 ? (v.facturacion / ventasTotal) * 100 : 0;
                        return (
                          <tr key={v.vendedor}>
                            <td className="font-semibold">{v.vendedor}</td>
                            <td style={{ textAlign: "right" }}>{v.tickets}</td>
                            <td style={{ textAlign: "right" }} className="font-mono-metric font-semibold">
                              {formatEur(v.facturacion)}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <span className="badge badge-green">{pct.toFixed(1)}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Descuadres detalle */}
              {tieneDescuadresDetalle && (
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-bold" style={{ color: "var(--color-reig-text)" }}>
                        Descuadres por caja
                      </h2>
                      <p className="text-xs" style={{ color: "var(--color-reig-text-muted)" }}>
                        Cierre de hoy
                      </p>
                    </div>
                    <Link href="/descuadres" className="btn btn-secondary btn-sm">Ver todo</Link>
                  </div>
                  <table className="table-reig">
                    <thead>
                      <tr>
                        <th>Caja</th>
                        <th style={{ textAlign: "right" }}>Hora</th>
                        <th style={{ textAlign: "right" }}>Saldo</th>
                        <th style={{ textAlign: "right" }}>Descuadre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {descuadres!.sort((a, b) => a.caja - b.caja).map((d) => {
                        const esGordo = Math.abs(d.descuadre) > 2;
                        return (
                          <tr key={d.id}>
                            <td className="font-semibold">Caja {d.caja}</td>
                            <td style={{ textAlign: "right" }}>{d.hora_cierre || "—"}</td>
                            <td style={{ textAlign: "right" }} className="font-mono-metric">
                              {formatEurDecimal(d.saldo)}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <span className={`font-mono-metric font-semibold ${esGordo ? "" : ""}`}
                                style={{
                                  color: esGordo
                                    ? (d.descuadre >= 0 ? "#92400E" : "var(--color-reig-danger)")
                                    : "var(--color-reig-success)",
                                }}>
                                {d.descuadre >= 0 ? "+" : ""}{formatEurDecimal(d.descuadre)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Calendario — rellena la columna izquierda */}
              {tieneCalendario && <CalendarioMes festivos={festivos} />}
            </div>

            {/* ── COLUMNA DER (2/5): Equipo + Guardias ── */}
            <div className="xl:col-span-2 space-y-4">

              {/* Equipo hoy */}
              {horarios !== null && (
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-bold" style={{ color: "var(--color-reig-text)" }}>
                        Equipo hoy
                      </h2>
                      <p className="text-xs" style={{ color: "var(--color-reig-text-muted)" }}>
                        Horario asignado esta semana
                      </p>
                    </div>
                    <Link href="/rrhh" className="btn btn-secondary btn-sm">Ver RRHH</Link>
                  </div>

                  {horarios.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--color-reig-text-muted)" }}>
                      Sin horarios asignados esta semana
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {horarios.map((h) => {
                        const turnoInfo: Record<number, { text: string; color: string; bg: string }> = {
                          0: { text: "8:30–12:30", color: "#7c3aed", bg: "#f3e8ff" },
                          1: { text: "8:30–16:30", color: "var(--color-reig-optica)", bg: "var(--color-reig-optica-light)" },
                          2: { text: "9–13 / 16–20", color: "var(--color-reig-green)", bg: "var(--color-reig-green-light)" },
                          3: { text: "12:30–20:30", color: "#854d0e", bg: "#fef9c3" },
                        };
                        const turnoNum = typeof h.turno === "string" ? parseInt(h.turno) : h.turno;
                        const info = turnoInfo[turnoNum] || { text: `Turno ${h.turno}`, color: "var(--color-reig-text-secondary)", bg: "#F3F4F6" };
                        return (
                          <div key={h.empleado_id}
                            className="flex items-center justify-between py-2 px-3 rounded-lg"
                            style={{ background: "var(--color-reig-bg)" }}
                          >
                            <span className="text-sm font-medium" style={{ color: "var(--color-reig-text)" }}>
                              {h.nombre}
                            </span>
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full font-mono-metric"
                              style={{ color: info.color, background: info.bg }}
                            >
                              {info.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Vacaciones inline */}
                  {vacaciones !== null && vacaciones.length > 0 && (
                    <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--color-reig-border-light)" }}>
                      <p className="text-xs font-bold uppercase tracking-wide mb-2"
                        style={{ color: "var(--color-reig-warn)" }}>
                        De vacaciones hoy
                      </p>
                      <div className="space-y-1">
                        {vacaciones.map((v) => (
                          <div key={v.id} className="flex items-center justify-between text-sm">
                            <span className="font-medium" style={{ color: "var(--color-reig-text)" }}>
                              {v.nombre}
                            </span>
                            <span className="text-xs" style={{ color: "var(--color-reig-text-muted)" }}>
                              hasta {formatFechaCorta(v.fecha_fin)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Próximas guardias */}
              {guardias !== null && guardias.length > 0 && (
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-bold" style={{ color: "var(--color-reig-text)" }}>
                        Próximas guardias
                      </h2>
                      <p className="text-xs" style={{ color: "var(--color-reig-text-muted)" }}>
                        Ciclo de 19 días
                      </p>
                    </div>
                    <Link href="/rrhh" className="btn btn-secondary btn-sm">Calendario</Link>
                  </div>
                  <div className="space-y-2">
                    {guardias.map((g, i) => {
                      const dias = diasHasta(g.fecha);
                      const esInminente = dias <= 2;
                      return (
                        <div key={g.id || i}
                          className="flex items-center justify-between py-2.5 px-3 rounded-lg"
                          style={{
                            background: esInminente ? "var(--color-reig-danger-light)" : "var(--color-reig-bg)",
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-mono-metric"
                              style={{
                                background: esInminente ? "var(--color-reig-danger)" : "var(--color-reig-green)",
                                color: "#fff",
                              }}
                            >
                              {new Date(g.fecha + "T12:00:00").getDate()}
                            </span>
                            <div>
                              <p className="text-sm font-medium capitalize" style={{ color: "var(--color-reig-text)" }}>
                                {formatFecha(g.fecha)}
                              </p>
                              <p className="text-xs" style={{ color: "var(--color-reig-text-muted)" }}>
                                {g.es_festivo ? "Festivo" : g.tipo === "fest" ? "Fin de semana" : "Laborable"}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{
                              background: esInminente ? "var(--color-reig-danger)" : "var(--color-reig-green-light)",
                              color: esInminente ? "#fff" : "var(--color-reig-green-dark)",
                            }}
                          >
                            {dias === 0 ? "Hoy" : dias === 1 ? "Mañana" : `${dias} días`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Accesos rápidos */}
              {(() => {
                const accesos = [
                  { label: "Retiradas", href: "/retiradas", permiso: "financiero_retiradas" },
                  { label: "Historial", href: "/retiradas/historial", permiso: "financiero_historial" },
                  { label: "Ingresos", href: "/ingresos", permiso: "financiero_ingresos" },
                  { label: "CRM", href: "/crm", permiso: "marketing_crm" },
                  { label: "Paciente crónico", href: "/marketing/cronico", permiso: "marketing_cronico" },
                  { label: "Equipo", href: "/rrhh/equipo", permiso: "rrhh_equipo" },
                  { label: "Nóminas", href: "/rrhh/nominas", permiso: "rrhh_nominas" },
                ].filter((a) => puede(a.permiso));
                if (accesos.length === 0) return null;
                return (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide mb-2"
                      style={{ color: "var(--color-reig-text-muted)" }}>
                      Accesos rápidos
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {accesos.map((a) => (
                        <Link key={a.href} href={a.href}
                          className="text-center py-2.5 rounded-lg text-xs font-semibold transition-all hover:shadow-sm"
                          style={{
                            background: "var(--color-reig-surface)",
                            color: "var(--color-reig-text-secondary)",
                            border: "1px solid var(--color-reig-border)",
                            textDecoration: "none",
                          }}
                        >
                          {a.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
