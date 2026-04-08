"use client";

/**
 * Marketing → Clientes — Dashboard epidemiológico
 *
 * Foto fija anual del fichero de pacientes activos de Farmacia Reig.
 * Datos calculados con script offline contra reig.db (Farmatic Control H +
 * maestro de inventario), agregados y k-anonimizados (k=5) en
 * src/data/marketing/clientes/2026-04.json. La página NO consulta BD.
 *
 * Acceso restringido a Ovidio + Beatriz (ver lib/marketing/permisos.ts).
 *
 * Regeneración AUTOMÁTICA — Fase 11 del pipeline:
 *   1. Al procesar dispensaciones en `cargar_pipeline.py`, si hay un mes
 *      cerrado nuevo, se ejecuta `generar_clientes_json.py --mes YYYY-MM`.
 *   2. El script escribe dos ficheros en src/data/marketing/clientes/:
 *        - AAAA-MM.json   (archivo histórico versionado)
 *        - latest.json    (snapshot del último mes, importado aquí)
 *   3. Esta página importa SIEMPRE `latest.json`, así que basta con que el
 *      pipeline actualice ese fichero (ya lo hace). No hay que tocar código.
 *
 * Regeneración MANUAL (ad-hoc):
 *    python scripts/generar_clientes_json.py --mes 2026-04
 */

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
// Import del snapshot activo. `latest.json` lo reescribe el pipeline
// automático cada vez que cierra un mes completo de dispensaciones.
import data from "@/data/marketing/clientes/latest.json";

/* ── Identidad de marca Reig ─────────────────────────────────────────── */
const VERDE = "#1B5E20";
const VERDE_OSC = "#0d3d10";
const VERDE_CLARO = "#e7f3ec";
const VERDE_MED = "#388e3c";
const TXT = "#2a2e2b";
const TXT_SUAVE = "#5a615c";

/* Paleta degradada para los segmentos TSI (de más vulnerable a más alto) */
const SEG_COLORS: Record<string, string> = {
  V:  "#0d3d10",
  P:  "#1B5E20",
  A1: "#388e3c",
  A2: "#66bb6a",
  A3: "#a5d6a7",
  M:  "#bdbdbd",
  X:  "#e0e0e0",
};

/* ── Helpers de formato ──────────────────────────────────────────────── */
const fmtN = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("es-ES");
const fmtPct = (n: number | null | undefined) =>
  n == null ? "—" : `${Number(n).toFixed(1)}%`;

/* ── Tipos derivados del JSON ────────────────────────────────────────── */
type SegLabels = Record<string, string>;
type SegCounts = Record<string, number>;

interface PiramideRow { banda: string; F: number; M: number }
interface Patologia { nombre: string; n: number; pct: number }
interface TopGrupo { cod: string; nombre: string; pacientes: number; pct: number }

/* ──────────────────────────────────────────────────────────────────────
 * Página principal
 * ────────────────────────────────────────────────────────────────────── */
export default function MarketingClientesPage() {
  const labels = data.segmentos.labels as SegLabels;
  const segActivos = data.segmentos.activos as SegCounts;
  const segFidelizados = data.segmentos.fidelizados as SegCounts;

  /* Pirámide: M en negativo para hacer espejo */
  const piramideData = useMemo(
    () =>
      (data.piramide as PiramideRow[]).map((r) => ({
        banda: r.banda,
        Hombres: -r.M,
        Mujeres: r.F,
        absM: r.M,
        absF: r.F,
      })),
    []
  );

  /* Donut segmentos (excluyo X = técnico, es residual) */
  const donutData = useMemo(() => {
    const orden = ["V", "P", "A1", "A2", "A3", "M"];
    const totalActivos = orden.reduce((s, k) => s + (segActivos[k] || 0), 0);
    return orden
      .map((k) => ({
        key: k,
        label: labels[k],
        value: segActivos[k] || 0,
        pct: totalActivos ? ((segActivos[k] || 0) / totalActivos) * 100 : 0,
      }))
      .filter((d) => d.value > 0);
  }, [segActivos, labels]);

  /* Patologías ordenadas */
  const patologiasOrdenadas = useMemo(
    () => [...(data.patologias as Patologia[])].sort((a, b) => b.n - a.n),
    []
  );

  /* Top grupos ATC máximo para escalar la barra de fondo */
  const topGrupos = data.top_grupos as TopGrupo[];
  const maxTopPct = Math.max(...topGrupos.map((g) => g.pct));

  /* Heatmap matrix */
  const hmSegs = data.heatmap_pat_seg.segmentos as string[];
  const hmFilas = data.heatmap_pat_seg.filas as Array<{
    patologia: string;
    valores: number[];
    denoms: number[];
    n: (number | null)[];
  }>;
  const hmMax = Math.max(...hmFilas.flatMap((f) => f.valores));

  /* Color del heatmap: escala lineal sobre verdes Reig */
  const heatColor = (v: number) => {
    if (v == null || v <= 0) return "#f5f5f5";
    const t = Math.min(v / hmMax, 1);
    // mix entre VERDE_CLARO y VERDE_OSC
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
    const c1 = [231, 243, 236]; // #e7f3ec
    const c2 = [13, 61, 16];    // #0d3d10
    return `rgb(${lerp(c1[0], c2[0])}, ${lerp(c1[1], c2[1])}, ${lerp(c1[2], c2[2])})`;
  };

  return (
    <div style={{ color: TXT, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* ── Cabecera ───────────────────────────────────────────────── */}
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider" style={{ color: TXT_SUAVE }}>
          Marketing · Clientes
        </p>
        <h1
          className="text-3xl md:text-4xl font-bold mt-1"
          style={{ fontFamily: "'DM Serif Display', serif", color: VERDE_OSC }}
        >
          Quiénes son nuestros pacientes
        </h1>
        <p className="text-sm mt-2 max-w-3xl" style={{ color: TXT_SUAVE }}>
          Foto del fichero de pacientes de Farmacia Reig en los últimos 12 meses
          ({data.ventana}). Calculado a partir de dispensaciones y maestro de
          inventario. Datos agregados y anonimizados (k≥{data.k_anon}). Acceso
          restringido a gestión.
        </p>
      </header>

      {/* ── Hero KPIs ──────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <KpiCard
          big={fmtN(data.kpis.activos_12m)}
          label="Pacientes activos 12m"
          hint="Al menos 1 dispensación en la ventana"
        />
        <KpiCard
          big={fmtN(data.kpis.fidelizados_12m)}
          label="Pacientes fidelizados"
          hint="≥ 6 dispensaciones (núcleo recurrente)"
        />
        <KpiCard
          big={fmtPct(data.kpis.polifarmacia_5plus_pct)}
          label="Polifarmacia ≥ 5"
          hint="% de activos con ≥5 grupos terapéuticos distintos"
        />
        <KpiCard
          big={fmtPct(data.kpis.polifarmacia_10plus_pct)}
          label="Polifarmacia ≥ 10"
          hint="% de activos con ≥10 grupos terapéuticos distintos"
        />
        <KpiCard
          big={String(data.kpis.patologias_detectadas)}
          label="Patologías inferidas"
          hint="Grandes grupos crónicos detectables vía ATC"
        />
        <KpiCard
          big={fmtN(data.kpis.inmunosup_total)}
          label="Inmunosuprimidos"
          hint="Tratamiento crónico (incluye trasplante y autoinmunes)"
        />
      </section>

      {/* ── Pirámide + Donut TSI ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card titulo="Pirámide poblacional (sexo × edad)" subtitulo="Pacientes activos">
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart
                data={piramideData}
                layout="vertical"
                stackOffset="sign"
                margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => fmtN(Math.abs(Number(v)))}
                  stroke={TXT_SUAVE}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="banda"
                  stroke={TXT_SUAVE}
                  tick={{ fontSize: 11 }}
                  width={50}
                />
                <Tooltip
                  formatter={(value, name) => [
                    fmtN(Math.abs(Number(value))),
                    String(name),
                  ]}
                  contentStyle={{ borderRadius: 8, borderColor: VERDE_CLARO }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Hombres" stackId="x" fill={VERDE_MED} />
                <Bar dataKey="Mujeres" stackId="x" fill={VERDE} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          titulo="Segmentación socioeconómica (TSI)"
          subtitulo="Activos, según moda anual de aportación"
        >
          <div className="grid grid-cols-2 gap-4 items-center">
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="key"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {donutData.map((d) => (
                      <Cell key={d.key} fill={SEG_COLORS[d.key]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, _n, item) => {
                      const p = (item?.payload ?? {}) as { pct?: number; key?: string };
                      return [
                        `${fmtN(Number(v))} (${(p.pct ?? 0).toFixed(1)}%)`,
                        labels[p.key ?? ""] ?? "",
                      ];
                    }}
                    contentStyle={{ borderRadius: 8, borderColor: VERDE_CLARO }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="text-xs space-y-1.5">
              {donutData.map((d) => (
                <li key={d.key} className="flex items-start gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-sm mt-0.5 shrink-0"
                    style={{ background: SEG_COLORS[d.key] }}
                  />
                  <span>
                    <strong>{d.key}</strong> · {d.label}
                    <br />
                    <span style={{ color: TXT_SUAVE }}>
                      {fmtN(d.value)} · {d.pct.toFixed(1)}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <Aviso>
            <strong>Aviso conceptual:</strong> TSI 001 (V) son <em>exentos</em>
            {" "}— parados sin prestación, RAI, IMV, PNC, síndrome tóxico — NO
            equivale a "renta baja". La renta baja propiamente dicha está en
            TSI 002 (P, pensionistas) y TSI 003 (A1, activos &lt;18.135 €).
          </Aviso>
        </Card>
      </div>

      {/* ── Top patologías ─────────────────────────────────────────── */}
      <Card
        titulo="Patologías crónicas inferidas"
        subtitulo="Estimación a partir de los grupos terapéuticos dispensados (12 m)"
      >
        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer>
            <BarChart
              data={patologiasOrdenadas}
              layout="vertical"
              margin={{ top: 4, right: 80, left: 200, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
              <XAxis
                type="number"
                stroke={TXT_SUAVE}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => fmtN(v as number)}
              />
              <YAxis
                type="category"
                dataKey="nombre"
                stroke={TXT_SUAVE}
                tick={{ fontSize: 11 }}
                width={200}
              />
              <Tooltip
                formatter={(v, _n, item) => {
                  const p = (item?.payload ?? {}) as Partial<Patologia>;
                  return [
                    `${fmtN(Number(v))} pacientes (${(p.pct ?? 0).toFixed(1)}%)`,
                    "Estimación",
                  ];
                }}
                contentStyle={{ borderRadius: 8, borderColor: VERDE_CLARO }}
              />
              <Bar dataKey="n" fill={VERDE} radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="n"
                  position="right"
                  formatter={(v: unknown) => fmtN(Number(v))}
                  style={{ fontSize: 11, fill: TXT_SUAVE }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── Polifarmacia + Inmunosupresión ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 mt-6">
        <Card titulo="Polifarmacia" subtitulo="Pacientes con muchos grupos terapéuticos en 12m">
          <div className="grid grid-cols-3 gap-4 py-2">
            <Anillo
              valor={data.polifarmacia["5plus"].pct}
              label="≥ 5 grupos"
              n={data.polifarmacia["5plus"].n}
            />
            <Anillo
              valor={data.polifarmacia["10plus"].pct}
              label="≥ 10 grupos"
              n={data.polifarmacia["10plus"].n}
            />
            <Anillo
              valor={data.polifarmacia["15plus"].pct}
              label="≥ 15 grupos"
              n={data.polifarmacia["15plus"].n}
            />
          </div>
          <p className="text-xs mt-3" style={{ color: TXT_SUAVE }}>
            Indicador clásico de complejidad farmacoterapéutica. Pacientes con
            ≥10 grupos suelen ser candidatos a Atención Farmacéutica activa
            (AFA / SPD).
          </p>
        </Card>

        <Card
          titulo="Inmunosupresión crónica"
          subtitulo="Tratamiento sostenido en 12 m"
        >
          <div className="grid grid-cols-2 gap-4 py-2">
            <BigStat
              valor={fmtN(data.kpis.inmunosup_total)}
              label="Pacientes con inmunosupresor crónico"
              hint="Incluye trasplantados y autoinmunes severos (L04A)"
            />
            <BigStat
              valor={fmtN(data.kpis.inmunosup_tx_pattern)}
              label="Patrón sugestivo de trasplante"
              hint="Tacrolimus + (micofenolato/everolimus) o valganciclovir. Estimación, no diagnóstico."
            />
          </div>
        </Card>
      </div>

      {/* ── Heatmap patología × segmento ──────────────────────────── */}
      <Card
        titulo="Prevalencia por segmento socioeconómico"
        subtitulo="Ajustada por edad (estandarización directa)"
      >
        <p className="text-xs mb-3" style={{ color: TXT_SUAVE }}>
          Cada celda muestra el % estimado de pacientes con esa patología
          dentro del segmento, ajustado por la distribución de edad de la
          cohorte total. Más oscuro = mayor prevalencia. Lectura: si el color
          se intensifica de derecha a izquierda hay gradiente socioeconómico
          (la patología se concentra en rentas más bajas).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2 sticky left-0 bg-white" style={{ color: TXT_SUAVE }}>
                  Patología
                </th>
                {hmSegs.map((s) => (
                  <th key={s} className="p-2 text-center" style={{ color: TXT_SUAVE }}>
                    <div className="font-bold" style={{ color: VERDE_OSC }}>{s}</div>
                    <div className="text-[10px] font-normal">{labels[s]?.split(" ")[0]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hmFilas.map((fila) => (
                <tr key={fila.patologia}>
                  <td className="p-2 sticky left-0 bg-white border-t border-gray-100">
                    {fila.patologia}
                  </td>
                  {fila.valores.map((v, i) => {
                    const denom = fila.denoms[i];
                    const oculto = denom < 5;
                    const bg = oculto ? "#f5f5f5" : heatColor(v);
                    const t = Math.min(v / hmMax, 1);
                    const fg = t > 0.55 ? "#fff" : VERDE_OSC;
                    return (
                      <td
                        key={i}
                        className="p-2 text-center border border-white"
                        style={{ background: bg, color: fg, fontWeight: 600, minWidth: 64 }}
                        title={
                          oculto
                            ? "Denominador <5, celda oculta por k-anonimidad"
                            : `${fmtPct(v)} ajustado por edad · ${fmtN(fila.n[i] ?? 0)} casos sobre ${fmtN(denom)} (${hmSegs[i]})`
                        }
                      >
                        {oculto ? "·" : `${v.toFixed(1)}%`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] mt-3" style={{ color: TXT_SUAVE }}>
          Método: estandarización directa por tramos de edad de la cohorte
          activa total. Celdas con denominador (segmento × edad) menor de 5 se
          excluyen del cálculo por k-anonimidad. A3 y M tienen tamaños
          muestrales pequeños — leer con cautela.
        </p>
      </Card>

      {/* ── Top grupos ATC ─────────────────────────────────────────── */}
      <Card
        titulo="Top 25 grupos terapéuticos (ATC)"
        subtitulo="Ordenados por número de pacientes activos"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: TXT_SUAVE }}>
                <th className="text-left p-2 w-16">Cód.</th>
                <th className="text-left p-2">Grupo terapéutico</th>
                <th className="text-right p-2 w-24">Pacientes</th>
                <th className="text-right p-2 w-16">%</th>
              </tr>
            </thead>
            <tbody>
              {topGrupos.map((g, idx) => (
                <tr key={g.cod} className="border-t border-gray-100">
                  <td className="p-2 font-mono">{g.cod}</td>
                  <td className="p-2 relative">
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm"
                      style={{
                        width: `${(g.pct / maxTopPct) * 100}%`,
                        background: idx % 2 === 0 ? "#e7f3ec" : "#dbecdf",
                        zIndex: 0,
                      }}
                    />
                    <span className="relative">{g.nombre}</span>
                  </td>
                  <td className="p-2 text-right tabular-nums">{fmtN(g.pacientes)}</td>
                  <td className="p-2 text-right tabular-nums">{g.pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Pie / metodología ──────────────────────────────────────── */}
      <details
        className="mt-8 text-xs rounded-xl p-4"
        style={{ background: VERDE_CLARO, color: TXT }}
      >
        <summary className="cursor-pointer font-bold" style={{ color: VERDE_OSC }}>
          Metodología y notas
        </summary>
        <div className="mt-3 space-y-2 leading-relaxed">
          <p>
            <strong>Fuente:</strong> {data.fuente}. Cohorte: pacientes con al
            menos una dispensación efectiva en {data.ventana}. Las
            dispensaciones futuras (programadas en Control H) se excluyen.
          </p>
          <p>
            <strong>Anonimización:</strong> CIPs hash SHA-256 irreversibles.
            Métricas agregadas con k≥{data.k_anon} (k-anonimidad). Celdas con
            menos de {data.k_anon} pacientes se enmascaran o excluyen del
            cálculo.
          </p>
          <p>
            <strong>Patologías:</strong> inferidas por presencia de grupos
            terapéuticos (códigos ATC) específicos. Es una <em>estimación
            poblacional</em>, no un diagnóstico clínico individual. Algunos
            ATCs tienen indicaciones múltiples y pueden generar
            falsos positivos.
          </p>
          <p>
            <strong>Segmentación TSI:</strong> calculada por moda anual de
            tipo de aportación (TA) cruzando con maestro_aportaciones. La
            interpretación es sobre <em>renta disponible implícita</em>, no
            tipo de trabajo. TSI 001 = exentos.
          </p>
          <p>
            <strong>Última actualización:</strong> {data.fecha_corte} · Versión {data.version}
          </p>
        </div>
      </details>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Componentes auxiliares
 * ────────────────────────────────────────────────────────────────────── */

function Card({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-2"
      style={{ borderColor: "#eef0ee" }}
    >
      <header className="mb-3">
        <h2
          className="text-lg font-bold"
          style={{ fontFamily: "'DM Serif Display', serif", color: VERDE_OSC }}
        >
          {titulo}
        </h2>
        {subtitulo && (
          <p className="text-xs" style={{ color: TXT_SUAVE }}>
            {subtitulo}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

function KpiCard({
  big,
  label,
  hint,
}: {
  big: string;
  label: string;
  hint?: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 shadow-sm border"
      style={{ background: "#fff", borderColor: "#eef0ee" }}
    >
      <div
        className="text-3xl font-bold leading-none"
        style={{ fontFamily: "'DM Serif Display', serif", color: VERDE_OSC }}
      >
        {big}
      </div>
      <div className="text-xs font-semibold mt-2" style={{ color: TXT }}>
        {label}
      </div>
      {hint && (
        <div className="text-[10px] mt-1" style={{ color: TXT_SUAVE }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Anillo({
  valor,
  label,
  n,
}: {
  valor: number;
  label: string;
  n: number;
}) {
  // SVG donut con porcentaje en el centro
  const r = 38;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(valor, 100) / 100);
  return (
    <div className="flex flex-col items-center">
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={r} fill="none" stroke="#eef0ee" strokeWidth={10} />
        <circle
          cx={50}
          cy={50}
          r={r}
          fill="none"
          stroke={VERDE}
          strokeWidth={10}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text
          x={50}
          y={54}
          textAnchor="middle"
          fontSize={18}
          fontWeight={700}
          fill={VERDE_OSC}
          style={{ fontFamily: "'DM Serif Display', serif" }}
        >
          {valor.toFixed(1)}%
        </text>
      </svg>
      <div className="text-xs font-semibold mt-1">{label}</div>
      <div className="text-[10px]" style={{ color: TXT_SUAVE }}>
        {fmtN(n)} pacientes
      </div>
    </div>
  );
}

function BigStat({
  valor,
  label,
  hint,
}: {
  valor: string;
  label: string;
  hint?: string;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: VERDE_CLARO }}
    >
      <div
        className="text-3xl font-bold"
        style={{ fontFamily: "'DM Serif Display', serif", color: VERDE_OSC }}
      >
        {valor}
      </div>
      <div className="text-xs font-semibold mt-1">{label}</div>
      {hint && (
        <div className="text-[10px] mt-1" style={{ color: TXT_SUAVE }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-4 p-3 rounded-lg text-[11px] leading-relaxed"
      style={{ background: "#fff8e1", border: "1px solid #ffe082", color: "#5a4500" }}
    >
      {children}
    </div>
  );
}
