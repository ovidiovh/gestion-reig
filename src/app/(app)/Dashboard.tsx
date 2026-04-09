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

/* ───── Estilos compartidos ───── */

const S = {
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "24px 26px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
    border: "none",
  } as React.CSSProperties,
  label: {
    fontSize: 11,
    fontWeight: 500 as const,
    color: "#86868b",
    letterSpacing: "0.01em",
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 20,
    fontWeight: 600 as const,
    color: "#1d1d1f",
    letterSpacing: "-0.02em",
  } as React.CSSProperties,
  link: {
    fontSize: 12,
    fontWeight: 500 as const,
    color: "#2E7D32",
    textDecoration: "none",
    cursor: "pointer",
  } as React.CSSProperties,
  mono: {
    fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
  } as React.CSSProperties,
};

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

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>

      {/* ── HEADER ── */}
      <header style={{ marginBottom: 36, paddingTop: 4 }}>
        <p style={{ fontSize: 15, color: "#86868b", fontWeight: 400, marginBottom: 2 }}>
          {saludo},
        </p>
        <h1 style={{
          fontSize: 32, fontWeight: 700, color: "#1d1d1f",
          letterSpacing: "-0.025em", lineHeight: 1.15,
        }}>
          {nombre}
        </h1>
        <p style={{
          fontSize: 15, color: "#86868b", fontWeight: 400,
          marginTop: 4, textTransform: "capitalize",
        }}>
          {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </header>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ ...S.card, height: 120 }}>
              <div className="skeleton" style={{ width: "50%", height: 10, marginBottom: 16, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: "35%", height: 24, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ═══ KPIs ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>

            {/* Ventas */}
            {ventas !== null && (
              <Link href="/crm" className="dash-kpi" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={S.card}>
                  <p style={S.label}>
                    {ventasFecha
                      ? `Ventas · ${ventasFecha === hoy() ? "hoy" : formatFechaCorta(ventasFecha)}`
                      : "Ventas"}
                  </p>
                  <p style={{
                    ...S.mono, fontSize: 28, fontWeight: 700,
                    color: "#1d1d1f", lineHeight: 1, marginTop: 8, marginBottom: 4,
                  }}>
                    {ventasFecha ? formatEur(ventasTotal) : "—"}
                  </p>
                  <p style={{ fontSize: 12, color: "#86868b" }}>
                    {ventasFecha
                      ? `${ticketsTotal} tickets · ${formatEurDecimal(ticketMedio)} media`
                      : "Sin datos recientes"}
                  </p>
                </div>
              </Link>
            )}

            {/* Descuadres */}
            {descuadres !== null && (
              <Link href="/descuadres" className="dash-kpi" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={S.card}>
                  <p style={S.label}>Descuadre · hoy</p>
                  <p style={{
                    ...S.mono, fontSize: 28, fontWeight: 700,
                    color: hayAlertaDescuadre ? "#bf4800" : "#1d1d1f",
                    lineHeight: 1, marginTop: 8, marginBottom: 4,
                  }}>
                    {descuadreNeto >= 0 ? "+" : ""}{formatEurDecimal(descuadreNeto)}
                  </p>
                  <p style={{ fontSize: 12, color: "#86868b" }}>
                    {descuadres.length} caja{descuadres.length !== 1 ? "s" : ""} registrada{descuadres.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </Link>
            )}

            {/* Tarjetas */}
            {tarjetas !== null && (
              <Link href="/tarjetas" className="dash-kpi" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={S.card}>
                  <p style={S.label}>Tarjetas · hoy</p>
                  <p style={{
                    ...S.mono, fontSize: 28, fontWeight: 700,
                    color: "#1d1d1f", lineHeight: 1, marginTop: 8, marginBottom: 4,
                  }}>
                    {formatEur(tarjetas.total)}
                  </p>
                  <p style={{ fontSize: 12, color: "#86868b" }}>
                    {tarjetas.count || 0} operaciones
                  </p>
                </div>
              </Link>
            )}

            {/* Guardia */}
            {proximaGuardia && (
              <Link href="/rrhh" className="dash-kpi" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{
                  ...S.card,
                  ...(diasParaGuardia !== null && diasParaGuardia <= 2
                    ? { background: "#1d1d1f", color: "#fff" }
                    : {}),
                }}>
                  <p style={{
                    ...S.label,
                    color: diasParaGuardia !== null && diasParaGuardia <= 2 ? "rgba(255,255,255,0.5)" : "#86868b",
                  }}>
                    Próxima guardia
                  </p>
                  <p style={{
                    fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em",
                    color: diasParaGuardia !== null && diasParaGuardia <= 2 ? "#fff" : "#1d1d1f",
                    lineHeight: 1.2, marginTop: 8, marginBottom: 4,
                    textTransform: "capitalize",
                  }}>
                    {formatFecha(proximaGuardia.fecha)}
                  </p>
                  <p style={{
                    fontSize: 12,
                    color: diasParaGuardia !== null && diasParaGuardia <= 2 ? "rgba(255,255,255,0.45)" : "#86868b",
                  }}>
                    {diasParaGuardia === 0 ? "Hoy" : diasParaGuardia === 1 ? "Mañana" : `En ${diasParaGuardia} días`}
                    {" · "}{proximaGuardia.es_festivo ? "Festivo" : proximaGuardia.tipo === "fest" ? "Fin de semana" : "Laborable"}
                  </p>
                </div>
              </Link>
            )}
          </div>

          {/* ═══ CONTENIDO PRINCIPAL ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: "5fr 3fr", gap: 12 }}>

            {/* ── COLUMNA IZQUIERDA ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Ventas por vendedor */}
              {ventas !== null && ventas.length > 0 && (
                <div style={S.card}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "baseline", marginBottom: 20,
                  }}>
                    <p style={S.sectionTitle}>Ventas</p>
                    <Link href="/crm" style={S.link}>Ver CRM</Link>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {ventas
                      .sort((a, b) => b.facturacion - a.facturacion)
                      .map((v, idx) => {
                        const pct = ventasTotal > 0 ? (v.facturacion / ventasTotal) * 100 : 0;
                        // Escala de grises progresiva — solo el primero tiene color
                        const barColor = idx === 0 ? "#1d1d1f" : idx === 1 ? "#6e6e73" : "#aeaeb2";
                        return (
                          <div key={v.vendedor}>
                            <div style={{
                              display: "flex", justifyContent: "space-between",
                              alignItems: "baseline", marginBottom: 6,
                            }}>
                              <span style={{ fontSize: 14, fontWeight: 500, color: "#1d1d1f" }}>
                                {v.vendedor}
                              </span>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                <span style={{ fontSize: 12, color: "#86868b" }}>
                                  {v.tickets} tickets
                                </span>
                                <span style={{
                                  ...S.mono, fontSize: 14, fontWeight: 600,
                                  color: idx === 0 ? "#1d1d1f" : "#6e6e73",
                                }}>
                                  {formatEur(v.facturacion)}
                                </span>
                              </div>
                            </div>
                            <div style={{
                              height: 4, borderRadius: 2,
                              background: "#f5f5f7",
                            }}>
                              <div style={{
                                height: "100%", borderRadius: 2,
                                width: `${pct}%`, background: barColor,
                                transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                              }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Descuadres por caja */}
              {descuadres !== null && descuadres.length > 0 && (
                <div style={S.card}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "baseline", marginBottom: 20,
                  }}>
                    <p style={S.sectionTitle}>Descuadres</p>
                    <Link href="/descuadres" style={S.link}>Ver detalle</Link>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {descuadres.sort((a, b) => a.caja - b.caja).map((d, idx) => {
                      const esGordo = Math.abs(d.descuadre) > 2;
                      return (
                        <div key={d.id} style={{
                          display: "flex", justifyContent: "space-between",
                          alignItems: "center", padding: "12px 0",
                          borderTop: idx > 0 ? "1px solid #f5f5f7" : "none",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{
                              ...S.mono, fontSize: 12, fontWeight: 600,
                              color: "#86868b", width: 20, textAlign: "center",
                            }}>{d.caja}</span>
                            <span style={{ fontSize: 14, color: "#1d1d1f" }}>Caja {d.caja}</span>
                          </div>
                          <span style={{
                            ...S.mono, fontSize: 14, fontWeight: 600,
                            color: esGordo ? "#bf4800" : "#1d1d1f",
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

            {/* ── COLUMNA DERECHA ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Equipo */}
              {horarios !== null && (
                <div style={S.card}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "baseline", marginBottom: 20,
                  }}>
                    <p style={S.sectionTitle}>Equipo</p>
                    <Link href="/rrhh" style={S.link}>RRHH</Link>
                  </div>

                  {horarios.length === 0 ? (
                    <p style={{ fontSize: 14, color: "#86868b" }}>Sin horarios asignados</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {horarios.map((h, idx) => {
                        const turnoInfo: Record<number, { text: string; color: string }> = {
                          0: { text: "8:30–12:30", color: "#7c3aed" },
                          1: { text: "8:30–16:30", color: "#1d4ed8" },
                          2: { text: "9–13 / 16–20", color: "#2E7D32" },
                          3: { text: "12:30–20:30", color: "#854d0e" },
                        };
                        const turnoNum = typeof h.turno === "string" ? parseInt(h.turno) : h.turno;
                        const info = turnoInfo[turnoNum] || { text: `T${h.turno}`, color: "#86868b" };
                        return (
                          <div key={h.empleado_id} style={{
                            display: "flex", justifyContent: "space-between",
                            alignItems: "center", padding: "11px 0",
                            borderTop: idx > 0 ? "1px solid #f5f5f7" : "none",
                          }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: "#1d1d1f" }}>
                              {h.nombre}
                            </span>
                            <span style={{
                              ...S.mono, fontSize: 12, fontWeight: 600, color: info.color,
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
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f5f5f7" }}>
                      <p style={{
                        fontSize: 11, fontWeight: 600, color: "#bf4800",
                        textTransform: "uppercase", letterSpacing: "0.04em",
                        marginBottom: 10,
                      }}>
                        De vacaciones
                      </p>
                      {vacaciones.map((v) => (
                        <div key={v.id} style={{
                          display: "flex", justifyContent: "space-between",
                          alignItems: "center", paddingTop: 4,
                        }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: "#1d1d1f" }}>
                            {v.nombre}
                          </span>
                          <span style={{ fontSize: 12, color: "#86868b" }}>
                            hasta {formatFechaCorta(v.fecha_fin)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Próximas guardias */}
              {guardias !== null && guardias.length > 0 && (
                <div style={S.card}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "baseline", marginBottom: 20,
                  }}>
                    <p style={S.sectionTitle}>Guardias</p>
                    <Link href="/rrhh" style={S.link}>Calendario</Link>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {guardias.map((g, i) => {
                      const dias = diasHasta(g.fecha);
                      const esInminente = dias <= 2;
                      return (
                        <div key={g.id || i} style={{
                          display: "flex", justifyContent: "space-between",
                          alignItems: "center", padding: "11px 0",
                          borderTop: i > 0 ? "1px solid #f5f5f7" : "none",
                        }}>
                          <div>
                            <p style={{
                              fontSize: 14, fontWeight: 500,
                              color: esInminente ? "#bf4800" : "#1d1d1f",
                              textTransform: "capitalize",
                            }}>
                              {formatFecha(g.fecha)}
                            </p>
                            <p style={{ fontSize: 12, color: "#86868b", marginTop: 1 }}>
                              {g.es_festivo ? "Festivo" : g.tipo === "fest" ? "Fin de semana" : "Laborable"}
                            </p>
                          </div>
                          <span style={{
                            ...S.mono, fontSize: 12, fontWeight: 600,
                            color: esInminente ? "#bf4800" : "#86868b",
                          }}>
                            {dias === 0 ? "HOY" : dias === 1 ? "MAÑANA" : `${dias}d`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ CALENDARIO ═══ */}
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
              <div style={{ ...S.card, marginTop: 0 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "baseline", marginBottom: 20,
                }}>
                  <p style={S.sectionTitle}>{meses[month]}</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {[1, 2, 3].map((t) => (
                      <span key={t} style={{
                        fontSize: 10, fontWeight: 600, color: TURNO_COLORS[t].color,
                      }}>
                        {TURNO_SHORT[t]}
                      </span>
                    ))}
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#166534" }}>G</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#b91c1c" }}>F</span>
                  </div>
                </div>

                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2,
                }}>
                  {DIAS_HDR.map((d, i) => (
                    <div key={d} style={{
                      textAlign: "center", fontSize: 11, fontWeight: 600,
                      color: i >= 5 ? "#d1d1d6" : "#86868b",
                      paddingBottom: 8,
                    }}>
                      {d}
                    </div>
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

                    let numColor = "#1d1d1f";
                    let cellBg = "transparent";
                    let numWeight = 400;

                    if (isToday) {
                      cellBg = "#1d1d1f";
                      numColor = "#fff";
                      numWeight = 700;
                    } else if (isGuard) {
                      cellBg = "#f0fdf4";
                      numColor = "#166534";
                      numWeight = 600;
                    } else if (isFestivo) {
                      numColor = "#b91c1c";
                      numWeight = 500;
                    } else if (isWeekend) {
                      numColor = "#d1d1d6";
                    }

                    return (
                      <div
                        key={fecha}
                        style={{
                          textAlign: "center", padding: "7px 0 5px",
                          borderRadius: isToday ? 10 : 8,
                          background: cellBg,
                          minHeight: 44,
                        }}
                        title={isFestivo ? festivoNames[fecha] : isGuard ? "Guardia" : undefined}
                      >
                        <span style={{
                          fontSize: 13, fontWeight: numWeight, color: numColor,
                          display: "inline-block",
                        }}>
                          {dayNum}
                        </span>
                        {!isWeekend && !isFestivo && !isToday && turnoThisWeek > 0 && (
                          <div style={{ marginTop: 2, lineHeight: 1 }}>
                            <span style={{
                              fontSize: 8, fontWeight: 700,
                              color: TURNO_COLORS[turnoThisWeek]?.color,
                            }}>
                              {TURNO_SHORT[turnoThisWeek]}
                            </span>
                          </div>
                        )}
                        {isGuard && !isToday && (
                          <div style={{ marginTop: 2, lineHeight: 1 }}>
                            <span style={{ fontSize: 8, fontWeight: 800, color: "#166534" }}>G</span>
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
              <div style={{ paddingTop: 4, paddingBottom: 16 }}>
                <div style={{
                  display: "flex", flexWrap: "wrap", gap: 8,
                }}>
                  {accesos.map((a) => (
                    <Link
                      key={a.href}
                      href={a.href}
                      className="dash-shortcut"
                      style={{
                        textDecoration: "none",
                        fontSize: 13, fontWeight: 500, color: "#1d1d1f",
                        padding: "8px 18px", borderRadius: 980,
                        background: "#f5f5f7",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
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
      )}

      <style>{`
        .dash-kpi > div {
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                      box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .dash-kpi:hover > div {
          transform: translateY(-2px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06);
        }
        .dash-shortcut:hover {
          background: #e8e8ed !important;
        }
        @media (max-width: 900px) {
          div[style*="gridTemplateColumns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          div[style*="gridTemplateColumns: 5fr 3fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
