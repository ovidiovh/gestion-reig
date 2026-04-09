"use client";

// Página /rrhh/nominas — Paso 2.0 + Paso 2.1.
// Selector de mes + dos tablas (Farmacia / Mirelus) con las 5 columnas que
// espera la gestoría: laborables · festivos · noct.lab · noct.fest · complemento €.
// Las nocturnas laborables y festivas van en columnas separadas porque se pagan
// con tarifas distintas (las noct. festivas son más caras). Nota: ambas son
// SUBSECCIONES de sus columnas principales, NO aditivas.
//
// Paso 2.1 (sesión 9, 2026-04-07): añadido botón "🔒 Cerrar mes y archivar"
// que llama a POST /api/rrhh/nominas/cerrar-mes. Genera los dos PDFs (Farmacia
// + Mirelus), los hashea, los sube a Google Drive (carpeta compartida) y crea
// dos filas en `rrhh_nominas_historial`. Cada cierre incrementa `version` —
// nunca sobrescribe. La sección "Historial del mes" debajo de las tablas
// lista todas las versiones existentes con enlaces directos a Drive.
//
// Ver REIG-BASE → nominas-rrhh.md §9, §9.1, §13.

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

interface VersionHistorial {
  id: string;
  mes: string;
  empresa: "reig" | "mirelus";
  version: number;
  cerrado_at: string;
  cerrado_por_email: string;
  hash_pdf: string;
  bytes_pdf: number;
  drive_file_id: string;
  drive_web_view_link: string;
  notas: string | null;
  obsoleto: number;
}

interface RespuestaHistorial {
  ok: boolean;
  mes?: string;
  total?: number;
  filas?: VersionHistorial[];
  error?: string;
}

interface CierreEmpresaResultado {
  empresa: "reig" | "mirelus";
  version: number;
  hash_pdf: string;
  bytes_pdf: number;
  drive_file_id: string;
  drive_web_view_link: string;
  filename: string;
}

interface RespuestaCierre {
  ok: boolean;
  mes?: string;
  cerrado_por?: string;
  cerrado_at?: string;
  farmacia?: CierreEmpresaResultado;
  mirelus?: CierreEmpresaResultado;
  error?: string;
}

const GREEN = "var(--color-reig-green)";
const GREEN_DARK = "var(--color-reig-green-dark)";
const GREEN_LIGHT = "var(--color-reig-green-light)";

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
        <h2 style={{ color: "var(--color-reig-green-dark)", fontSize: 18, margin: "16px 0 8px" }}>{titulo}</h2>
        <p style={{ color: "var(--color-reig-text-secondary)", fontSize: 14 }}>Sin empleados en esta categoría.</p>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ color: "var(--color-reig-green-dark)", fontSize: 18, margin: "16px 0 8px" }}>{titulo}</h2>
      <div style={{ overflowX: "auto", border: `1px solid var(--color-reig-green-light)`, borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "var(--color-reig-green-light)", color: "var(--color-reig-green-dark)", textAlign: "left" }}>
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
                <tr key={r.empleado_id} style={{ borderTop: `1px solid var(--color-reig-green-light)` }}>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ fontWeight: 600 }}>{nombre}</div>
                    <div style={{ fontSize: 11, color: "var(--color-reig-text-secondary)" }}>
                      {r.empleado_id} · {r.tipo_calculo || "sin tipo"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-reig-green-dark)", marginTop: 2, fontStyle: "italic" }}>
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
                  <td style={{ padding: "8px 12px", color: hasWarn ? "var(--color-reig-danger)" : "var(--color-reig-text-secondary)", fontSize: 12 }}>
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

function fmtFechaCorta(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function NominasPage() {
  const [mes, setMes] = useState<string>(mesPorDefecto());
  const [data, setData] = useState<Respuesta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Histórico de PDFs (Paso 2.1) ─────────────────────────────────────
  const [historial, setHistorial] = useState<VersionHistorial[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);

  // ── Modal de cierre de mes ───────────────────────────────────────────
  const [cierreModalAbierto, setCierreModalAbierto] = useState(false);
  const [cierreNotas, setCierreNotas] = useState("");
  const [cierreLoading, setCierreLoading] = useState(false);
  const [cierreError, setCierreError] = useState<string | null>(null);
  const [cierreUltimo, setCierreUltimo] = useState<RespuestaCierre | null>(null);

  // ── Verificación de integridad ───────────────────────────────────────
  const [verificandoId, setVerificandoId] = useState<string | null>(null);
  const [verificacionResultado, setVerificacionResultado] = useState<string | null>(null);

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

  const cargarHistorial = useCallback(async (m: string) => {
    setHistorialLoading(true);
    try {
      const r = await fetch(`/api/rrhh/nominas/historial?mes=${m}`);
      const j = (await r.json()) as RespuestaHistorial;
      if (j.ok && j.filas) {
        setHistorial(j.filas);
      } else {
        setHistorial([]);
      }
    } catch {
      setHistorial([]);
    } finally {
      setHistorialLoading(false);
    }
  }, []);

  const proximaVersion = useMemo(() => {
    const versionesMes = historial.length > 0
      ? Math.max(...historial.map((h) => h.version))
      : 0;
    return versionesMes + 1;
  }, [historial]);

  const cerrarMes = useCallback(async () => {
    setCierreLoading(true);
    setCierreError(null);
    setCierreUltimo(null);
    try {
      const r = await fetch("/api/rrhh/nominas/cerrar-mes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, notas: cierreNotas.trim() || undefined }),
      });
      const j = (await r.json()) as RespuestaCierre;
      if (!j.ok) throw new Error(j.error || "Error desconocido al cerrar mes");
      setCierreUltimo(j);
      setCierreNotas("");
      setCierreModalAbierto(false);
      // Recargar historial para que aparezca la nueva versión
      await cargarHistorial(mes);
    } catch (e) {
      setCierreError(String(e));
    } finally {
      setCierreLoading(false);
    }
  }, [mes, cierreNotas, cargarHistorial]);

  const verificarVersion = useCallback(async (id: string) => {
    setVerificandoId(id);
    setVerificacionResultado(null);
    try {
      const r = await fetch(`/api/rrhh/nominas/historial/${id}/verificar`);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Error verificando");
      const matchDrive = j.match_drive ? "✅" : "❌";
      const matchRegen = j.match_regenerado ? "✅" : "❌";
      setVerificacionResultado(
        `Hash almacenado: ${String(j.hash_almacenado).slice(0, 16)}…\n` +
        `Hash en Drive:    ${j.hash_drive ? String(j.hash_drive).slice(0, 16) + "…" : "(error)"} ${matchDrive}\n` +
        `Hash regenerado:  ${j.hash_regenerado ? String(j.hash_regenerado).slice(0, 16) + "…" : "(error)"} ${matchRegen}`
      );
    } catch (e) {
      setVerificacionResultado(`Error: ${String(e)}`);
    } finally {
      setVerificandoId(null);
    }
  }, []);

  useEffect(() => {
    cargar(mes);
    cargarHistorial(mes);
  }, [mes, cargar, cargarHistorial]);

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
        <h1 style={{ color: "var(--color-reig-green-dark)", fontSize: 24, marginBottom: 4 }}>Nóminas</h1>
        <p style={{ color: "var(--color-reig-text-secondary)", fontSize: 14 }}>
          Cálculo mensual automático (Paso 2.0). Sin generación de PDF ni historial todavía.
        </p>
      </header>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <label style={{ color: "var(--color-reig-green-dark)", fontWeight: 600, fontSize: 14 }}>
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
            background: "var(--color-reig-green)",
            color: "var(--color-reig-surface)",
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
            background: "var(--color-reig-green-dark)",
            color: "var(--color-reig-surface)",
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
            background: "var(--color-reig-text-secondary)",
            color: "var(--color-reig-surface)",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          📄 PDF Mirelus
        </a>
        <button
          onClick={() => {
            setCierreError(null);
            setCierreModalAbierto(true);
          }}
          disabled={loading || cierreLoading || !data}
          style={{
            padding: "6px 14px",
            background: "var(--color-reig-warn)",
            color: "var(--color-reig-surface)",
            border: "none",
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 14,
            cursor: loading || cierreLoading ? "not-allowed" : "pointer",
          }}
          title="Genera y archiva los dos PDFs (Farmacia + Mirelus) en Google Drive con versión incremental. Para auditoría — no sobrescribe."
        >
          🔒 Cerrar mes y archivar
        </button>
        {data?.total !== undefined && (
          <span style={{ color: "var(--color-reig-text-secondary)", fontSize: 13 }}>
            {data.total} empleado(s) · mes {data.mes}
          </span>
        )}
      </div>

      {error && (
        <div
          style={{
            background: "var(--color-reig-danger-light)",
            border: "1px solid var(--color-reig-danger)",
            color: "var(--color-reig-danger)",
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
                background: "var(--color-reig-warn-light)",
                border: "1px solid var(--color-reig-warn)",
                borderRadius: 8,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <h3 style={{ color: "var(--color-reig-warn)", margin: "0 0 8px 0", fontSize: 16 }}>
                Avisos del motor ({todosWarnings.length})
              </h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--color-reig-warn)" }}>
                {todosWarnings.map((w, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    <strong>{w.nombre}:</strong> {w.warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cierreUltimo?.ok && cierreUltimo.farmacia && cierreUltimo.mirelus && (
            <div
              style={{
                background: "var(--color-reig-green-light)",
                border: "1px solid var(--color-reig-green)",
                borderRadius: 8,
                padding: 16,
                marginBottom: 16,
                color: "var(--color-reig-green-dark)",
                fontSize: 14,
              }}
            >
              <strong>✅ Cierre completado.</strong>{" "}
              Versión {cierreUltimo.farmacia.version} de Farmacia y versión{" "}
              {cierreUltimo.mirelus.version} de Mirelus archivadas en Drive.{" "}
              <a
                href={cierreUltimo.farmacia.drive_web_view_link}
                target="_blank"
                rel="noreferrer"
                style={{ color: GREEN_DARK, fontWeight: 600 }}
              >
                Abrir Farmacia
              </a>
              {" · "}
              <a
                href={cierreUltimo.mirelus.drive_web_view_link}
                target="_blank"
                rel="noreferrer"
                style={{ color: GREEN_DARK, fontWeight: 600 }}
              >
                Abrir Mirelus
              </a>
            </div>
          )}

          {/* ── Sección histórico del mes ───────────────────────────── */}
          <div style={{ marginTop: 32 }}>
            <h2 style={{ color: "var(--color-reig-green-dark)", fontSize: 18, margin: "0 0 8px 0" }}>
              📁 Historial de versiones del mes
            </h2>
            <p style={{ color: "var(--color-reig-text-secondary)", fontSize: 13, margin: "0 0 12px 0" }}>
              Cada cierre crea una versión nueva — nunca sobrescribe. Los PDFs viven en
              la carpeta Drive compartida con tu cuenta de Farmacia.
            </p>

            {historialLoading ? (
              <p style={{ color: "var(--color-reig-text-secondary)", fontSize: 13 }}>Cargando historial…</p>
            ) : historial.length === 0 ? (
              <p
                style={{
                  color: "var(--color-reig-text-secondary)",
                  fontSize: 13,
                  fontStyle: "italic",
                  padding: 12,
                  background: "var(--color-reig-bg)",
                  borderRadius: 6,
                }}
              >
                Sin versiones archivadas para este mes. Pulsa <strong>🔒 Cerrar mes y archivar</strong> para crear la primera.
              </p>
            ) : (
              <div style={{ overflowX: "auto", border: `1px solid var(--color-reig-green-light)`, borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--color-reig-green-light)", color: "var(--color-reig-green-dark)", textAlign: "left" }}>
                      <th style={{ padding: "8px 12px" }}>Empresa</th>
                      <th style={{ padding: "8px 12px" }}>Versión</th>
                      <th style={{ padding: "8px 12px" }}>Cerrado</th>
                      <th style={{ padding: "8px 12px" }}>Por</th>
                      <th style={{ padding: "8px 12px" }}>Tamaño</th>
                      <th style={{ padding: "8px 12px" }}>Hash</th>
                      <th style={{ padding: "8px 12px" }}>Notas</th>
                      <th style={{ padding: "8px 12px" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((h) => {
                      const esUltima = !historial.some(
                        (h2) => h2.empresa === h.empresa && h2.version > h.version
                      );
                      return (
                        <tr
                          key={h.id}
                          style={{
                            borderTop: `1px solid var(--color-reig-green-light)`,
                            opacity: h.obsoleto ? 0.5 : 1,
                          }}
                        >
                          <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                            {h.empresa === "reig" ? "Farmacia" : "Mirelus"}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                background: esUltima ? "var(--color-reig-green)" : "var(--color-reig-text-secondary)",
                                color: "var(--color-reig-surface)",
                                fontWeight: 600,
                                fontSize: 11,
                              }}
                            >
                              v{h.version}
                              {esUltima ? " · actual" : ""}
                            </span>
                          </td>
                          <td style={{ padding: "8px 12px", fontVariantNumeric: "tabular-nums" }}>
                            {fmtFechaCorta(h.cerrado_at)}
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--color-reig-text-secondary)" }}>
                            {h.cerrado_por_email}
                          </td>
                          <td style={{ padding: "8px 12px", fontVariantNumeric: "tabular-nums" }}>
                            {fmtBytes(h.bytes_pdf)}
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              fontFamily: "monospace",
                              fontSize: 11,
                              color: "var(--color-reig-text-secondary)",
                            }}
                            title={h.hash_pdf}
                          >
                            {h.hash_pdf.slice(0, 12)}…
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--color-reig-text)", maxWidth: 200 }}>
                            {h.notas || "—"}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            <a
                              href={h.drive_web_view_link}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: "var(--color-reig-green-dark)",
                                fontWeight: 600,
                                textDecoration: "none",
                                marginRight: 12,
                              }}
                            >
                              Abrir Drive
                            </a>
                            <button
                              onClick={() => verificarVersion(h.id)}
                              disabled={verificandoId === h.id}
                              style={{
                                background: "transparent",
                                border: `1px solid var(--color-reig-green)`,
                                color: "var(--color-reig-green-dark)",
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 11,
                                cursor: verificandoId === h.id ? "wait" : "pointer",
                              }}
                            >
                              {verificandoId === h.id ? "Verificando…" : "Verificar"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {verificacionResultado && (
              <pre
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: "var(--color-reig-bg)",
                  border: "1px solid var(--color-reig-border)",
                  borderRadius: 6,
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                }}
              >
                {verificacionResultado}
              </pre>
            )}
          </div>
        </>
      )}

      {/* ── Modal de confirmación de cierre ─────────────────────────── */}
      {cierreModalAbierto && (
        <div
          onClick={() => !cierreLoading && setCierreModalAbierto(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--color-reig-surface)",
              padding: 24,
              borderRadius: 12,
              maxWidth: 520,
              width: "90%",
              boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
            }}
          >
            <h2 style={{ margin: "0 0 12px 0", color: "var(--color-reig-green-dark)", fontSize: 20 }}>
              🔒 Cerrar mes {mes}
            </h2>
            <p style={{ margin: "0 0 12px 0", fontSize: 14, color: "var(--color-reig-text)" }}>
              Vas a crear la <strong>versión {proximaVersion}</strong> del mes <strong>{mes}</strong>.
              Se generarán dos PDFs (Farmacia + Mirelus), se hashearán con SHA-256
              y se subirán a la carpeta Drive compartida.
            </p>
            {historial.length > 0 && (
              <p
                style={{
                  margin: "0 0 12px 0",
                  fontSize: 13,
                  color: "var(--color-reig-text-secondary)",
                  background: "var(--color-reig-bg)",
                  padding: 8,
                  borderRadius: 6,
                }}
              >
                Ya existen {historial.length} versión(es) previa(s). La más reciente es del{" "}
                {fmtFechaCorta(historial[0]?.cerrado_at || "")} por {historial[0]?.cerrado_por_email}. Las
                versiones anteriores quedan accesibles abajo en el histórico — no se borran.
              </p>
            )}
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--color-reig-green-dark)", marginBottom: 4 }}>
              Notas (opcional)
            </label>
            <textarea
              value={cierreNotas}
              onChange={(e) => setCierreNotas(e.target.value)}
              placeholder='Ej: "Corregido horario de Julio del día 28"'
              rows={3}
              style={{
                width: "100%",
                padding: 8,
                border: `1px solid var(--color-reig-green)`,
                borderRadius: 6,
                fontSize: 13,
                fontFamily: "inherit",
                resize: "vertical",
                marginBottom: 16,
                boxSizing: "border-box",
              }}
            />
            {cierreError && (
              <div
                style={{
                  background: "var(--color-reig-danger-light)",
                  border: "1px solid var(--color-reig-danger)",
                  color: "var(--color-reig-danger)",
                  padding: 10,
                  borderRadius: 6,
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                {cierreError}
              </div>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setCierreModalAbierto(false)}
                disabled={cierreLoading}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  border: "1px solid var(--color-reig-text-secondary)",
                  color: "var(--color-reig-text)",
                  borderRadius: 6,
                  cursor: cierreLoading ? "not-allowed" : "pointer",
                  fontSize: 14,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={cerrarMes}
                disabled={cierreLoading}
                style={{
                  padding: "8px 16px",
                  background: "var(--color-reig-warn)",
                  border: "none",
                  color: "var(--color-reig-surface)",
                  borderRadius: 6,
                  cursor: cierreLoading ? "wait" : "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {cierreLoading ? "Generando y subiendo…" : `Crear versión ${proximaVersion}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
