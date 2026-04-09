"use client";

import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
   Descuadres de Caja — Panel completo
   Vista: día · semana · mes | Análisis por caja, día de semana,
   semana del mes | Estadísticas y detección de patrones
   ═══════════════════════════════════════════════════════════ */

/* ───── Tipos ───── */

interface CierreRow {
  id: number;
  fecha_cierre: string;
  hora_cierre: string;
  caja: number;
  saldo: number;
  tarjetas_dia_anterior: number;
  descuadre: number;
  importe_apertura: number;
}

interface Agregado {
  clave: string;
  descuadre_neto: number;
  descuadre_bruto: number;
  dias: number;
  cierres: number;
}

interface Stats {
  total_neto: number;
  total_bruto: number;
  total_tarjetas: number;
  total_saldo: number;
  dias: number;
  cierres: number;
  peor_caja: string | null;
  peor_caja_neto: number;
  peor_dia: string | null;
  peor_dia_neto: number;
  media_diaria_neto: number;
  media_diaria_bruto: number;
}

type Vista = "dia" | "semana" | "mes";
type Analisis = "caja" | "dia_semana" | "semana_mes";

/* ───── Helpers ───── */

const fmt = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtFecha = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const CAJA_LABEL: Record<number, string> = {
  0: "Caja 0 (Cambio)", 1: "Caja 1", 2: "Caja 2", 3: "Caja 3",
  4: "Caja 4", 5: "Caja 5", 6: "Caja 6", 7: "Caja 7",
  8: "Caja 8", 9: "Caja 9", 11: "Caja 11 (Ortopedia)",
  12: "Caja 12 (Óptica)",
};

/** Devuelve lunes de la semana ISO */
function lunesDeSemana(fecha: Date): string {
  const d = new Date(fecha);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

/** Rango del mes */
function rangoMes(fecha: Date): { desde: string; hasta: string } {
  const y = fecha.getFullYear();
  const m = fecha.getMonth();
  const desde = new Date(y, m, 1).toISOString().slice(0, 10);
  const hasta = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { desde, hasta };
}

/** Rango de la semana (L-D) */
function rangoSemana(fecha: Date): { desde: string; hasta: string } {
  const desde = lunesDeSemana(fecha);
  const d = new Date(desde);
  d.setDate(d.getDate() + 6);
  return { desde, hasta: d.toISOString().slice(0, 10) };
}

/** Color del descuadre — positivo=falta=rojo, negativo=sobra=verde, 0=neutro */
function colorDescuadre(val: number): string {
  if (Math.abs(val) < 0.005) return "#666";
  return val > 0 ? "#c62828" : "#2e7d32";
}

/** Fondo del semáforo para la tabla de cierres */
function bgDescuadre(val: number): string {
  const abs = Math.abs(val);
  if (abs < 0.005) return "#f0f7f0";   // verde claro — cuadra
  if (abs <= 1) return "#fff8e1";       // amarillo — leve
  if (abs <= 5) return "#fff3e0";       // naranja — moderado
  return "#ffebee";                     // rojo — grave
}

/* ───── Estilos ───── */

const COLOR = {
  primary: "#1B5E20",
  primaryLight: "#e8f5e9",
  header: "#2a2e2b",
  text: "#333",
  muted: "#666",
  border: "#e0e0e0",
  bg: "#fafafa",
  white: "#fff",
  red: "#c62828",
  green: "#2e7d32",
  blue: "#1565C0",
  optica: "#1565C0",
};

const card: React.CSSProperties = {
  background: COLOR.white,
  borderRadius: 12,
  border: `1px solid ${COLOR.border}`,
  padding: 20,
  marginBottom: 16,
};

const btn = (active: boolean): React.CSSProperties => ({
  padding: "6px 16px",
  borderRadius: 8,
  border: `1px solid ${active ? COLOR.primary : COLOR.border}`,
  background: active ? COLOR.primary : COLOR.white,
  color: active ? COLOR.white : COLOR.text,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  transition: "all 0.15s",
});

const btnSmall: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 6,
  border: `1px solid ${COLOR.border}`,
  background: COLOR.white,
  cursor: "pointer",
  fontSize: 12,
};

/* ═══════════════════════════════════════════════════════════
   Componente principal
   ═══════════════════════════════════════════════════════════ */

export default function DescuadresPage() {
  // ── Estado ──
  const [vista, setVista] = useState<Vista>("dia");
  const [analisis, setAnalisis] = useState<Analisis>("caja");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [cierres, setCierres] = useState<CierreRow[]>([]);
  const [agregados, setAgregados] = useState<Agregado[]>([]);
  const [analisisData, setAnalisisData] = useState<Agregado[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // ── Cambiar caja de un cierre ──
  const cambiarCaja = async (id: number, nuevaCaja: number) => {
    try {
      const res = await fetch("/api/descuadres", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, caja: nuevaCaja }),
      });
      if (res.ok) {
        setCierres((prev) =>
          prev.map((c) => (c.id === id ? { ...c, caja: nuevaCaja } : c))
        );
        setEditingId(null);
      }
    } catch (e) {
      console.error("Error cambiando caja:", e);
    }
  };

  // ── Rango según vista ──
  const getRango = useCallback(() => {
    const d = new Date(fecha + "T12:00:00");
    switch (vista) {
      case "dia":
        return { desde: fecha, hasta: fecha };
      case "semana":
        return rangoSemana(d);
      case "mes":
        return rangoMes(d);
    }
  }, [vista, fecha]);

  // ── Cargar datos ──
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { desde, hasta } = getRango();

      if (vista === "dia") {
        // Vista día: cierres individuales
        const res = await fetch(`/api/descuadres?vista=dia&fecha=${fecha}`);
        const data = await res.json();
        setCierres(data.cierres || []);
      } else {
        // Vista semana/mes: agregados por día
        const res = await fetch(`/api/descuadres?vista=agregado&tipo=dia&desde=${desde}&hasta=${hasta}`);
        const data = await res.json();
        setAgregados(data.data || []);
      }

      // Siempre cargar stats del rango
      const resStats = await fetch(`/api/descuadres?vista=stats&desde=${desde}&hasta=${hasta}`);
      const statsData = await resStats.json();
      setStats(statsData.stats || null);

      // Cargar análisis
      const resAnalisis = await fetch(`/api/descuadres?vista=agregado&tipo=${analisis}&desde=${desde}&hasta=${hasta}`);
      const analisisJson = await resAnalisis.json();
      setAnalisisData(analisisJson.data || []);
    } catch (e) {
      console.error("Error cargando descuadres:", e);
    }
    setLoading(false);
  }, [vista, fecha, analisis, getRango]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Navegación temporal ──
  const navegar = (dir: -1 | 1) => {
    const d = new Date(fecha + "T12:00:00");
    switch (vista) {
      case "dia":    d.setDate(d.getDate() + dir); break;
      case "semana": d.setDate(d.getDate() + dir * 7); break;
      case "mes":    d.setMonth(d.getMonth() + dir); break;
    }
    setFecha(d.toISOString().slice(0, 10));
  };

  // ── Título del periodo ──
  const tituloPeriodo = () => {
    const d = new Date(fecha + "T12:00:00");
    switch (vista) {
      case "dia":
        return fmtFecha(fecha);
      case "semana": {
        const { desde, hasta } = rangoSemana(d);
        return `${fmtFecha(desde)} — ${fmtFecha(hasta)}`;
      }
      case "mes": {
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        return `${meses[d.getMonth()]} ${d.getFullYear()}`;
      }
    }
  };

  // ── Máximo valor absoluto para barras ──
  const maxBruto = Math.max(
    ...analisisData.map((a) => Math.abs(a.descuadre_neto)),
    0.01
  );

  // ── Totales del día ──
  const totalDia = cierres.reduce((sum, c) => sum + c.descuadre, 0);
  const totalTarjetasDia = cierres.reduce((sum, c) => sum + c.tarjetas_dia_anterior, 0);
  const totalSaldoDia = cierres.reduce((sum, c) => sum + c.saldo, 0);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* ═══ HEADER ═══ */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", color: COLOR.header, fontSize: 26, margin: 0 }}>
          Descuadres de Caja
        </h1>
        <p style={{ color: COLOR.muted, fontSize: 13, marginTop: 4 }}>
          Seguimiento diario del cierre de cajas · Descuadre positivo = falta · Negativo = sobra
        </p>
      </div>

      {/* ═══ CONTROLES ═══ */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {/* Selector de vista */}
        <div style={{ display: "flex", gap: 4 }}>
          {(["dia", "semana", "mes"] as Vista[]).map((v) => (
            <button key={v} style={btn(vista === v)} onClick={() => setVista(v)}>
              {v === "dia" ? "Día" : v === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>

        {/* Navegación */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button style={btnSmall} onClick={() => navegar(-1)}>◀</button>
          <span style={{ fontWeight: 600, fontSize: 14, minWidth: 180, textAlign: "center" }}>
            {tituloPeriodo()}
          </span>
          <button style={btnSmall} onClick={() => navegar(1)}>▶</button>
        </div>

        {/* Hoy */}
        <button
          style={btnSmall}
          onClick={() => setFecha(new Date().toISOString().slice(0, 10))}
        >
          Hoy
        </button>

        {/* Selector fecha */}
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          style={{ border: `1px solid ${COLOR.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 13 }}
        />

        {/* Info ingesta */}
        <span style={{ marginLeft: "auto", fontSize: 11, color: COLOR.muted }}>
          Ingesta automática · Cowork · L-S ~8:30h
        </span>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: COLOR.muted }}>Cargando…</div>
      )}

      {!loading && (
        <>
          {/* ═══ TARJETAS RESUMEN ═══ */}
          {stats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
              <div style={card}>
                <div style={{ fontSize: 11, color: COLOR.muted, textTransform: "uppercase", letterSpacing: 1 }}>
                  Descuadre neto
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: colorDescuadre(stats.total_neto), marginTop: 4 }}>
                  {stats.total_neto > 0 ? "+" : ""}{fmt(stats.total_neto)} €
                </div>
                <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 2 }}>
                  {stats.total_neto > 0 ? "Falta" : stats.total_neto < 0 ? "Sobra" : "Cuadra"} en el periodo
                </div>
              </div>

              <div style={card}>
                <div style={{ fontSize: 11, color: COLOR.muted, textTransform: "uppercase", letterSpacing: 1 }}>
                  Descuadre bruto
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: COLOR.text, marginTop: 4 }}>
                  {fmt(stats.total_bruto)} €
                </div>
                <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 2 }}>
                  Movimiento total (sin compensar)
                </div>
              </div>

              <div style={card}>
                <div style={{ fontSize: 11, color: COLOR.muted, textTransform: "uppercase", letterSpacing: 1 }}>
                  Media diaria
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: colorDescuadre(stats.media_diaria_neto), marginTop: 4 }}>
                  {stats.media_diaria_neto > 0 ? "+" : ""}{fmt(stats.media_diaria_neto)} €
                </div>
                <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 2 }}>
                  Neto · {fmt(stats.media_diaria_bruto)} € bruto
                </div>
              </div>

              <div style={card}>
                <div style={{ fontSize: 11, color: COLOR.muted, textTransform: "uppercase", letterSpacing: 1 }}>
                  Tarjetas / Retirado
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: COLOR.blue, marginTop: 4 }}>
                  {fmt(stats.total_tarjetas)} €
                </div>
                <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 2 }}>
                  Tarjetas del día anterior ({stats.cierres} cierres)
                </div>
              </div>

              <div style={card}>
                <div style={{ fontSize: 11, color: COLOR.muted, textTransform: "uppercase", letterSpacing: 1 }}>
                  Peor caja
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLOR.red, marginTop: 8 }}>
                  {stats.peor_caja || "—"}
                </div>
                <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 2 }}>
                  {stats.peor_caja_neto > 0 ? "+" : ""}{fmt(stats.peor_caja_neto)} € acumulado
                </div>
              </div>
            </div>
          )}

          {/* ═══ VISTA DÍA: tabla de cierres ═══ */}
          {vista === "dia" && (
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 16, color: COLOR.header }}>
                  Cierres del {fmtFecha(fecha)}
                </h2>
                <div style={{
                  fontSize: 14, fontWeight: 700,
                  color: colorDescuadre(totalDia),
                  background: bgDescuadre(totalDia),
                  padding: "4px 12px", borderRadius: 8,
                }}>
                  Total: {totalDia > 0 ? "+" : ""}{fmt(totalDia)} €
                </div>
              </div>

              {cierres.length === 0 ? (
                <p style={{ color: COLOR.muted, textAlign: "center", padding: 20 }}>
                  Sin datos para este día
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${COLOR.border}` }}>
                        <th style={{ textAlign: "left", padding: "8px 12px", color: COLOR.muted, fontWeight: 600 }}>Caja</th>
                        <th style={{ textAlign: "left", padding: "8px 12px", color: COLOR.muted, fontWeight: 600 }}>Hora</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", color: COLOR.muted, fontWeight: 600 }}>Apertura</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", color: COLOR.muted, fontWeight: 600 }}>Saldo</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", color: COLOR.muted, fontWeight: 600 }}>Tarjetas ant.</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", color: COLOR.muted, fontWeight: 600 }}>Descuadre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cierres.map((c) => (
                        <tr
                          key={c.id}
                          style={{
                            borderBottom: `1px solid ${COLOR.border}`,
                            background: bgDescuadre(c.descuadre),
                          }}
                        >
                          <td style={{
                            padding: "10px 12px", fontWeight: 600,
                            color: c.caja === 0 ? COLOR.primary : c.caja === 12 ? COLOR.optica : COLOR.text,
                          }}>
                            {editingId === c.id ? (
                              <select
                                value={c.caja}
                                onChange={(e) => cambiarCaja(c.id, Number(e.target.value))}
                                onBlur={() => setEditingId(null)}
                                autoFocus
                                style={{
                                  fontSize: 13, fontWeight: 600, padding: "2px 4px",
                                  borderRadius: 4, border: `1px solid ${COLOR.primary}`,
                                }}
                              >
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12].map((n) => (
                                  <option key={n} value={n}>
                                    {CAJA_LABEL[n]}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                onClick={() => setEditingId(c.id)}
                                style={{ cursor: "pointer" }}
                                title="Click para cambiar caja"
                              >
                                {CAJA_LABEL[c.caja] || `Caja ${c.caja}`} ✎
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px" }}>{c.hora_cierre}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>{fmt(c.importe_apertura)} €</td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>{fmt(c.saldo)} €</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: COLOR.blue }}>
                            {fmt(c.tarjetas_dia_anterior)} €
                          </td>
                          <td style={{
                            padding: "10px 12px", textAlign: "right",
                            fontWeight: 700, color: colorDescuadre(c.descuadre),
                          }}>
                            {c.descuadre > 0 ? "+" : ""}{fmt(c.descuadre)} €
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {cierres.length > 1 && (
                      <tfoot>
                        <tr style={{ borderTop: `2px solid ${COLOR.primary}`, background: COLOR.primaryLight }}>
                          <td style={{ padding: "10px 12px", fontWeight: 700, color: COLOR.primary }} colSpan={2}>
                            TOTALES ({cierres.length} cajas)
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>—</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                            {fmt(totalSaldoDia)} €
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: COLOR.blue }}>
                            {fmt(totalTarjetasDia)} €
                          </td>
                          <td style={{
                            padding: "10px 12px", textAlign: "right",
                            fontWeight: 700, color: colorDescuadre(totalDia),
                          }}>
                            {totalDia > 0 ? "+" : ""}{fmt(totalDia)} €
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══ VISTA SEMANA/MES: agregados por día ═══ */}
          {(vista === "semana" || vista === "mes") && (
            <div style={card}>
              <h2 style={{ margin: "0 0 16px", fontSize: 16, color: COLOR.header }}>
                Descuadre por día
              </h2>
              {agregados.length === 0 ? (
                <p style={{ color: COLOR.muted, textAlign: "center", padding: 20 }}>
                  Sin datos para este periodo
                </p>
              ) : (
                <>
                  {/* Mini barras horizontales */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {agregados.map((a) => {
                      const maxVal = Math.max(...agregados.map((x) => Math.abs(x.descuadre_neto)), 0.01);
                      const pct = Math.min(Math.abs(a.descuadre_neto) / maxVal * 100, 100);
                      const esPositivo = a.descuadre_neto > 0;
                      return (
                        <div key={a.clave} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 80, fontSize: 12, color: COLOR.muted, textAlign: "right", flexShrink: 0 }}>
                            {fmtFecha(a.clave)}
                          </span>
                          <div style={{ flex: 1, height: 22, background: "#f5f5f5", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                            <div style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: esPositivo ? "#ef9a9a" : "#a5d6a7",
                              borderRadius: 4,
                              transition: "width 0.3s",
                            }} />
                          </div>
                          <span style={{
                            width: 80, fontSize: 12, fontWeight: 600,
                            color: colorDescuadre(a.descuadre_neto), textAlign: "right", flexShrink: 0,
                          }}>
                            {a.descuadre_neto > 0 ? "+" : ""}{fmt(a.descuadre_neto)} €
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tabla resumen debajo */}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 16 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${COLOR.border}` }}>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: COLOR.muted }}>Fecha</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", color: COLOR.muted }}>Neto</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", color: COLOR.muted }}>Bruto</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", color: COLOR.muted }}>Cajas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agregados.map((a) => (
                        <tr key={a.clave} style={{ borderBottom: `1px solid ${COLOR.border}`, background: bgDescuadre(a.descuadre_neto) }}>
                          <td style={{ padding: "6px 8px" }}>{fmtFecha(a.clave)}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: colorDescuadre(a.descuadre_neto) }}>
                            {a.descuadre_neto > 0 ? "+" : ""}{fmt(a.descuadre_neto)} €
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(a.descuadre_bruto)} €</td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>{a.cierres}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {/* ═══ PANEL DE ANÁLISIS ═══ */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, color: COLOR.header }}>
                Análisis de patrones
              </h2>
              <div style={{ display: "flex", gap: 4 }}>
                {([
                  ["caja", "Por caja"],
                  ["dia_semana", "Por día de semana"],
                  ["semana_mes", "Por semana del mes"],
                ] as [Analisis, string][]).map(([key, label]) => (
                  <button key={key} style={btn(analisis === key)} onClick={() => setAnalisis(key)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {analisisData.length === 0 ? (
              <p style={{ color: COLOR.muted, textAlign: "center", padding: 20 }}>
                Sin datos para este periodo
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {analisisData.map((a) => {
                  const pct = Math.min(Math.abs(a.descuadre_neto) / maxBruto * 100, 100);
                  const esPositivo = a.descuadre_neto > 0;
                  return (
                    <div key={a.clave} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{
                        width: 160, fontSize: 13, fontWeight: 500, color: COLOR.text,
                        textAlign: "right", flexShrink: 0,
                      }}>
                        {a.clave}
                      </span>

                      {/* Barra */}
                      <div style={{
                        flex: 1, height: 28, background: "#f5f5f5",
                        borderRadius: 6, position: "relative", overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: esPositivo
                            ? "linear-gradient(90deg, #ef9a9a, #e57373)"
                            : "linear-gradient(90deg, #a5d6a7, #81c784)",
                          borderRadius: 6,
                          transition: "width 0.3s",
                        }} />
                      </div>

                      {/* Valores */}
                      <div style={{ width: 160, textAlign: "right", flexShrink: 0 }}>
                        <span style={{
                          fontSize: 14, fontWeight: 700,
                          color: colorDescuadre(a.descuadre_neto),
                        }}>
                          {a.descuadre_neto > 0 ? "+" : ""}{fmt(a.descuadre_neto)} €
                        </span>
                        <span style={{ fontSize: 11, color: COLOR.muted, marginLeft: 8 }}>
                          ({a.dias}d, bruto {fmt(a.descuadre_bruto)} €)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
