"use client";

// Página /rrhh/nominas — Paso 2.0.
// Selector de mes + dos tablas (Farmacia / Mirelus) con las 5 columnas que
// espera la gestoría: laborables · festivos · noct.lab · noct.fest · complemento €.
// Las nocturnas laborables y festivas van en columnas separadas porque se pagan
// con tarifas distintas (las noct. festivas son más caras). Nota: ambas son
// SUBSECCIONES de sus columnas principales, NO aditivas.
//
// Esta pantalla NO guarda en BD ni genera PDFs. Solo muestra lo que devuelve
// GET /api/rrhh/nominas?mes=YYYY-MM. Generar PDFs y persistir historial queda
// para Paso 2.1. Ver REIG-BASE → nominas-rrhh.md §9 y §13.

import { useCallback, useEffect, useMemo, useState } from "react";

interface GuardiaDesglose {
  fecha: string;
  dow: number;
  horas: number;
  es_festivo: boolean;
}

interface Desglose {
  fijas_mes?: number;
  extras_fijas_mes?: number;
  extras_fijas_semana?: number;
  extras_diarias_mes?: number;
  descuento_vacaciones?: number;
  descuento_guardia_maria?: number;
  horas_guardia_laboral?: number;
  horas_guardia_festiva?: number;
  horas_guardia_nocturnas_lab?: number;
  horas_guardia_nocturnas_fest?: number;
  valor_fijo_gestoria?: boolean;
  dias_laborables_trabajados?: number;
  viernes_trabajados?: number;
  dias_guardia_total?: number;
  dias_guardia_lj_con_descuento?: number;
  num_guardias_asignadas?: number;
  horas_guardias_reales?: number;
  guardias_detalle?: GuardiaDesglose[];
}

interface ResultadoNomina {
  empleado_id: string;
  nombre: string;
  nombre_formal_nomina: string | null;
  empresa: string;
  tipo_calculo: string | null;
  laborables: number;
  festivos: number;
  nocturnas_laborables: number;
  nocturnas_festivas: number;
  complementos_eur: number;
  desglose: Desglose;
  warnings: string[];
}

interface Respuesta {
  ok: boolean;
  mes?: string;
  total?: number;
  resultados?: ResultadoNomina[];
  resultados_farmacia?: ResultadoNomina[];
  resultados_mirelus?: ResultadoNomina[];
  warnings_globales?: string[];
  error?: string;
}

const GREEN = "#1f6b4a";
const GREEN_DARK = "#164d36";
const GREEN_LIGHT = "#e7f3ec";

function mesPorDefecto(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

function fmtEur(n: number): string {
  return `${fmtNum(n)} €`;
}

const DOW_ABREV = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function fmtGuardiasDetalle(gs: GuardiaDesglose[]): string {
  return gs
    .map((g) => {
      const dia = parseInt(g.fecha.slice(8, 10), 10);
      const marca = g.es_festivo ? "★" : "";
      return `${DOW_ABREV[g.dow]} ${dia}${marca} (${fmtNum(g.horas)})`;
    })
    .join(" + ");
}

/**
 * Construye la línea de desglose visible en pantalla — para que Beatriz pueda
 * validar a ojo cómo se ha llegado al total. NO sale en el PDF (eso son solo
 * los totales). Se adapta al tipo de cálculo.
 */
function fmtDesglose(d: Desglose, tipo: string | null): string {
  const partes: string[] = [];

  if (d.valor_fijo_gestoria) return "valor fijo gestoría";

  if (d.fijas_mes != null && d.fijas_mes > 0) partes.push(`fijas ${fmtNum(d.fijas_mes)}h`);
  if (d.extras_fijas_mes != null && d.extras_fijas_mes > 0)
    partes.push(`extras fijas ${fmtNum(d.extras_fijas_mes)}h`);
  if (d.extras_diarias_mes != null && d.extras_diarias_mes > 0) {
    const diasTxt = d.dias_laborables_trabajados != null ? ` (${d.dias_laborables_trabajados}d×0.5)` : "";
    partes.push(`extras diarias ${fmtNum(d.extras_diarias_mes)}h${diasTxt}`);
  }
  if (d.descuento_guardia_maria != null && d.descuento_guardia_maria > 0)
    partes.push(`−${fmtNum(d.descuento_guardia_maria)}h descuento guardia (L-J)`);

  // Detalle día a día de guardias (sustituye el agregado anterior)
  if (d.guardias_detalle && d.guardias_detalle.length > 0) {
    partes.push(`guardias: ${fmtGuardiasDetalle(d.guardias_detalle)}`);
  }

  // Subtotales nocturnas (solo María) — siguen apareciendo aparte porque las
  // nocturnas son subsección no aditiva, importantes de validar a ojo.
  if (d.horas_guardia_nocturnas_lab != null && d.horas_guardia_nocturnas_lab > 0)
    partes.push(`${fmtNum(d.horas_guardia_nocturnas_lab)}h noct lab`);
  if (d.horas_guardia_nocturnas_fest != null && d.horas_guardia_nocturnas_fest > 0)
    partes.push(`${fmtNum(d.horas_guardia_nocturnas_fest)}h noct fest`);

  // Zule: muestra V trabajados explícitamente
  if (tipo === "apoyo_estudiante_optica") {
    const dl = d.dias_laborables_trabajados ?? 0;
    const v = d.viernes_trabajados ?? 0;
    return `${dl} días L-V × 4h base + ${v} V × 4h extras`;
  }

  return partes.length ? partes.join(" · ") : "—";
}

function TablaNomina({
  titulo,
  resultados,
}: {
  titulo: string;
  resultados: ResultadoNomina[];
}) {
  if (!resultados.length) {
    return (
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: GREEN_DARK, fontSize: 18, margin: "16px 0 8px" }}>{titulo}</h2>
        <p style={{ color: "#888", fontSize: 14 }}>Sin empleados en esta categoría.</p>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ color: GREEN_DARK, fontSize: 18, margin: "16px 0 8px" }}>{titulo}</h2>
      <div style={{ overflowX: "auto", border: `1px solid ${GREEN_LIGHT}`, borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: GREEN_LIGHT, color: GREEN_DARK, textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>Nombre nómina</th>
              <th style={{ padding: "8px 12px", textAlign: "right" }}>Laborables</th>
              <th style={{ padding: "8px 12px", textAlign: "right" }}>Festivos</th>
              <th style={{ padding: "8px 12px", textAlign: "right" }} title="Subsección de Laborables. Pago con suplemento nocturno.">Noct. lab.</th>
              <th style={{ padding: "8px 12px", textAlign: "right" }} title="Subsección de Festivos. Suplemento nocturno festivo (más caro).">Noct. fest.</th>
              <th style={{ padding: "8px 12px", textAlign: "right" }}>Complemento</th>
              <th style={{ padding: "8px 12px" }}>Notas</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((r) => {
              const nombre = r.nombre_formal_nomina || r.nombre;
              const hasWarn = r.warnings.length > 0;
              return (
                <tr key={r.empleado_id} style={{ borderTop: `1px solid ${GREEN_LIGHT}` }}>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ fontWeight: 600 }}>{nombre}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>
                      {r.empleado_id} · {r.tipo_calculo || "sin tipo"}
                    </div>
                    <div style={{ fontSize: 11, color: GREEN_DARK, marginTop: 2, fontStyle: "italic" }}>
                      {fmtDesglose(r.desglose, r.tipo_calculo)}
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmtNum(r.laborables)}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmtNum(r.festivos)}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#888" }}>
                    {fmtNum(r.nocturnas_laborables)}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#888" }}>
                    {fmtNum(r.nocturnas_festivas)}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmtEur(r.complementos_eur)}
                  </td>
                  <td style={{ padding: "8px 12px", color: hasWarn ? "#b56" : "#888", fontSize: 12 }}>
                    {hasWarn ? `⚠ ${r.warnings.length} aviso(s)` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function NominasPage() {
  const [mes, setMes] = useState<string>(mesPorDefecto());
  const [data, setData] = useState<Respuesta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/rrhh/nominas?mes=${m}`);
      const j = (await r.json()) as Respuesta;
      if (!j.ok) throw new Error(j.error || "Error desconocido");
      setData(j);
    } catch (e) {
      setError(String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar(mes);
  }, [mes, cargar]);

  const todosWarnings = useMemo(() => {
    if (!data?.resultados) return [];
    const all: { nombre: string; warning: string }[] = [];
    for (const r of data.resultados) {
      for (const w of r.warnings) {
        all.push({ nombre: r.nombre_formal_nomina || r.nombre, warning: w });
      }
    }
    return all;
  }, [data]);

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ color: GREEN_DARK, fontSize: 24, marginBottom: 4 }}>Nóminas</h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          Cálculo mensual automático (Paso 2.0). Sin generación de PDF ni historial todavía.
        </p>
      </header>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <label style={{ color: GREEN_DARK, fontWeight: 600, fontSize: 14 }}>
          Mes:&nbsp;
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            style={{
              padding: "6px 10px",
              border: `1px solid ${GREEN}`,
              borderRadius: 6,
              fontSize: 14,
              color: GREEN_DARK,
            }}
          />
        </label>
        <button
          onClick={() => cargar(mes)}
          disabled={loading}
          style={{
            padding: "6px 14px",
            background: GREEN,
            color: "white",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Calculando…" : "Recalcular"}
        </button>
        <a
          href={`/api/rrhh/nominas/pdf?mes=${mes}&empresa=farmacia`}
          target="_blank"
          rel="noreferrer"
          style={{
            padding: "6px 14px",
            background: GREEN_DARK,
            color: "white",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          📄 PDF Farmacia
        </a>
        <a
          href={`/api/rrhh/nominas/pdf?mes=${mes}&empresa=mirelus`}
          target="_blank"
          rel="noreferrer"
          style={{
            padding: "6px 14px",
            background: "#555",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          📄 PDF Mirelus
        </a>
        {data?.total !== undefined && (
          <span style={{ color: "#666", fontSize: 13 }}>
            {data.total} empleado(s) · mes {data.mes}
          </span>
        )}
      </div>

      {error && (
        <div
          style={{
            background: "#fee",
            border: "1px solid #c33",
            color: "#900",
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
          }}
        >
          Error: {error}
        </div>
      )}

      {data && (
        <>
          <TablaNomina titulo="Farmacia Reig" resultados={data.resultados_farmacia || []} />
          <TablaNomina titulo="Mirelus SL (a palo seco)" resultados={data.resultados_mirelus || []} />

          {todosWarnings.length > 0 && (
            <div
              style={{
                background: "#fff8e1",
                border: "1px solid #e0b400",
                borderRadius: 8,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <h3 style={{ color: "#7a5c00", margin: "0 0 8px 0", fontSize: 16 }}>
                Avisos del motor ({todosWarnings.length})
              </h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#7a5c00" }}>
                {todosWarnings.map((w, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    <strong>{w.nombre}:</strong> {w.warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </>
      )}
    </div>
  );
}
