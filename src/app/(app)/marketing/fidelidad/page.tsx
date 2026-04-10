"use client";

/**
 * Marketing → Fidelidad crónicos — Dashboard interactivo
 *
 * Análisis de fidelidad de pacientes crónicos de Farmacia Reig basado en
 * la fecha de próxima dispensación (fecha_prox_disp) del SNS. Mide si los
 * pacientes vuelven a renovar sus tratamientos crónicos en nuestra farmacia.
 *
 * Datos calculados con script offline contra reig.db, agregados y
 * k-anonimizados en src/data/marketing/fidelidad/latest.json.
 * La página NO consulta BD.
 *
 * Regeneración:
 *   python scripts/generar_fidelidad.py
 *   (escribe latest.json + 2026-MM.json + HTML standalone + historial)
 *
 * Excluidos del análisis:
 *   - IBP crónico (regulatorio — Dirección de Farmacia ya no permite)
 *   - GLP-1 social: Ozempic/Semaglutida, Victoza/Liraglutida (uso social
 *     no financiado ni crónico)
 */

import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LabelList, LineChart, Line,
  Area, AreaChart,
} from "recharts";
import data from "@/data/marketing/fidelidad/latest.json";

/* ── Colores Reig ── */
const VERDE = "var(--color-reig-green)";
const VERDE_OSC = "var(--color-reig-green-dark)";
const VERDE_MED = "var(--color-reig-green-mid)";
const VERDE_CLARO = "var(--color-reig-green-light)";
const GRIS = "#78909c";
const GRIS_CL = "#bdbdbd";
const TXT = "var(--color-reig-text)";
const TXT2 = "var(--color-reig-text-secondary)";

/* Paleta verde degradada (6 tonos) */
const GREEN_SCALE = ["#0d5c20", "#14702e", "#1a8c3a", "#4caf50", "#81c784", "#a5d6a7"];
/* Paleta para estados: fiel, en_riesgo, infiel_activo, perdido, nuevo */
const STATUS_COLORS = ["#14702e", "#4caf50", "#78909c", "#bdbdbd", "#e0e0e0"];
const STATUS_LABELS = ["Fiel", "En riesgo", "Infiel activo", "Perdido", "Nuevo"];

const fmt = (n: number) => n.toLocaleString("es-ES");
const fmtE = (n: number) => fmt(Math.round(n)) + " €";
const fmtPct = (n: number) => n.toFixed(1) + "%";

type TabKey = "general" | "familias" | "socio" | "polimedicacion" | "perdidos";

export default function FidelidadPage() {
  const [tab, setTab] = useState<TabKey>("general");

  const kpis = data.kpis;
  const familyEntries = useMemo(
    () => Object.entries(data.family_stats).sort((a, b) => b[1].total - a[1].total),
    []
  );

  /* ── Chart data transforms ── */
  const familyChartData = useMemo(
    () => familyEntries.map(([name, s]) => ({
      name, fiel: s.fiel, en_riesgo: s.en_riesgo, infiel_activo: s.infiel_activo,
      perdido: s.perdido, nuevo: s.nuevo, total: s.total,
      tasa: s.avg_renewal, pvp_perdido: s.pvp_perdido,
    })),
    [familyEntries]
  );

  const patientClassData = useMemo(() => [
    { name: "Fiel 100%", value: data.patient_class.fiel || 0, color: STATUS_COLORS[0] },
    { name: "En riesgo", value: data.patient_class.en_riesgo || 0, color: STATUS_COLORS[1] },
    { name: "Parcial perdido", value: data.patient_class.parcial_perdido || 0, color: STATUS_COLORS[2] },
    { name: "Perdido total", value: data.patient_class.perdido_total || 0, color: STATUS_COLORS[3] },
  ], []);

  const evolutionData = useMemo(
    () => data.monthly_evolution.filter((m: { n: number }) => m.n >= 10),
    []
  );

  const socioData = data.socioeconomic?.segments || [];
  const polyData = data.polypharmacy?.groups || [];

  const topDrugs = data.top_drugs_by_loss || [];

  const tabs: { key: TabKey; label: string }[] = [
    { key: "general", label: "Visión general" },
    { key: "familias", label: "Por familia" },
    { key: "socio", label: "Socioeconómico" },
    { key: "polimedicacion", label: "Polimedicación" },
    { key: "perdidos", label: "Perdidos" },
  ];

  return (
    <div className="max-w-6xl space-y-6">

      {/* ── HEADER ── */}
      <div>
        <h1 className="section-title" style={{ fontSize: 22, marginBottom: 2 }}>
          Fidelidad de pacientes crónicos
        </h1>
        <p className="text-sm" style={{ color: TXT2 }}>
          {data.meta.chronic_families} familias terapéuticas · Datos {data.meta.data_range_start?.slice(0, 7)} → {data.meta.data_range_end?.slice(0, 7)} · Generado {data.meta.generated}
        </p>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <KPI label="Pacientes crónicos" value={fmt(kpis.pacientes_cronicos)} sub="con ≥1 dispensación evaluable" />
        <KPI label="PVP total evaluable" value={fmtE(kpis.pvp_total_evaluable || 0)} sub="suma dispensaciones crónicas" />
        <KPI label="PVP renovado" value={fmtE(kpis.pvp_renovado || 0)} sub={`${kpis.pct_renovado || 0}% — lo que retenemos`} />
        <KPI label="PVP no renovado" value={fmtE(kpis.pvp_no_renovado || 0)} sub={`${kpis.pct_no_renovado || 0}% — lo que se escapa`} />
        <KPI label="Tasa renovación" value={fmtPct(kpis.tasa_fidelidad_global)} sub="global todas las familias" />
      </div>

      {/* ── TABS ── */}
      <div className="tab-nav">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? "tab-active" : ""}`}
            onClick={() => setTab(t.key)}
            style={{
              padding: "6px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600,
              border: "1px solid var(--color-reig-border)",
              background: tab === t.key ? "var(--color-reig-green)" : "var(--color-reig-surface)",
              color: tab === t.key ? "#fff" : TXT2,
              cursor: "pointer", marginRight: 6,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: GENERAL ── */}
      {tab === "general" && (
        <div className="space-y-4">
          {/* Classification donut + summary */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-bold mb-4" style={{ color: TXT }}>Clasificación de pacientes</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={patientClassData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {patientClassData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v)) + " pacientes"} />
                  <Legend verticalAlign="bottom" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3 className="text-sm font-bold mb-4" style={{ color: TXT }}>Resumen numérico</h3>
              <div className="space-y-2">
                {patientClassData.map((d) => {
                  const total = patientClassData.reduce((a, b) => a + b.value, 0);
                  return (
                    <div key={d.name} className="flex items-center justify-between py-2 px-3 rounded-lg"
                      style={{ borderLeft: `4px solid ${d.color}`, background: "var(--color-reig-bg)" }}>
                      <span className="text-sm font-semibold" style={{ color: d.color }}>{d.name}</span>
                      <span className="font-mono-metric text-sm font-bold" style={{ color: d.color }}>
                        {fmt(d.value)} <span className="text-xs font-normal">{fmtPct(d.value / total * 100)}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Evolution chart */}
          <div className="card">
            <h3 className="text-sm font-bold mb-4" style={{ color: TXT }}>Evolución intra-periodo (tasa renovación mensual)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-reig-border-light)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => v + "%"} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtPct(Number(v))} labelFormatter={(l) => `Mes: ${l}`} />
                <Area type="monotone" dataKey="rate" stroke="#1a8c3a" fill="#e8f5ec" strokeWidth={2} name="Tasa renovación" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Impacto económico */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <KPI label="PVP renovado / mes" value={fmtE(kpis.pvp_renovado_mensual || 0)} sub="lo que retenemos" />
            <KPI label="PVP perdido / mes" value={fmtE(kpis.pvp_perdido_mensual)} sub="lo que se escapa" />
            <KPI label="Alertas activas" value={fmt(kpis.alertas_activas)} sub="renovación vencida" />
            <KPI label="Familias analizadas" value={fmt(data.meta.chronic_families)} sub="sin IBP ni GLP-1 social" />
          </div>
        </div>
      )}

      {/* ── TAB: FAMILIAS ── */}
      {tab === "familias" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-bold mb-4" style={{ color: TXT }}>Distribución por estado y familia</h3>
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={familyChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-reig-border-light)" />
                <XAxis type="number" tickFormatter={fmt} label={{ value: "Pares paciente-molécula", position: "insideBottom", offset: -5, style: { fontSize: 12, fontWeight: 600 } }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                <Tooltip />
                <Legend verticalAlign="top" iconType="circle" />
                <Bar dataKey="fiel" stackId="a" fill={STATUS_COLORS[0]} name="Fiel" />
                <Bar dataKey="en_riesgo" stackId="a" fill={STATUS_COLORS[1]} name="En riesgo" />
                <Bar dataKey="infiel_activo" stackId="a" fill={STATUS_COLORS[2]} name="Infiel activo" />
                <Bar dataKey="perdido" stackId="a" fill={STATUS_COLORS[3]} name="Perdido" />
                <Bar dataKey="nuevo" stackId="a" fill={STATUS_COLORS[4]} name="Nuevo" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Family table */}
          <div className="card">
            <h3 className="text-sm font-bold mb-4" style={{ color: TXT }}>Detalle por familia</h3>
            <table className="table-reig">
              <thead>
                <tr>
                  <th>Familia</th>
                  <th style={{ textAlign: "right" }}>Pares</th>
                  <th style={{ textAlign: "right" }}>Fieles</th>
                  <th style={{ textAlign: "right" }}>Riesgo</th>
                  <th style={{ textAlign: "right" }}>Perdidos</th>
                  <th style={{ textAlign: "right" }}>Tasa renov.</th>
                  <th style={{ textAlign: "right" }}>PVP perdido</th>
                </tr>
              </thead>
              <tbody>
                {familyEntries.map(([name, s]) => (
                  <tr key={name}>
                    <td className="font-semibold">{name}</td>
                    <td className="font-mono-metric" style={{ textAlign: "right" }}>{fmt(s.total)}</td>
                    <td className="font-mono-metric" style={{ textAlign: "right", color: "#14702e" }}>{fmt(s.fiel)}</td>
                    <td className="font-mono-metric" style={{ textAlign: "right", color: "#4caf50" }}>{fmt(s.en_riesgo)}</td>
                    <td className="font-mono-metric" style={{ textAlign: "right", color: GRIS }}>{fmt(s.perdido)}</td>
                    <td className="font-mono-metric font-bold" style={{ textAlign: "right" }}>{fmtPct(s.avg_renewal)}</td>
                    <td className="font-mono-metric" style={{ textAlign: "right" }}>{fmtE(s.pvp_perdido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top drugs by loss */}
          <div className="card">
            <h3 className="text-sm font-bold mb-4" style={{ color: TXT }}>Top 15 moléculas por PVP perdido</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topDrugs} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-reig-border-light)" />
                <XAxis type="number" tickFormatter={(v) => fmtE(v)} />
                <YAxis type="category" dataKey="drug" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(v) => fmtE(Number(v))} />
                <Bar dataKey="pvp_lost" fill={GRIS} radius={[0, 3, 3, 0]} name="PVP perdido" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── TAB: SOCIOECONÓMICO ── */}
      {tab === "socio" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <KPI label="Correlación copago↔fidelidad" value={`r = ${data.socioeconomic?.correlation > 0 ? "+" : ""}${data.socioeconomic?.correlation?.toFixed(2)}`} sub="Pearson: -1 negativa, 0 nula, +1 positiva" />
            <KPI label="Segmento más fiel" value={(() => { const s = [...socioData].sort((a, b) => b.tasa_fidelidad - a.tasa_fidelidad); return s[0]?.name + " (" + fmtPct(s[0]?.tasa_fidelidad) + ")"; })()} sub="" />
            <KPI label="Segmento menos fiel" value={(() => { const s = [...socioData].sort((a, b) => a.tasa_fidelidad - b.tasa_fidelidad); return s[0]?.name + " (" + fmtPct(s[0]?.tasa_fidelidad) + ")"; })()} sub="" />
          </div>

          <div className="card" style={{ padding: "12px 16px", background: "var(--color-reig-green-light)", borderLeft: "4px solid var(--color-reig-green-mid)" }}>
            <p className="text-sm" style={{ color: "var(--color-reig-green-dark)" }}>
              <strong>Conclusión:</strong>{" "}
              {data.socioeconomic?.conclusion === "weak"
                ? "La correlación entre copago y fidelidad es débil. El porcentaje que paga el paciente no parece influir significativamente en si vuelve a renovar su tratamiento crónico en nuestra farmacia."
                : data.socioeconomic?.conclusion === "negative"
                ? "Correlación negativa: a mayor copago, menor fidelidad."
                : "Correlación positiva: a mayor copago, mayor fidelidad."}
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-bold mb-4" style={{ color: TXT }}>Tasa de fidelidad por copago</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={socioData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-reig-border-light)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => v + "%"} />
                  <Tooltip formatter={(v) => fmtPct(Number(v))} />
                  <Bar dataKey="tasa_fidelidad" name="Tasa fidelidad" radius={[4, 4, 0, 0]}>
                    {socioData.map((_: unknown, i: number) => <Cell key={i} fill={GREEN_SCALE[i % GREEN_SCALE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3 className="text-sm font-bold mb-4" style={{ color: TXT }}>Distribución de pacientes por TA</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={socioData} dataKey="patients" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {socioData.map((_: unknown, i: number) => <Cell key={i} fill={GREEN_SCALE[i % GREEN_SCALE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v)) + " pacientes"} />
                  <Legend verticalAlign="bottom" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Socio table */}
          <div className="card">
            <h3 className="text-sm font-bold mb-4" style={{ color: TXT }}>Detalle por tipo de aportación</h3>
            <table className="table-reig">
              <thead>
                <tr>
                  <th>Segmento</th>
                  <th style={{ textAlign: "right" }}>Copago</th>
                  <th style={{ textAlign: "right" }}>Pacientes</th>
                  <th style={{ textAlign: "right" }}>Pares</th>
                  <th style={{ textAlign: "right" }}>Tasa fidelidad</th>
                  <th style={{ textAlign: "right" }}>PVP perdido</th>
                </tr>
              </thead>
              <tbody>
                {socioData.map((s: { name: string; code: string; copay: number; patients: number; pairs: number; tasa_fidelidad: number; pvp_perdido: number }) => (
                  <tr key={s.code}>
                    <td className="font-semibold">{s.code} — {s.name}</td>
                    <td className="font-mono-metric" style={{ textAlign: "right" }}>{s.copay}%</td>
                    <td className="font-mono-metric" style={{ textAlign: "right" }}>{fmt(s.patients)}</td>
                    <td className="font-mono-metric" style={{ textAlign: "right" }}>{fmt(s.pairs)}</td>
                    <td className="font-mono-metric font-bold" style={{ textAlign: "right" }}>{fmtPct(s.tasa_fidelidad)}</td>
                    <td className="font-mono-metric" style={{ textAlign: "right" }}>{fmtE(s.pvp_perdido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: POLIMEDICACIÓN ── */}
      {tab === "polimedicacion" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <KPI label="Correlación polimedicación↔fidelidad" value={`r = +${data.polypharmacy?.correlation?.toFixed(2)}`} sub="Pearson sobre 6 grupos" />
            <KPI label="Tasa con 1 tratamiento" value={fmtPct(polyData[0]?.tasa || 0)} sub={`${fmt(polyData[0]?.patients || 0)} pacientes`} />
            <KPI label="Tasa con 6+ tratamientos" value={fmtPct(polyData[polyData.length - 1]?.tasa || 0)} sub={`${fmt(polyData[polyData.length - 1]?.patients || 0)} pacientes`} />
          </div>

          <div className="card" style={{ padding: "12px 16px", background: "var(--color-reig-green-light)", borderLeft: "4px solid var(--color-reig-green-mid)" }}>
            <p className="text-sm" style={{ color: "var(--color-reig-green-dark)" }}>
              <strong>Conclusión:</strong> Correlación positiva clara (r = +{data.polypharmacy?.correlation?.toFixed(2)}). Los pacientes polimedicados son significativamente más fieles. El paciente con 1 solo tratamiento renueva el {fmtPct(polyData[0]?.tasa || 0)}, mientras que el de 6+ tratamientos supera el {fmtPct(polyData[polyData.length - 1]?.tasa || 0)}. Los pacientes con 1-2 tratamientos son los más vulnerables a irse a otra farmacia.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-bold mb-4" style={{ color: TXT }}>Tasa de renovación por nº tratamientos</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={polyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-reig-border-light)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => v + "%"} />
                  <Tooltip formatter={(v) => fmtPct(Number(v))} />
                  <Bar dataKey="tasa" name="Tasa renovación" radius={[4, 4, 0, 0]}>
                    {polyData.map((_: unknown, i: number) => <Cell key={i} fill={GREEN_SCALE[i % GREEN_SCALE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3 className="text-sm font-bold mb-4" style={{ color: TXT }}>Pacientes por grupo</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={polyData} dataKey="patients" nameKey="label" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {polyData.map((_: unknown, i: number) => <Cell key={i} fill={GREEN_SCALE[i % GREEN_SCALE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v)) + " pacientes"} />
                  <Legend verticalAlign="bottom" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Poly table */}
          <div className="card">
            <h3 className="text-sm font-bold mb-4" style={{ color: TXT }}>Detalle por grupo de polimedicación</h3>
            <table className="table-reig">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th style={{ textAlign: "right" }}>Pacientes</th>
                  <th style={{ textAlign: "right" }}>Pares</th>
                  <th style={{ textAlign: "right" }}>Evaluables</th>
                  <th style={{ textAlign: "right" }}>Renovadas</th>
                  <th style={{ textAlign: "right" }}>Tasa</th>
                  <th style={{ textAlign: "right" }}>PVP evaluable</th>
                  <th style={{ textAlign: "right" }}>PVP retenido</th>
                </tr>
              </thead>
              <tbody>
                {polyData.map((d: { label: string; patients: number; pairs: number; evaluable: number; renewed: number; tasa: number; pvp_evaluable: number; pvp_renovado: number }) => (
                  <tr key={d.label}>
                    <td className="font-semibold">{d.label}</td>
                    <td className="font-mono-metric" style={{ textAlign: "right" }}>{fmt(d.patients)}</td>
                    <td className="font-mono-metric" style={{ textAlign: "right" }}>{fmt(d.pairs)}</td>
                    <td className="font-mono-metric" style={{ textAlign: "right" }}>{fmt(d.evaluable)}</td>
                    <td className="font-mono-metric" style={{ textAlign: "right" }}>{fmt(d.renewed)}</td>
                    <td className="font-mono-metric font-bold" style={{ textAlign: "right" }}>{fmtPct(d.tasa)}</td>
                    <td className="font-mono-metric" style={{ textAlign: "right" }}>{fmtE(d.pvp_evaluable)}</td>
                    <td className="font-mono-metric" style={{ textAlign: "right" }}>{fmtE(d.pvp_renovado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: PERDIDOS ── */}
      {tab === "perdidos" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-bold mb-4" style={{ color: TXT }}>Perdidos por franja de edad</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={["0-14", "15-44", "45-64", "65-74", "75+"].map((a, i) => ({
                  age: a, count: (data.lost_demographics?.by_age as Record<string, number>)?.[a] || 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-reig-border-light)" />
                  <XAxis dataKey="age" />
                  <YAxis tickFormatter={fmt} />
                  <Tooltip formatter={(v) => fmt(Number(v)) + " pacientes"} />
                  <Bar dataKey="count" name="Pacientes perdidos" radius={[4, 4, 0, 0]}>
                    {[0, 1, 2, 3, 4].map((i) => <Cell key={i} fill={GREEN_SCALE[i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3 className="text-sm font-bold mb-4" style={{ color: TXT }}>Perdidos por sexo</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Mujeres", value: (data.lost_demographics?.by_sex as Record<string, number>)?.F || 0 },
                      { name: "Hombres", value: (data.lost_demographics?.by_sex as Record<string, number>)?.M || 0 },
                    ]}
                    dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={90}>
                    <Cell fill="#1a8c3a" />
                    <Cell fill="#a5d6a7" />
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v)) + " pacientes"} />
                  <Legend verticalAlign="bottom" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Alerts table */}
          {data.overdue_alerts && data.overdue_alerts.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-bold mb-4" style={{ color: TXT }}>Alertas accionables (renovación vencida)</h3>
              <p className="text-xs mb-3" style={{ color: TXT2 }}>
                Pacientes con dispensación programada vencida. Para identificarlos se necesita Farmatic (IDs anónimos).
              </p>
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table className="table-reig">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Edad</th>
                      <th>Sexo</th>
                      <th>Molécula</th>
                      <th>Familia</th>
                      <th>Última disp.</th>
                      <th>Prox. esperada</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.overdue_alerts.map((a: { pac_id: string; edad: number; sexo: string; drug: string; family: string; last_disp: string; last_prox: string; status: string; pvp: number }, i: number) => (
                      <tr key={i}>
                        <td className="font-mono-metric" style={{ fontSize: 12 }}>...{a.pac_id}</td>
                        <td className="font-mono-metric" style={{ textAlign: "right" }}>{a.edad || "—"}</td>
                        <td>{a.sexo || "—"}</td>
                        <td className="font-semibold">{a.drug}</td>
                        <td>{a.family}</td>
                        <td>{a.last_disp}</td>
                        <td>{a.last_prox}</td>
                        <td>
                          <span className="badge badge-gray">{a.status === "perdido" ? "Perdido" : a.status === "en_riesgo" ? "En riesgo" : "Infiel"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── METHODOLOGY NOTE ── */}
      <div className="card" style={{ background: "var(--color-reig-bg)", fontSize: 12, color: TXT2 }}>
        <p><strong>Metodología:</strong> Fuente reig.db (dispensaciones con fecha_prox_disp). Ventana de renovación: 15 días antes a 20 después. Cutoff: {data.meta.analysis_cutoff}. Excluidos: IBP crónico (regulatorio) y GLP-1 social (Ozempic/Semaglutida, Victoza/Liraglutida — uso social no financiado). Evolución intra-periodo: hard cutoff 90 días para evitar falsos positivos en meses recientes.</p>
      </div>
    </div>
  );
}

/* ── KPI component ── */
function KPI({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="kpi-card">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--color-reig-text-muted)" }}>{sub}</p>}
    </div>
  );
}
