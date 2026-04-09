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

const VENDEDOR_COLORS = ["#2E7D32", "#1565C0", "#E65100", "#7c3aed", "#be185d", "#0d9488", "#854d0e"];

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
                if (data.vendedores && data.vendedores.length > 0) {
                  setVentas(data.vendedores);
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
  const fechaHoy = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  /* ── Tiene datos financieros ── */
  const tieneVentasDetalle = ventas !== null && ventas.length > 0;
  const tieneDescuadresDetalle = descuadres !== null && descuadres.length > 0;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>

      {/* ═══════════════════════════════════════════
          HEADER con gradiente sutil
          ═══════════════════════════════════════════ */}
      <div style={{
        background: "linear-gradient(135deg, #f0fdf0 0%, #f8f9fb 50%, #eff6ff 100%)",
        borderRadius: 18, padding: "26px 30px 22px",
        marginBottom: 22, position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -30, right: -10,
          width: 140, height: 140, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(46,125,50,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <p style={{ fontSize: 14, color: "#6B7280", fontWeight: 400, marginBottom: 2 }}>
          {saludo},
        </p>
        <h1 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 30, color: "#111827", lineHeight: 1.15, marginBottom: 2,
        }}>
          {nombre}
        </h1>
        <p style={{ fontSize: 14, color: "#9CA3AF", textTransform: "capitalize" }}>{fechaHoy}</p>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{
              background: "#fff", borderRadius: 14, border: "1px solid #E2E5EA",
              padding: 22, height: 120,
            }}>
              <div className="skeleton" style={{ width: "55%", height: 10, marginBottom: 14, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: "40%", height: 26, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* ═══ FILA KPIs — Ventas es hero (más grande), resto normal ═══ */}
          <div style={{
            display: "grid",
            gridTemplateColumns: ventas !== null ? "1.5fr 1fr 1fr 1fr" : "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
          }}>

            {/* VENTAS — hero card con gradiente */}
            {ventas !== null && (
              <Link href="/crm" className="dash-hero" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{
                  background: "linear-gradient(145deg, #1B5E20, #2E7D32 50%, #43A047)",
                  borderRadius: 14, padding: "20px 22px", color: "#fff",
                  height: "100%", position: "relative", overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute", top: -20, right: -10,
                    width: 80, height: 80, borderRadius: "50%",
                    background: "rgba(255,255,255,0.08)", pointerEvents: "none",
                  }} />
                  <p style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.08em", opacity: 0.65, marginBottom: 8,
                  }}>
                    {ventasFecha
                      ? `Ventas · ${ventasFecha === hoy() ? "hoy" : formatFechaCorta(ventasFecha)}`
                      : "Ventas"}
                  </p>
                  <p style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 28, fontWeight: 700, lineHeight: 1, marginBottom: 5,
                  }}>
                    {ventasFecha ? formatEur(ventasTotal) : "—"}
                  </p>
                  <p style={{ fontSize: 12, opacity: 0.55 }}>
                    {ventasFecha
                      ? `${ticketsTotal} tickets · media ${formatEurDecimal(ticketMedio)}`
                      : "Sin datos recientes"}
                  </p>
                </div>
              </Link>
            )}

            {/* DESCUADRE */}
            {descuadres !== null && (
              <Link href="/descuadres" className="dash-card" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{
                  background: "#fff", borderRadius: 14,
                  padding: "20px 22px", height: "100%",
                  borderTop: `3px solid ${hayAlertaDescuadre ? "#F59E0B" : "#16A34A"}`,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}>
                  <p style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.06em", color: "#6B7280", marginBottom: 8,
                  }}>Descuadre · hoy</p>
                  <p style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 24, fontWeight: 700, lineHeight: 1, marginBottom: 5,
                    color: hayAlertaDescuadre ? "#D97706" : "#111827",
                  }}>
                    {descuadreNeto >= 0 ? "+" : ""}{formatEurDecimal(descuadreNeto)}
                  </p>
                  <p style={{ fontSize: 11, color: "#9CA3AF" }}>
                    {descuadres.length} caja{descuadres.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </Link>
            )}

            {/* TARJETAS */}
            {tarjetas !== null && (
              <Link href="/tarjetas" className="dash-card" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{
                  background: "#fff", borderRadius: 14,
                  padding: "20px 22px", height: "100%",
                  borderTop: "3px solid #1565C0",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}>
                  <p style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.06em", color: "#6B7280", marginBottom: 8,
                  }}>Tarjetas · hoy</p>
                  <p style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 24, fontWeight: 700, lineHeight: 1, marginBottom: 5,
                    color: "#111827",
                  }}>
                    {formatEur(tarjetas.total)}
                  </p>
                  <p style={{ fontSize: 11, color: "#9CA3AF" }}>
                    {tarjetas.count || 0} operaciones
                  </p>
                </div>
              </Link>
            )}

            {/* GUARDIA */}
            {proximaGuardia && (
              <Link href="/rrhh" className="dash-card" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{
                  background: diasParaGuardia !== null && diasParaGuardia <= 2
                    ? "linear-gradient(145deg, #991b1b, #DC2626)" : "#fff",
                  borderRadius: 14, padding: "20px 22px", height: "100%",
                  borderTop: diasParaGuardia !== null && diasParaGuardia <= 2
                    ? "none" : "3px solid #2E7D32",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  color: diasParaGuardia !== null && diasParaGuardia <= 2 ? "#fff" : "inherit",
                  position: "relative", overflow: "hidden",
                }}>
                  {diasParaGuardia !== null && diasParaGuardia <= 2 && (
                    <div style={{
                      position: "absolute", top: -12, right: -8,
                      width: 50, height: 50, borderRadius: "50%",
                      background: "rgba(255,255,255,0.1)", pointerEvents: "none",
                    }} />
                  )}
                  <p style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.06em", marginBottom: 8,
                    color: diasParaGuardia !== null && diasParaGuardia <= 2 ? "rgba(255,255,255,0.6)" : "#6B7280",
                  }}>Guardia</p>
                  <p style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontSize: 17, lineHeight: 1.2, marginBottom: 5,
                  }}>
                    {formatFecha(proximaGuardia.fecha)}
                  </p>
                  <p style={{
                    fontSize: 11,
                    color: diasParaGuardia !== null && diasParaGuardia <= 2 ? "rgba(255,255,255,0.55)" : "#9CA3AF",
                  }}>
                    {diasParaGuardia === 0 ? "Hoy" : diasParaGuardia === 1 ? "Mañana" : `En ${diasParaGuardia} días`}
                    {" · "}{proximaGuardia.es_festivo ? "Festivo" : proximaGuardia.tipo === "fest" ? "Fin de sem." : "Laborable"}
                  </p>
                </div>
              </Link>
            )}
          </div>

          {/* ═══ FILA 2: Contenido según datos ═══ */}
          <div style={{
            display: "grid",
            gridTemplateColumns: tieneVentasDetalle || tieneDescuadresDetalle
              ? "3fr 2fr" : "1fr",
            gap: 14,
          }}>

            {/* ── COLUMNA IZQ: Ventas + Descuadres ── */}
            {(tieneVentasDetalle || tieneDescuadresDetalle) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Ventas por vendedor */}
                {tieneVentasDetalle && (
                  <div style={{
                    background: "#fff", borderRadius: 14,
                    padding: "22px 24px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 18,
                    }}>
                      <h2 style={{
                        fontFamily: "'DM Serif Display', serif",
                        fontSize: 17, color: "#111827",
                      }}>Ventas por vendedor</h2>
                      <Link href="/crm" style={{
                        fontSize: 11, fontWeight: 600, color: "#2E7D32",
                        textDecoration: "none", padding: "5px 14px",
                        borderRadius: 20, background: "#f0fdf4", border: "1px solid #dcfce7",
                      }}>
                        Ver CRM →
                      </Link>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {ventas!
                        .sort((a, b) => b.facturacion - a.facturacion)
                        .map((v, idx) => {
                          const pct = ventasTotal > 0 ? (v.facturacion / ventasTotal) * 100 : 0;
                          const color = VENDEDOR_COLORS[idx % VENDEDOR_COLORS.length];
                          return (
                            <div key={v.vendedor}>
                              <div style={{
                                display: "flex", justifyContent: "space-between",
                                alignItems: "center", marginBottom: 5,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{
                                    width: 8, height: 8, borderRadius: "50%",
                                    background: color, flexShrink: 0,
                                  }} />
                                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                                    {v.vendedor}
                                  </span>
                                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                                    {v.tickets} tickets
                                  </span>
                                </div>
                                <span style={{
                                  fontFamily: "'JetBrains Mono', monospace",
                                  fontSize: 13, fontWeight: 600, color: "#374151",
                                }}>
                                  {formatEur(v.facturacion)}
                                </span>
                              </div>
                              <div style={{ height: 6, borderRadius: 3, background: "#f3f4f6" }}>
                                <div style={{
                                  height: "100%", borderRadius: 3,
                                  width: `${pct}%`,
                                  background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                                  transition: "width 0.6s ease-out",
                                }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Descuadres detalle */}
                {tieneDescuadresDetalle && (
                  <div style={{
                    background: "#fff", borderRadius: 14,
                    padding: "22px 24px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 16,
                    }}>
                      <h2 style={{
                        fontFamily: "'DM Serif Display', serif",
                        fontSize: 17, color: "#111827",
                      }}>Descuadres por caja</h2>
                      <Link href="/descuadres" style={{
                        fontSize: 11, fontWeight: 600, color: "#2E7D32",
                        textDecoration: "none", padding: "5px 14px",
                        borderRadius: 20, background: "#f0fdf4", border: "1px solid #dcfce7",
                      }}>
                        Ver todo →
                      </Link>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {descuadres!.sort((a, b) => a.caja - b.caja).map((d) => {
                        const esGordo = Math.abs(d.descuadre) > 2;
                        const esPos = d.descuadre >= 0;
                        return (
                          <div key={d.id} style={{
                            display: "flex", justifyContent: "space-between",
                            alignItems: "center", padding: "10px 14px", borderRadius: 10,
                            background: esGordo ? (esPos ? "#FFFBEB" : "#FEF2F2") : "#F9FAFB",
                            border: `1px solid ${esGordo ? (esPos ? "#fde68a" : "#fecaca") : "#F3F4F6"}`,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{
                                width: 28, height: 28, borderRadius: 8,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 12, fontWeight: 700,
                                background: "#fff", color: "#6B7280", border: "1px solid #E5E7EB",
                              }}>{d.caja}</span>
                              <span style={{ fontSize: 13, color: "#374151" }}>Caja {d.caja}</span>
                            </div>
                            <span style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 14, fontWeight: 700,
                              color: esGordo ? (esPos ? "#92400E" : "#DC2626") : "#16A34A",
                            }}>
                              {d.descuadre >= 0 ? "+" : ""}{formatEurDecimal(d.descuadre)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── COLUMNA DER: Equipo + Guardias ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Equipo hoy */}
              {horarios !== null && (
                <div style={{
                  background: "#fff", borderRadius: 14,
                  padding: "22px 24px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: 16,
                  }}>
                    <h2 style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontSize: 17, color: "#111827",
                    }}>Equipo hoy</h2>
                    <Link href="/rrhh" style={{
                      fontSize: 11, fontWeight: 600, color: "#2E7D32",
                      textDecoration: "none", padding: "5px 14px",
                      borderRadius: 20, background: "#f0fdf4", border: "1px solid #dcfce7",
                    }}>
                      RRHH →
                    </Link>
                  </div>

                  {horarios.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#9CA3AF" }}>Sin horarios asignados</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {horarios.map((h) => {
                        const turnoInfo: Record<number, { text: string; color: string; bg: string; border: string }> = {
                          0: { text: "8:30–12:30", color: "#7c3aed", bg: "#faf5ff", border: "#e9d5ff" },
                          1: { text: "8:30–16:30", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
                          2: { text: "9–13 / 16–20", color: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
                          3: { text: "12:30–20:30", color: "#854d0e", bg: "#fefce8", border: "#fde68a" },
                        };
                        const turnoNum = typeof h.turno === "string" ? parseInt(h.turno) : h.turno;
                        const info = turnoInfo[turnoNum] || { text: `T${h.turno}`, color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" };
                        return (
                          <div key={h.empleado_id} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 12px", borderRadius: 10,
                            background: info.bg, border: `1px solid ${info.border}`,
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                              {h.nombre}
                            </span>
                            <span style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 11, fontWeight: 700, color: info.color,
                            }}>
                              {info.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Vacaciones */}
                  {vacaciones !== null && vacaciones.length > 0 && (
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed #E2E5EA" }}>
                      <p style={{
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.06em", color: "#D97706", marginBottom: 8,
                      }}>De vacaciones</p>
                      {vacaciones.map((v) => (
                        <div key={v.id} style={{
                          display: "flex", justifyContent: "space-between",
                          alignItems: "center", fontSize: 13, paddingTop: 4,
                        }}>
                          <span style={{ fontWeight: 500, color: "#111827" }}>{v.nombre}</span>
                          <span style={{ fontSize: 11, color: "#9CA3AF" }}>hasta {formatFechaCorta(v.fecha_fin)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Próximas guardias */}
              {guardias !== null && guardias.length > 0 && (
                <div style={{
                  background: "#fff", borderRadius: 14,
                  padding: "22px 24px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: 16,
                  }}>
                    <h2 style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontSize: 17, color: "#111827",
                    }}>Próximas guardias</h2>
                    <Link href="/rrhh" style={{
                      fontSize: 11, fontWeight: 600, color: "#2E7D32",
                      textDecoration: "none", padding: "5px 14px",
                      borderRadius: 20, background: "#f0fdf4", border: "1px solid #dcfce7",
                    }}>
                      Calendario →
                    </Link>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {guardias.map((g, i) => {
                      const dias = diasHasta(g.fecha);
                      const esInminente = dias <= 2;
                      return (
                        <div key={g.id || i} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "12px 14px", borderRadius: 10,
                          background: esInminente
                            ? "linear-gradient(135deg, #fef2f2, #fff1f2)" : "#F9FAFB",
                          border: `1px solid ${esInminente ? "#fecaca" : "#F3F4F6"}`,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{
                              width: 36, height: 36, borderRadius: 10,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: esInminente ? "#DC2626" : "#2E7D32",
                              color: "#fff", fontSize: 14, fontWeight: 700,
                              fontFamily: "'JetBrains Mono', monospace",
                            }}>
                              {new Date(g.fecha + "T12:00:00").getDate()}
                            </span>
                            <div>
                              <p style={{
                                fontSize: 13, fontWeight: 600, color: "#111827",
                                textTransform: "capitalize",
                              }}>{formatFecha(g.fecha)}</p>
                              <p style={{ fontSize: 11, color: "#9CA3AF" }}>
                                {g.es_festivo ? "Festivo" : g.tipo === "fest" ? "Fin de semana" : "Laborable"}
                              </p>
                            </div>
                          </div>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "4px 10px",
                            borderRadius: 20,
                            background: esInminente ? "#DC2626" : "#f0fdf4",
                            color: esInminente ? "#fff" : "#166534",
                            border: esInminente ? "none" : "1px solid #dcfce7",
                          }}>
                            {dias === 0 ? "HOY" : dias === 1 ? "MAÑANA" : `${dias} días`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ CALENDARIO MENSUAL ═══ */}
          {puede("rrhh_calendario") && (() => {
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
              <div style={{
                background: "#fff", borderRadius: 14,
                padding: "22px 24px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 18,
                }}>
                  <h2 style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontSize: 20, color: "#111827",
                  }}>
                    {meses[month]} {year}
                  </h2>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {[1, 2, 3].map((t) => (
                      <span key={t} style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 8px",
                        borderRadius: 6, background: TURNO_COLORS[t].bg, color: TURNO_COLORS[t].color,
                      }}>{TURNO_SHORT[t]}</span>
                    ))}
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 8px",
                      borderRadius: 6, background: "#f0fdf4", color: "#166534",
                    }}>Guardia</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 8px",
                      borderRadius: 6, background: "#fef2f2", color: "#b91c1c",
                    }}>Festivo</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                  {DIAS_HDR.map((d, i) => (
                    <div key={d} style={{
                      textAlign: "center", fontSize: 11, fontWeight: 700,
                      color: i >= 5 ? "#D1D5DB" : "#9CA3AF", paddingBottom: 8,
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

                    let cellBg = "#fff";
                    let numColor = "#374151";
                    let borderCol = "#F3F4F6";

                    if (isToday) {
                      cellBg = "#2E7D32";
                      numColor = "#fff";
                      borderCol = "#2E7D32";
                    } else if (isGuard) {
                      cellBg = "#f0fdf4";
                      numColor = "#166534";
                      borderCol = "#bbf7d0";
                    } else if (isFestivo) {
                      cellBg = "#fef2f2";
                      numColor = "#b91c1c";
                      borderCol = "#fecaca";
                    } else if (isWeekend) {
                      cellBg = "#FAFAFA";
                      numColor = "#D1D5DB";
                    }

                    return (
                      <div key={fecha} style={{
                        textAlign: "center", padding: "6px 2px 5px",
                        borderRadius: isToday ? 10 : 8,
                        background: cellBg, border: `1px solid ${borderCol}`,
                        minHeight: 46,
                      }}
                        title={isFestivo ? festivoNames[fecha] : isGuard ? "Guardia" : undefined}
                      >
                        <span style={{
                          fontSize: 12, fontWeight: isToday ? 700 : 500,
                          color: numColor,
                        }}>{dayNum}</span>
                        {!isWeekend && !isFestivo && !isToday && turnoThisWeek > 0 && (
                          <div style={{ marginTop: 2 }}>
                            <span style={{
                              fontSize: 7, fontWeight: 700, padding: "1px 4px",
                              borderRadius: 3,
                              background: TURNO_COLORS[turnoThisWeek]?.bg,
                              color: TURNO_COLORS[turnoThisWeek]?.color,
                            }}>{TURNO_SHORT[turnoThisWeek]}</span>
                          </div>
                        )}
                        {isGuard && !isToday && (
                          <div style={{ marginTop: 2 }}>
                            <span style={{
                              fontSize: 7, fontWeight: 800, color: "#166534",
                              background: "#dcfce7", padding: "1px 4px", borderRadius: 3,
                            }}>G</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ═══ ACCESOS RÁPIDOS ═══ */}
          {(() => {
            const accesos = [
              { label: "Retiradas", href: "/retiradas", permiso: "financiero_retiradas" },
              { label: "Historial", href: "/retiradas/historial", permiso: "financiero_historial" },
              { label: "Ingresos", href: "/ingresos", permiso: "financiero_ingresos" },
              { label: "CRM", href: "/crm", permiso: "marketing_crm" },
              { label: "Equipo", href: "/rrhh/equipo", permiso: "rrhh_equipo" },
              { label: "Nóminas", href: "/rrhh/nominas", permiso: "rrhh_nominas" },
            ].filter((a) => puede(a.permiso));
            if (accesos.length === 0) return null;
            return (
              <div>
                <p style={{
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.08em", color: "#D1D5DB", marginBottom: 10,
                }}>Accesos rápidos</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {accesos.map((a) => (
                    <Link key={a.href} href={a.href} className="dash-shortcut" style={{
                      textDecoration: "none", fontSize: 12, fontWeight: 600,
                      color: "#374151", padding: "9px 18px",
                      borderRadius: 980, background: "#fff",
                      border: "1px solid #E2E5EA",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}>
                      {a.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}

        </div>
      )}

      <style>{`
        .dash-hero > div {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .dash-hero:hover > div {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(46,125,50,0.25);
        }
        .dash-card > div {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .dash-card:hover > div {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
        }
        .dash-shortcut {
          transition: all 0.15s ease !important;
        }
        .dash-shortcut:hover {
          border-color: #2E7D32 !important;
          color: #1B5E20 !important;
          background: #f0fdf4 !important;
          transform: translateY(-1px);
        }
        @media (max-width: 900px) {
          div[style*="1.5fr 1fr 1fr 1fr"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          div[style*="3fr 2fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
