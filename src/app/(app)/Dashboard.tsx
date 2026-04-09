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
  const d = new Date(fecha + "T12:00:00");
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]}`;
}

function formatFechaCorta(fecha: string) {
  const d = new Date(fecha + "T12:00:00");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
}

function diasHasta(fecha: string) {
  const hoyMs = new Date(hoy() + "T00:00:00").getTime();
  const fechaMs = new Date(fecha + "T00:00:00").getTime();
  return Math.ceil((fechaMs - hoyMs) / (1000 * 60 * 60 * 24));
}

/* ───── Iconos SVG ───── */

const icons = {
  euro: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 15.536c-1.171 1.952-3.07 1.952-4.242 0-1.172-1.953-1.172-5.119 0-7.072 1.171-1.952 3.07-1.952 4.242 0M8 10.5h4m-4 3h4" />
    </svg>
  ),
  balanza: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  ),
  tarjeta: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  reloj: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  palmera: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  escudo: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  alerta: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
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
  const [loading, setLoading] = useState(true);

  const puede = (mod: string) => role === "admin" || modulosPermitidos.includes(mod);

  useEffect(() => {
    const today = hoy();
    const monday = lunesDeSemana(today);
    const year = today.slice(0, 4);

    const fetches: Promise<void>[] = [];

    // Ventas — intentar hoy, si no hay datos retroceder hasta 7 días
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

    // Descuadres
    if (puede("financiero_descuadres")) {
      fetches.push(
        fetch(`/api/descuadres?vista=dia&fecha=${today}`)
          .then((r) => r.json())
          .then((data) => setDescuadres(data.cierres || []))
          .catch(() => setDescuadres([]))
      );
    }

    // Tarjetas
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

    // Horarios
    if (puede("rrhh_equipo")) {
      fetches.push(
        fetch(`/api/rrhh/horarios?week=${monday}&weeks=1`)
          .then((r) => r.json())
          .then((data) => setHorarios(data.asignaciones || []))
          .catch(() => setHorarios([]))
      );
    }

    // Vacaciones
    if (puede("rrhh_vacaciones")) {
      fetches.push(
        fetch(`/api/rrhh/vacaciones?year=${year}`)
          .then((r) => r.json())
          .then((data) => {
            const all = data.vacaciones || [];
            const hoyVac = all.filter(
              (v: Vacacion) => v.fecha_inicio <= today && v.fecha_fin >= today && v.estado === "aprobada"
            );
            setVacaciones(hoyVac);
          })
          .catch(() => setVacaciones([]))
      );
    }

    // Guardias
    if (puede("rrhh_calendario")) {
      fetches.push(
        fetch(`/api/rrhh/guardias?year=${year}`)
          .then((r) => r.json())
          .then((data) => {
            const all: Guardia[] = data.guardias || [];
            const futuras = all
              .filter((g) => g.fecha >= today)
              .sort((a, b) => a.fecha.localeCompare(b.fecha));
            setGuardias(futuras.slice(0, 3));
          })
          .catch(() => setGuardias([]))
      );
    }

    Promise.allSettled(fetches).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cálculos derivados ──

  const ventasTotal = ventas?.reduce((s, v) => s + v.facturacion, 0) ?? 0;
  const ticketsTotal = ventas?.reduce((s, v) => s + v.tickets, 0) ?? 0;
  const ticketMedio = ticketsTotal > 0 ? ventasTotal / ticketsTotal : 0;

  const descuadreNeto = descuadres?.reduce((s, d) => s + d.descuadre, 0) ?? 0;
  const descuadreAbs = Math.abs(descuadreNeto);
  const hayAlertaDescuadre = descuadreAbs > 2; // más de 2€

  const proximaGuardia = guardias && guardias.length > 0 ? guardias[0] : null;
  const diasParaGuardia = proximaGuardia ? diasHasta(proximaGuardia.fecha) : null;

  // ── Nombre del saludo según hora ──
  const hora = new Date().getHours();
  const saludo = hora < 14 ? "Buenos días" : hora < 21 ? "Buenas tardes" : "Buenas noches";
  const nombre = userName.split(" ")[0];

  return (
    <div className="max-w-6xl">
      {/* ── Header ── */}
      <div className="mb-8">
        <h1
          className="text-2xl md:text-3xl font-semibold"
          style={{ fontFamily: "'DM Serif Display', serif", color: "var(--color-reig-text)" }}
        >
          {saludo}, {nombre}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-reig-text-muted)" }}>
          {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card" style={{ height: 120 }}>
              <div className="skeleton" style={{ width: "60%", height: 12, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: "40%", height: 28 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">

          {/* ════ FILA 1: KPIs rápidos ════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Ventas */}
            {ventas !== null && (
              <Link href="/crm" className="card group hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="kpi-label" style={{ marginBottom: 0 }}>
                    Ventas {ventasFecha === hoy() ? "hoy" : formatFechaCorta(ventasFecha)}
                  </span>
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--color-reig-green-light)", color: "var(--color-reig-green)" }}
                  >
                    {icons.euro}
                  </span>
                </div>
                <p className="kpi-value">{formatEur(ventasTotal)}</p>
                <p className="text-xs mt-1" style={{ color: "var(--color-reig-text-muted)" }}>
                  {ticketsTotal} tickets · media {formatEurDecimal(ticketMedio)}
                </p>
              </Link>
            )}

            {/* Descuadres */}
            {descuadres !== null && (
              <Link
                href="/descuadres"
                className="card group hover:shadow-md transition-shadow"
                style={hayAlertaDescuadre ? { borderColor: "var(--color-reig-warn)" } : undefined}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="kpi-label" style={{ marginBottom: 0 }}>Descuadre hoy</span>
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: hayAlertaDescuadre ? "var(--color-reig-warn-light)" : "var(--color-reig-green-light)",
                      color: hayAlertaDescuadre ? "var(--color-reig-warn)" : "var(--color-reig-green)",
                    }}
                  >
                    {hayAlertaDescuadre ? icons.alerta : icons.balanza}
                  </span>
                </div>
                <p className="kpi-value" style={hayAlertaDescuadre ? { color: "var(--color-reig-warn)" } : undefined}>
                  {descuadreNeto >= 0 ? "+" : ""}{formatEurDecimal(descuadreNeto)}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--color-reig-text-muted)" }}>
                  {descuadres.length} caja{descuadres.length !== 1 ? "s" : ""} registrada{descuadres.length !== 1 ? "s" : ""}
                </p>
              </Link>
            )}

            {/* Tarjetas */}
            {tarjetas !== null && (
              <Link href="/tarjetas" className="card group hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="kpi-label" style={{ marginBottom: 0 }}>Tarjetas hoy</span>
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--color-reig-optica-light)", color: "var(--color-reig-optica)" }}
                  >
                    {icons.tarjeta}
                  </span>
                </div>
                <p className="kpi-value">{formatEur(tarjetas.total)}</p>
                <p className="text-xs mt-1" style={{ color: "var(--color-reig-text-muted)" }}>
                  {tarjetas.count || 0} operaciones
                </p>
              </Link>
            )}

            {/* Próxima guardia */}
            {proximaGuardia && (
              <Link
                href="/rrhh"
                className="card group hover:shadow-md transition-shadow"
                style={diasParaGuardia !== null && diasParaGuardia <= 2 ? { borderColor: "var(--color-reig-danger)" } : undefined}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="kpi-label" style={{ marginBottom: 0 }}>Próxima guardia</span>
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: diasParaGuardia !== null && diasParaGuardia <= 2
                        ? "var(--color-reig-danger-light)" : "var(--color-reig-green-light)",
                      color: diasParaGuardia !== null && diasParaGuardia <= 2
                        ? "var(--color-reig-danger)" : "var(--color-reig-green)",
                    }}
                  >
                    {icons.escudo}
                  </span>
                </div>
                <p className="kpi-value" style={{ fontSize: 18 }}>
                  {formatFecha(proximaGuardia.fecha)}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--color-reig-text-muted)" }}>
                  {diasParaGuardia === 0
                    ? "Hoy"
                    : diasParaGuardia === 1
                    ? "Mañana"
                    : `En ${diasParaGuardia} días`}
                  {" · "}
                  {proximaGuardia.es_festivo ? "Festivo" : proximaGuardia.tipo === "fest" ? "Fin de semana" : "Laborable"}
                </p>
              </Link>
            )}
          </div>

          {/* ════ FILA 2: Detalle del día ════ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* ── Ventas por vendedor ── */}
            {ventas !== null && ventas.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-bold" style={{ color: "var(--color-reig-text)" }}>
                      Ventas por vendedor
                    </h2>
                    <p className="text-xs" style={{ color: "var(--color-reig-text-muted)" }}>
                      {ventasFecha === hoy() ? "Hoy" : formatFecha(ventasFecha)}
                    </p>
                  </div>
                  <Link
                    href="/crm"
                    className="text-xs font-medium px-3 py-1 rounded-lg transition-colors"
                    style={{ color: "var(--color-reig-green)", background: "var(--color-reig-green-light)" }}
                  >
                    Ver CRM
                  </Link>
                </div>
                <div className="space-y-2">
                  {ventas
                    .sort((a, b) => b.facturacion - a.facturacion)
                    .map((v) => {
                      const pct = ventasTotal > 0 ? (v.facturacion / ventasTotal) * 100 : 0;
                      return (
                        <div key={v.vendedor}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium" style={{ color: "var(--color-reig-text)" }}>
                              {v.vendedor}
                            </span>
                            <span
                              className="font-mono text-xs font-semibold"
                              style={{ color: "var(--color-reig-text-secondary)" }}
                            >
                              {formatEur(v.facturacion)}
                            </span>
                          </div>
                          <div
                            className="h-1.5 rounded-full overflow-hidden"
                            style={{ background: "var(--color-reig-border-light)" }}
                          >
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: "var(--color-reig-green)" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* ── Horario del equipo ── */}
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
                  <Link
                    href="/rrhh"
                    className="text-xs font-medium px-3 py-1 rounded-lg transition-colors"
                    style={{ color: "var(--color-reig-green)", background: "var(--color-reig-green-light)" }}
                  >
                    Ver RRHH
                  </Link>
                </div>

                {horarios.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--color-reig-text-muted)" }}>
                    Sin horarios asignados esta semana
                  </p>
                ) : (
                  <div className="space-y-2">
                    {horarios.map((h) => {
                      const turnoLabel: Record<string, { text: string; color: string; bg: string }> = {
                        "M": { text: "Mañana", color: "var(--color-reig-green)", bg: "var(--color-reig-green-light)" },
                        "T": { text: "Tarde", color: "var(--color-reig-optica)", bg: "var(--color-reig-optica-light)" },
                        "P": { text: "Partido", color: "var(--color-reig-orto)", bg: "var(--color-reig-orto-light)" },
                        "L": { text: "Libre", color: "var(--color-reig-text-muted)", bg: "#F3F4F6" },
                        "V": { text: "Vacaciones", color: "var(--color-reig-warn)", bg: "var(--color-reig-warn-light)" },
                      };
                      const info = turnoLabel[h.turno] || { text: h.turno, color: "var(--color-reig-text-secondary)", bg: "#F3F4F6" };
                      return (
                        <div
                          key={h.empleado_id}
                          className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                          style={{ background: "var(--color-reig-bg)" }}
                        >
                          <span className="text-sm font-medium" style={{ color: "var(--color-reig-text)" }}>
                            {h.nombre}
                          </span>
                          <span
                            className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
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
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ color: "var(--color-reig-warn)" }}>{icons.palmera}</span>
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-reig-warn)" }}>
                        De vacaciones hoy
                      </span>
                    </div>
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
          </div>

          {/* ════ FILA 3: Descuadres detalle + Guardias próximas ════ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* ── Descuadres por caja ── */}
            {descuadres !== null && descuadres.length > 0 && (
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
                  <Link
                    href="/descuadres"
                    className="text-xs font-medium px-3 py-1 rounded-lg transition-colors"
                    style={{ color: "var(--color-reig-green)", background: "var(--color-reig-green-light)" }}
                  >
                    Ver todo
                  </Link>
                </div>
                <div className="space-y-1.5">
                  {descuadres
                    .sort((a, b) => a.caja - b.caja)
                    .map((d) => {
                      const esPositivo = d.descuadre >= 0;
                      const esGordo = Math.abs(d.descuadre) > 2;
                      return (
                        <div
                          key={d.id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg"
                          style={{
                            background: esGordo
                              ? (esPositivo ? "var(--color-reig-warn-light)" : "var(--color-reig-danger-light)")
                              : "var(--color-reig-bg)",
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center"
                              style={{
                                background: "var(--color-reig-surface)",
                                color: "var(--color-reig-text-secondary)",
                                border: "1px solid var(--color-reig-border)",
                              }}
                            >
                              {d.caja}
                            </span>
                            <span className="text-sm" style={{ color: "var(--color-reig-text)" }}>
                              Caja {d.caja}
                            </span>
                          </div>
                          <span
                            className="font-mono text-sm font-semibold"
                            style={{
                              color: esGordo
                                ? (esPositivo ? "#92400E" : "var(--color-reig-danger)")
                                : "var(--color-reig-success)",
                            }}
                          >
                            {d.descuadre >= 0 ? "+" : ""}{formatEurDecimal(d.descuadre)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* ── Próximas guardias ── */}
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
                  <Link
                    href="/rrhh"
                    className="text-xs font-medium px-3 py-1 rounded-lg transition-colors"
                    style={{ color: "var(--color-reig-green)", background: "var(--color-reig-green-light)" }}
                  >
                    Ver calendario
                  </Link>
                </div>
                <div className="space-y-2">
                  {guardias.map((g, i) => {
                    const dias = diasHasta(g.fecha);
                    const esInminente = dias <= 2;
                    return (
                      <div
                        key={g.id || i}
                        className="flex items-center justify-between py-2 px-3 rounded-lg"
                        style={{
                          background: esInminente ? "var(--color-reig-danger-light)" : "var(--color-reig-bg)",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{
                              background: esInminente ? "var(--color-reig-danger)" : "var(--color-reig-green)",
                              color: "#fff",
                            }}
                          >
                            {icons.escudo}
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
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
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
          </div>

          {/* ════ FILA 4: Accesos rápidos (los antiguos módulos, compactos) ════ */}
          <div>
            <h2
              className="text-xs font-bold uppercase tracking-wide mb-3"
              style={{ color: "var(--color-reig-text-muted)" }}
            >
              Accesos rápidos
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
              {[
                { label: "Retiradas", href: "/retiradas", permiso: "financiero_retiradas" },
                { label: "Historial", href: "/retiradas/historial", permiso: "financiero_historial" },
                { label: "Ingresos", href: "/ingresos", permiso: "financiero_ingresos" },
                { label: "CRM", href: "/crm", permiso: "marketing_crm" },
                { label: "Equipo", href: "/rrhh/equipo", permiso: "rrhh_equipo" },
                { label: "Nóminas", href: "/rrhh/nominas", permiso: "rrhh_nominas" },
              ]
                .filter((a) => puede(a.permiso))
                .map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="text-center py-3 px-2 rounded-lg text-xs font-semibold transition-all hover:shadow-sm"
                    style={{
                      background: "var(--color-reig-surface)",
                      color: "var(--color-reig-text-secondary)",
                      border: "1px solid var(--color-reig-border)",
                    }}
                  >
                    {a.label}
                  </Link>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
