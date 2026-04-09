"use client";

import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
   Tarjetas — Cobros con tarjeta por caja
   Datos: campo "Retirado" de emails Farmatic (descuadres_cierre)
   Vistas: día · semana · mes · patrón día de semana
   Fecha real: si cierre < 14:00 → día anterior, si >= 14:00 → mismo día
   ═══════════════════════════════════════════════════════════ */

/* ───── Tipos ───── */

interface TarjetaDia {
  fecha: string;
  total: number;
  por_caja: { caja: number; label: string; importe: number }[];
  num_cajas: number;
}

interface Agregado {
  clave: string;
  total: number;
  media: number;
  dias: number;
  min: number;
  max: number;
}

interface PatronDiaSemana {
  dia_semana: number;
  dia_nombre: string;
  total: number;
  media: number;
  dias: number;
  min: number;
  max: number;
}

interface Stats {
  total_periodo: number;
  media_diaria: number;
  mejor_dia: { fecha: string; total: number } | null;
  peor_dia: { fecha: string; total: number } | null;
  dias_con_datos: number;
  total_por_caja: { caja: number; label: string; total: number; media: number }[];
}

type Vista = "dia" | "semana" | "mes" | "dia_semana";

/* ───── Helpers ───── */

const fmt = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtFecha = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

function lunesDeSemana(fecha: Date): string {
  const d = new Date(fecha);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function rangoMes(fecha: Date): { desde: string; hasta: string } {
  const y = fecha.getFullYear();
  const m = fecha.getMonth();
  const desde = new Date(y, m, 1).toISOString().slice(0, 10);
  const hasta = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { desde, hasta };
}

function rangoSemana(fecha: Date): { desde: string; hasta: string } {
  const desde = lunesDeSemana(fecha);
  const d = new Date(desde);
  d.setDate(d.getDate() + 6);
  return { desde, hasta: d.toISOString().slice(0, 10) };
}

function rangoTrimestre(fecha: Date): { desde: string; hasta: string } {
  const y = fecha.getFullYear();
  const q = Math.floor(fecha.getMonth() / 3);
  const desde = new Date(y, q * 3, 1).toISOString().slice(0, 10);
  const hasta = new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10);
  return { desde, hasta };
}

/* ───── Estilos ───── */

const COLOR = {
  primary: "var(--color-reig-optica)",
  primaryLight: "var(--color-reig-optica-light)",
  primaryDark: "var(--color-reig-optica-dark)",
  header: "var(--color-reig-text)",
  text: "var(--color-reig-text)",
  muted: "var(--color-reig-text-secondary)",
  border: "var(--color-reig-border)",
  bg: "var(--color-reig-bg)",
  white: "#fff",
  green: "var(--color-reig-green)",
  greenLight: "var(--color-reig-green-light)",
  accent: "var(--color-reig-optica)",
};

const card: React.CSSProperties = {
  background: COLOR.white,
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  padding: 20,
  marginBottom: 16,
};

const statCard: React.CSSProperties = {
  ...card,
  textAlign: "center" as const,
  flex: 1,
  minWidth: 140,
};

/* ───── Componente principal ───── */

export default function TarjetasPage() {
  const [vista, setVista] = useState<Vista>("dia");
  const [periodo, setPeriodo] = useState<"semana" | "mes" | "trimestre" | "custom">("mes");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(true);

  // Datos
  const [dias, setDias] = useState<TarjetaDia[]>([]);
  const [agregados, setAgregados] = useState<Agregado[]>([]);
  const [patronDiaSemana, setPatronDiaSemana] = useState<PatronDiaSemana[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  // Expandir detalle por día
  const [expandido, setExpandido] = useState<string | null>(null);

  // Calcular rango según periodo
  const calcRango = useCallback((p: typeof periodo) => {
    const hoy = new Date();
    switch (p) {
      case "semana": return rangoSemana(hoy);
      case "mes": return rangoMes(hoy);
      case "trimestre": return rangoTrimestre(hoy);
      default: return { desde, hasta };
    }
  }, [desde, hasta]);

  // Cargar datos
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const rango = periodo === "custom" ? { desde, hasta } : calcRango(periodo);
      if (!rango.desde || !rango.hasta) { setLoading(false); return; }

      const base = `/api/tarjetas?desde=${rango.desde}&hasta=${rango.hasta}`;

      // Cargar stats siempre
      const statsRes = await fetch(`${base}&vista=stats`);
      if (statsRes.ok) setStats(await statsRes.json());

      // Cargar vista principal
      if (vista === "dia") {
        const res = await fetch(`${base}&vista=dia`);
        if (res.ok) setDias(await res.json());
      } else if (vista === "dia_semana") {
        const res = await fetch(`${base}&vista=dia_semana`);
        if (res.ok) setPatronDiaSemana(await res.json());
      } else {
        const res = await fetch(`${base}&vista=${vista}`);
        if (res.ok) setAgregados(await res.json());
      }
    } catch (e) {
      console.error("Error cargando tarjetas:", e);
    }
    setLoading(false);
  }, [vista, periodo, desde, hasta, calcRango]);

  // Init: rango mes actual
  useEffect(() => {
    const rango = rangoMes(new Date());
    setDesde(rango.desde);
    setHasta(rango.hasta);
  }, []);

  useEffect(() => {
    if (desde && hasta) cargar();
  }, [vista, periodo, cargar, desde, hasta]);

  // Barra de porcentaje para el patrón de día de semana
  const maxMediaDiaSemana = patronDiaSemana.length > 0
    ? Math.max(...patronDiaSemana.map((d) => d.media))
    : 1;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: COLOR.header }}>
            💳 Tarjetas por caja
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: COLOR.muted }}>
            Cobros con tarjeta extraídos del campo "Retirado" de los cierres Farmatic.
            Fecha real ajustada según hora de cierre.
          </p>
        </div>
      </div>

      {/* Controles */}
      <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        {/* Periodo */}
        <div style={{ display: "flex", gap: 4 }}>
          {(["semana", "mes", "trimestre", "custom"] as const).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriodo(p);
                if (p !== "custom") {
                  const r = calcRango(p);
                  setDesde(r.desde);
                  setHasta(r.hasta);
                }
              }}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: `1px solid ${periodo === p ? COLOR.primary : COLOR.border}`,
                background: periodo === p ? COLOR.primaryLight : COLOR.white,
                color: periodo === p ? COLOR.primary : COLOR.text,
                fontWeight: periodo === p ? 600 : 400,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {p === "custom" ? "Personalizado" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {/* Fechas custom */}
        {periodo === "custom" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
              style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${COLOR.border}`, fontSize: 13 }} />
            <span style={{ color: COLOR.muted }}>→</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
              style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${COLOR.border}`, fontSize: 13 }} />
          </div>
        )}

        {/* Separator */}
        <div style={{ borderLeft: `1px solid ${COLOR.border}`, height: 28, margin: "0 4px" }} />

        {/* Vista */}
        <div style={{ display: "flex", gap: 4 }}>
          {([
            { v: "dia", label: "Por día" },
            { v: "semana", label: "Semanal" },
            { v: "mes", label: "Mensual" },
            { v: "dia_semana", label: "Patrón semanal" },
          ] as const).map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setVista(v as Vista)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: `1px solid ${vista === v ? COLOR.accent : COLOR.border}`,
                background: vista === v ? COLOR.primaryLight : COLOR.white,
                color: vista === v ? COLOR.accent : COLOR.text,
                fontWeight: vista === v ? 600 : 400,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Info periodo */}
        <span style={{ marginLeft: "auto", fontSize: 12, color: COLOR.muted }}>
          {fmtFecha(desde)} — {fmtFecha(hasta)}
        </span>
      </div>

      {/* Stats cards */}
      {stats && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={statCard}>
            <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 4 }}>Total tarjetas</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLOR.primary }}>
              {fmt(stats.total_periodo)} €
            </div>
          </div>
          <div style={statCard}>
            <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 4 }}>Media diaria</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLOR.text }}>
              {fmt(stats.media_diaria)} €
            </div>
          </div>
          <div style={statCard}>
            <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 4 }}>Mejor día</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: COLOR.green }}>
              {stats.mejor_dia ? `${fmt(stats.mejor_dia.total)} €` : "—"}
            </div>
            <div style={{ fontSize: 11, color: COLOR.muted }}>
              {stats.mejor_dia ? fmtFecha(stats.mejor_dia.fecha) : ""}
            </div>
          </div>
          <div style={statCard}>
            <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 4 }}>Peor día</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-reig-danger)" }}>
              {stats.peor_dia ? `${fmt(stats.peor_dia.total)} €` : "—"}
            </div>
            <div style={{ fontSize: 11, color: COLOR.muted }}>
              {stats.peor_dia ? fmtFecha(stats.peor_dia.fecha) : ""}
            </div>
          </div>
          <div style={statCard}>
            <div style={{ fontSize: 12, color: COLOR.muted, marginBottom: 4 }}>Días con datos</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLOR.text }}>
              {stats.dias_con_datos}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: COLOR.muted }}>
          Cargando datos de tarjetas...
        </div>
      )}

      {/* ── Vista: Por día ── */}
      {!loading && vista === "dia" && (
        <div style={card}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, color: COLOR.header }}>
            Detalle por día
          </h2>
          {dias.length === 0 ? (
            <p style={{ color: COLOR.muted, textAlign: "center", padding: 20 }}>
              Sin datos de tarjetas en este periodo
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${COLOR.border}` }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: COLOR.muted }}>Fecha</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: COLOR.muted }}>Total</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", color: COLOR.muted }}>Cajas</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", color: COLOR.muted }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {dias.map((d) => (
                  <>
                    <tr
                      key={d.fecha}
                      style={{
                        borderBottom: `1px solid ${COLOR.border}`,
                        cursor: "pointer",
                        background: expandido === d.fecha ? COLOR.primaryLight : undefined,
                      }}
                      onClick={() => setExpandido(expandido === d.fecha ? null : d.fecha)}
                    >
                      <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                        {fmtFecha(d.fecha)}
                        <span style={{ fontSize: 11, color: COLOR.muted, marginLeft: 6 }}>
                          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][new Date(d.fecha + "T12:00").getDay()]}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: COLOR.primary, fontSize: 15 }}>
                        {fmt(d.total)} €
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", color: COLOR.muted }}>
                        {d.num_cajas}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span style={{ fontSize: 11, color: COLOR.primary }}>
                          {expandido === d.fecha ? "▲ cerrar" : "▼ ver cajas"}
                        </span>
                      </td>
                    </tr>
                    {expandido === d.fecha && (
                      <tr key={`${d.fecha}-detail`}>
                        <td colSpan={4} style={{ padding: "0 12px 12px", background: COLOR.primaryLight }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 8 }}>
                            {d.por_caja.map((c) => (
                              <div
                                key={c.caja}
                                style={{
                                  background: COLOR.white,
                                  border: `1px solid ${COLOR.border}`,
                                  borderRadius: 6,
                                  padding: "6px 12px",
                                  fontSize: 12,
                                  minWidth: 100,
                                }}
                              >
                                <div style={{ color: COLOR.muted, fontSize: 11 }}>{c.label}</div>
                                <div style={{ fontWeight: 600, color: COLOR.primary }}>
                                  {fmt(c.importe)} €
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Vista: Semanal / Mensual ── */}
      {!loading && (vista === "semana" || vista === "mes") && (
        <div style={card}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, color: COLOR.header }}>
            {vista === "semana" ? "Agregado semanal" : "Agregado mensual"}
          </h2>
          {agregados.length === 0 ? (
            <p style={{ color: COLOR.muted, textAlign: "center", padding: 20 }}>
              Sin datos en este periodo
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${COLOR.border}` }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: COLOR.muted }}>Periodo</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: COLOR.muted }}>Total</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: COLOR.muted }}>Media/día</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: COLOR.muted }}>Mín/día</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: COLOR.muted }}>Máx/día</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", color: COLOR.muted }}>Días</th>
                </tr>
              </thead>
              <tbody>
                {agregados.map((a) => (
                  <tr key={a.clave} style={{ borderBottom: `1px solid ${COLOR.border}` }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{a.clave}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: COLOR.primary }}>
                      {fmt(a.total)} €
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>{fmt(a.media)} €</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--color-reig-danger)" }}>{fmt(a.min)} €</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: COLOR.green }}>{fmt(a.max)} €</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", color: COLOR.muted }}>{a.dias}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Vista: Patrón día de semana ── */}
      {!loading && vista === "dia_semana" && (
        <div style={card}>
          <h2 style={{ margin: "0 0 4px", fontSize: 16, color: COLOR.header }}>
            Patrón por día de la semana
          </h2>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: COLOR.muted }}>
            Media de cobros con tarjeta según el día — detecta patrones de consumo
          </p>
          {patronDiaSemana.length === 0 ? (
            <p style={{ color: COLOR.muted, textAlign: "center", padding: 20 }}>
              Sin datos suficientes
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {patronDiaSemana.map((d) => {
                const pct = maxMediaDiaSemana > 0 ? (d.media / maxMediaDiaSemana) * 100 : 0;
                return (
                  <div key={d.dia_semana} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 90, fontWeight: 500, fontSize: 14, color: COLOR.text }}>
                      {d.dia_nombre}
                    </div>
                    <div style={{ flex: 1, background: "var(--color-reig-bg)", borderRadius: 6, height: 32, position: "relative", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: `linear-gradient(90deg, ${COLOR.primaryLight}, ${COLOR.primary})`,
                          borderRadius: 6,
                          transition: "width 0.5s ease",
                        }}
                      />
                      <span style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 13,
                        fontWeight: 600,
                        color: pct > 70 ? COLOR.white : COLOR.primary,
                      }}>
                        {fmt(d.media)} €
                      </span>
                    </div>
                    <div style={{ width: 60, textAlign: "right", fontSize: 11, color: COLOR.muted }}>
                      {d.dias} días
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tabla resumen debajo */}
          {patronDiaSemana.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 20 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${COLOR.border}` }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: COLOR.muted }}>Día</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: COLOR.muted }}>Total</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: COLOR.muted }}>Media</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: COLOR.muted }}>Mín</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: COLOR.muted }}>Máx</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", color: COLOR.muted }}>Muestras</th>
                </tr>
              </thead>
              <tbody>
                {patronDiaSemana.map((d) => (
                  <tr key={d.dia_semana} style={{ borderBottom: `1px solid ${COLOR.border}` }}>
                    <td style={{ padding: "6px 8px", fontWeight: 500 }}>{d.dia_nombre}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: COLOR.primary }}>{fmt(d.total)} €</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(d.media)} €</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--color-reig-danger)" }}>{fmt(d.min)} €</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: COLOR.green }}>{fmt(d.max)} €</td>
                    <td style={{ padding: "6px 8px", textAlign: "center", color: COLOR.muted }}>{d.dias}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Desglose por caja ── */}
      {!loading && stats && stats.total_por_caja.length > 0 && (
        <div style={card}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, color: COLOR.header }}>
            Desglose por caja
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {stats.total_por_caja.map((c) => {
              const pct = stats.total_periodo > 0 ? (c.total / stats.total_periodo) * 100 : 0;
              return (
                <div
                  key={c.caja}
                  style={{
                    background: COLOR.white,
                    border: `1px solid ${COLOR.border}`,
                    borderRadius: 8,
                    padding: "12px 16px",
                    minWidth: 130,
                    flex: 1,
                  }}
                >
                  <div style={{ fontSize: 11, color: COLOR.muted, marginBottom: 2 }}>{c.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLOR.primary }}>
                    {fmt(c.total)} €
                  </div>
                  <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 2 }}>
                    Media: {fmt(c.media)} €/día · {pct.toFixed(1)}%
                  </div>
                  <div style={{
                    marginTop: 6,
                    height: 4,
                    background: "var(--color-reig-bg)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: COLOR.primary,
                      borderRadius: 2,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Nota sobre lógica de fechas */}
      <div style={{ fontSize: 11, color: COLOR.muted, textAlign: "center", marginTop: 8 }}>
        Fecha real de cobro: si cierre antes de 14:00 → día anterior · si cierre ≥ 14:00 → mismo día
        <br />
        Datos: campo "Retirado" de emails Farmatic · Ingesta automática · Cowork · L-S ~8:30h
      </div>
    </div>
  );
}
