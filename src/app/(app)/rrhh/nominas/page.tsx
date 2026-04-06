"use client";

// Página /rrhh/nominas — Paso 2.0.
// Selector de mes + dos tablas (Farmacia / Mirelus) con las 4 columnas que
// espera la gestoría (laborables · festivos · nocturnas · complementos €).
//
// Esta pantalla NO guarda en BD ni genera PDFs. Solo muestra lo que devuelve
// GET /api/rrhh/nominas?mes=YYYY-MM. Generar PDFs y persistir historial queda
// para Paso 2.1. Ver REIG-BASE → nominas-rrhh.md §9 y §13.

import { useCallback, useEffect, useMemo, useState } from "react";

interface Desglose {
  fijas_mes?: number;
  extras_fijas_mes?: number;
  extras_fijas_semana?: number;
  extras_diarias_mes?: number;
  descuento_vacaciones?: number;
  descuento_guardia_maria?: number;
  horas_guardia_laboral?: number;
  horas_guardia_festiva?: number;
  horas_guardia_nocturnas?: number;
  valor_fijo_gestoria?: boolean;
  dias_laborables_trabajados?: number;
  viernes_trabajados?: number;
}

interface ResultadoNomina {
  empleado_id: string;
  nombre: string;
  nombre_formal_nomina: string | null;
  empresa: string;
  tipo_calculo: string | null;
  laborables: number;
  festivos: number;
  nocturnas: number;
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
              <th style={{ padding: "8px 12px", textAlign: "right" }}>Nocturnas</th>
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
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmtNum(r.laborables)}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmtNum(r.festivos)}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#888" }}>
                    {fmtNum(r.nocturnas)}
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
  const [showDebug, setShowDebug] = useState(false);

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

          <div>
            <button
              onClick={() => setShowDebug((v) => !v)}
              style={{
                background: "transparent",
                border: `1px solid ${GREEN}`,
                color: GREEN_DARK,
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {showDebug ? "Ocultar JSON" : "Ver JSON completo (debug)"}
            </button>
            {showDebug && (
              <pre
                style={{
                  marginTop: 10,
                  background: "#fafafa",
                  border: "1px solid #ddd",
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 11,
                  maxHeight: 400,
                  overflow: "auto",
                }}
              >
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}
