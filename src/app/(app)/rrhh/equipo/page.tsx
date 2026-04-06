"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Empleado, HorarioAsignacion, TurnoConfig, TipoCalculoNomina,
  TipoHorario, TIPO_HORARIO_LABEL,
  GREEN, GREEN_DARK, GREEN_LIGHT,
  TURNO_LABELS, TURNO_SHORT, TURNO_COLORS,
  EMPLEADOS_ROTATIVOS, EMPLEADOS_ESPECIALES,
  HORARIO_DEFAULT,
  ANCHOR_WEEK, getWeekStart, getTurnoForWeek,
  hhToLabel,
} from "../types";

// ── Mapas de display ──────────────────────────────────────────────────────────

const CATEGORIA_LABEL: Record<string, string> = {
  farmaceutico:  "Farmacéutico/a",
  auxiliar:      "Auxiliar de farmacia",
  mantenimiento: "Mantenimiento",
  limpieza:      "Limpieza",
  otro:          "Otros",
};

const CATEGORIA_JORNADA: Record<string, string> = {
  farmaceutico:  "40h / sem.",
  auxiliar:      "40h / sem.",
  mantenimiento: "Parcial",
  limpieza:      "Parcial",
  otro:          "—",
};

// Zuleica es auxiliar con jornada especial — se sobreescribe por id
const JORNADA_ESPECIAL: Record<string, string> = {
  zuleica: "24h / sem.",
};

// Labels de los tipos de cálculo de nómina (enum TipoCalculoNomina).
// Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §5.
const TIPO_CALCULO_LABEL: Record<TipoCalculoNomina, string> = {
  auxiliar_rotativo:       "Auxiliar rotativo (T1/T2/T3)",
  auxiliar_fijo_partido:   "Auxiliar fijo partido (Noelia)",
  farmaceutico_diurno:     "Farmacéutico diurno",
  farmaceutico_nocturno:   "Farmacéutico nocturno (María)",
  apoyo_estudiante_optica: "Apoyo estudiante óptica (Zule)",
  mirelus_mantenimiento:   "Mirelus — Mantenimiento (Javi)",
  mirelus_limpieza_fija:   "Mirelus — Limpieza fija 8h/mes (Tere)",
  mirelus_suplente:        "Mirelus — Suplente de Tere (Dolores)",
  mirelus_fija_gestoria:   "Mirelus — Fija gestoría (Luisa)",
};

type TabEquipo = "personal" | "horarios";

// ── Utilidad: fecha YYYY-MM-DD para una fecha ─────────────────────────────────
function addWeeks(weekStart: string, n: number): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + n * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtWeek(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${d.getDate()} – ${end.getDate()} ${end.toLocaleDateString("es-ES", { month: "long" })} ${end.getFullYear()}`;
}

// ── Componente modal de alta de empleado ─────────────────────────────────────

function NuevoEmpleadoModal({ onSave, onClose }: {
  onSave: (data: Partial<Empleado> & { id: string; nombre: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<{ id: string; nombre: string; categoria: string; empresa: "reig" | "mirelus"; farmaceutico: number; hace_guardia: number; complemento_mensual_eur: number; h_lab_complemento_mensual: number; departamento: string }>({
    id: "", nombre: "", categoria: "auxiliar", empresa: "reig",
    farmaceutico: 0, hace_guardia: 0, complemento_mensual_eur: 0, h_lab_complemento_mensual: 0, departamento: "farmacia",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.id.trim() || !form.nombre.trim()) {
      setError("ID y nombre son obligatorios");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(form.id)) {
      setError("El ID solo puede contener letras minúsculas, números y guiones bajos");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const inp: React.CSSProperties = {
    width: "100%", border: "1px solid #ddd", borderRadius: 6,
    padding: "6px 10px", fontSize: 13, background: "#fff",
  };
  const lbl: React.CSSProperties = { fontSize: 11, color: "#555", marginBottom: 3, display: "block" };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 14, padding: 24,
        maxWidth: 460, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: GREEN_DARK }}>Alta de empleado</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#999" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "span 2" }}>
            <label style={lbl}>Nombre *</label>
            <input style={inp} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Ana García" />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label style={lbl}>ID único * (sin espacios, minúsculas)</label>
            <input style={inp} value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s/g, "_") }))} placeholder="Ej: ana_garcia" />
          </div>
          <div>
            <label style={lbl}>Categoría</label>
            <select style={inp} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
              <option value="farmaceutico">Farmacéutico/a</option>
              <option value="auxiliar">Auxiliar</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="limpieza">Limpieza</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Empresa</label>
            <select style={inp} value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value as "reig" | "mirelus" }))}>
              <option value="reig">Farmacia Reig</option>
              <option value="mirelus">Mirelus</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Departamento</label>
            <select style={inp} value={form.departamento} onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))}>
              <option value="farmacia">Farmacia</option>
              <option value="optica">Óptica</option>
              <option value="ortopedia">Ortopedia</option>
              <option value="otro">Otros</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Complemento mensual fijo (€)</label>
            <input type="number" style={inp} value={form.complemento_mensual_eur} onChange={e => setForm(f => ({ ...f, complemento_mensual_eur: parseInt(e.target.value) || 0 }))} />
            <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>Salario fijo. No depende de las guardias.</div>
          </div>
          <div>
            <label style={lbl}>Horas laborables/mes (complemento)</label>
            <input type="number" style={inp} value={form.h_lab_complemento_mensual} onChange={e => setForm(f => ({ ...f, h_lab_complemento_mensual: parseInt(e.target.value) || 0 }))} />
            <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>Horas asociadas al complemento mensual.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="fma" checked={form.farmaceutico === 1} onChange={e => setForm(f => ({ ...f, farmaceutico: e.target.checked ? 1 : 0 }))} />
            <label htmlFor="fma" style={{ ...lbl, margin: 0 }}>Es farmacéutico/a</label>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="hg" checked={form.hace_guardia === 1} onChange={e => setForm(f => ({ ...f, hace_guardia: e.target.checked ? 1 : 0 }))} />
            <label htmlFor="hg" style={{ ...lbl, margin: 0 }}>Hace guardia</label>
          </div>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", color: "#c0392b", padding: "8px 12px", borderRadius: 6, fontSize: 12, marginTop: 12 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "#f5f5f5", color: "#555", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            {saving ? "Guardando…" : "Dar de alta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fila de empleado con edición inline ──────────────────────────────────────

const DEPTO_OPTS = [
  { value: "farmacia",  label: "Farmacia" },
  { value: "optica",    label: "Óptica" },
  { value: "ortopedia", label: "Ortopedia" },
  { value: "otro",      label: "Otros" },
];

// ── Helpers horario ────────────────────────────────────────────────────────────

function hhToTime(hh: number | null): string {
  if (hh == null) return "";
  const h = Math.floor(hh / 2);
  const m = hh % 2 === 0 ? "00" : "30";
  return `${h.toString().padStart(2, "0")}:${m}`;
}

function timeToHh(t: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return null;
  return h * 2 + (m >= 30 ? 1 : 0);
}

function fmtHorario(ia: number | null, fa: number | null, ib?: number | null, fb?: number | null): string {
  if (!ia || !fa) return "—";
  const a = `${hhToTime(ia)}–${hhToTime(fa)}`;
  if (ib && fb) return `${a} / ${hhToTime(ib)}–${hhToTime(fb)}`;
  return a;
}

function EmpleadoRow({
  emp, index, onUpdate, onBaja,
}: {
  emp: Empleado;
  index: number;
  onUpdate: (id: string, fields: Partial<Empleado>) => Promise<void>;
  onBaja: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  // Horario efectivo: DB primero, luego HORARIO_DEFAULT como fallback
  const effIa = emp.horario_inicio_a ?? HORARIO_DEFAULT[emp.id]?.[0] ?? null;
  const effFa = emp.horario_fin_a   ?? HORARIO_DEFAULT[emp.id]?.[1] ?? null;
  const effIb = emp.horario_inicio_b ?? HORARIO_DEFAULT[emp.id]?.[2] ?? null;
  const effFb = emp.horario_fin_b   ?? HORARIO_DEFAULT[emp.id]?.[3] ?? null;

  const [draft, setDraft] = useState<{
    categoria: string;
    farmaceutico: number;
    hace_guardia: number;
    cubre_nocturna: number;
    complemento_mensual_eur: number;
    h_lab_complemento_mensual: number;
    departamento: string;
    tipo_horario: TipoHorario;
    horario_inicio_a: number | null;
    horario_fin_a: number | null;
    horario_inicio_b: number | null;
    horario_fin_b: number | null;
    // ── Campos módulo nóminas (sesión 5) ──
    nombre_formal_nomina: string;
    tipo_calculo: string; // "" = null
    h_extras_fijas_mes: number;
    h_extras_fijas_semana: number;
    h_extra_diaria: number;
    descuenta_media_en_guardia: number;
    incluir_en_nomina: number;
    incluir_vacaciones: number;
  }>({
    categoria: emp.categoria || "auxiliar",
    farmaceutico: emp.farmaceutico,
    hace_guardia: emp.hace_guardia,
    cubre_nocturna: emp.cubre_nocturna ?? 0,
    complemento_mensual_eur: emp.complemento_mensual_eur,
    h_lab_complemento_mensual: emp.h_lab_complemento_mensual,
    departamento: emp.departamento || "farmacia",
    tipo_horario: (emp.tipo_horario as TipoHorario) ?? "continuo",
    horario_inicio_a: effIa,
    horario_fin_a:    effFa,
    horario_inicio_b: effIb,
    horario_fin_b:    effFb,
    nombre_formal_nomina:       emp.nombre_formal_nomina ?? "",
    tipo_calculo:               emp.tipo_calculo ?? "",
    h_extras_fijas_mes:         emp.h_extras_fijas_mes ?? 0,
    h_extras_fijas_semana:      emp.h_extras_fijas_semana ?? 0,
    h_extra_diaria:             emp.h_extra_diaria ?? 0,
    descuenta_media_en_guardia: emp.descuenta_media_en_guardia ?? 0,
    incluir_en_nomina:          emp.incluir_en_nomina ?? 0,
    incluir_vacaciones:         emp.incluir_vacaciones ?? 1,
  });
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      // Normalizar strings vacíos a null antes de enviar al backend.
      // tipo_calculo "" → null (empleado sin tipo de cálculo definido).
      // nombre_formal_nomina "" → null (no tiene nombre oficial distinto).
      const toSave: Partial<Empleado> = {
        ...draft,
        nombre_formal_nomina: draft.nombre_formal_nomina.trim() || null,
        tipo_calculo: (draft.tipo_calculo || null) as TipoCalculoNomina | null,
      };
      await onUpdate(emp.id, toSave);
      setSaveMsg({ ok: true, text: "✓ Guardado correctamente" });
      setTimeout(() => { setSaveMsg(null); setEditing(false); }, 1200);
    } catch (e) {
      setSaveMsg({ ok: false, text: String(e) });
    } finally {
      setSaving(false);
    }
  };

  const deptLabel  = DEPTO_OPTS.find(d => d.value === (emp.departamento || "farmacia"))?.label ?? "—";
  const isRotativo = EMPLEADOS_ROTATIVOS.includes(emp.id) || EMPLEADOS_ESPECIALES.includes(emp.id);
  const horarioTxt = isRotativo ? "Horario rotativo" : fmtHorario(effIa, effFa, effIb, effFb);

  const fldStyle: React.CSSProperties = {
    border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 13,
    padding: "6px 10px", background: "#fff", width: "100%", boxSizing: "border-box",
  };
  const lblStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: "#166534",
    textTransform: "uppercase", letterSpacing: "0.04em",
    marginBottom: 4, display: "block",
  };

  return (
    <div style={{ background: index % 2 === 0 ? "#fff" : "#f9fafb", borderBottom: "1px solid #f0f0f0" }}>

      {/* ─ Fila principal (card layout — sin scroll horizontal) ─ */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>

        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: emp.farmaceutico ? GREEN_LIGHT : "#f0f0f0",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, color: emp.farmaceutico ? GREEN_DARK : "#888",
        }}>
          {emp.nombre.charAt(0).toUpperCase()}
        </div>

        {/* Info principal — crece para llenar el espacio */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Línea 1: nombre + badge guardia */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: emp.farmaceutico ? GREEN_DARK : "#2a2e2b" }}>
              {emp.nombre}
            </span>
            {emp.empresa === "mirelus" && (
              <span style={{ fontSize: 8, color: "#9ca3af", background: "#f3f4f6", padding: "1px 5px", borderRadius: 4 }}>ext.</span>
            )}
            {emp.hace_guardia === 1 && (
              <span style={{ fontSize: 8, background: GREEN_LIGHT, color: GREEN, fontWeight: 700, padding: "1px 6px", borderRadius: 8 }}>guardia</span>
            )}
          </div>
          {/* Línea 2: depto · categoría */}
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
            {deptLabel} · {CATEGORIA_LABEL[emp.categoria] ?? emp.categoria}
          </div>
          {/* Línea 3: horario */}
          <div style={{
            fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginTop: 2,
            color: horarioTxt !== "—" ? GREEN_DARK : "#d1d5db",
            fontWeight: horarioTxt !== "—" ? 600 : 400,
          }}>
            {horarioTxt}
            {emp.complemento_mensual_eur > 0 && (
              <span style={{ marginLeft: 8, fontSize: 10, color: "#6b7280", fontWeight: 400 }}>
                +{emp.complemento_mensual_eur}€/mes
              </span>
            )}
          </div>
        </div>

        {/* Botón Editar */}
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setEditing(e => !e)}
            style={{
              background: editing ? "#f5f5f5" : GREEN,
              color: editing ? "#555" : "#fff",
              border: "none", borderRadius: 6, padding: "6px 14px",
              cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
            }}
          >
            {editing ? "Cerrar" : "✎ Editar"}
          </button>
          {!editing && (
            <button
              onClick={() => onBaja(emp.id)}
              title="Dar de baja"
              style={{ background: "#fef2f2", color: "#c0392b", border: "1px solid #fecaca", borderRadius: 6, padding: "6px 8px", cursor: "pointer", fontSize: 11 }}
            >
              ✗
            </button>
          )}
        </div>
      </div>

      {/* ─ Panel de edición ─ */}
      {editing && (
        <div style={{ padding: "20px 24px", background: "#f0fdf4", borderTop: "2px solid #4ade80" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: GREEN_DARK, marginBottom: 16 }}>
            Editar ficha · {emp.nombre}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 }}>

            <div>
              <label style={lblStyle}>Categoría</label>
              <select value={draft.categoria}
                onChange={e => setDraft(d => ({ ...d, categoria: e.target.value }))}
                style={fldStyle}>
                <option value="farmaceutico">Farmacéutico/a</option>
                <option value="auxiliar">Auxiliar</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="limpieza">Limpieza</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div>
              <label style={lblStyle}>Departamento</label>
              <select value={draft.departamento}
                onChange={e => setDraft(d => ({ ...d, departamento: e.target.value }))}
                style={fldStyle}>
                {DEPTO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" id={`fma-${emp.id}`} checked={draft.farmaceutico === 1}
                onChange={e => setDraft(d => ({ ...d, farmaceutico: e.target.checked ? 1 : 0 }))} />
              <label htmlFor={`fma-${emp.id}`} style={{ ...lblStyle, margin: 0, textTransform: "none", letterSpacing: 0 }}>Es farmacéutico/a</label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" id={`hg-${emp.id}`} checked={draft.hace_guardia === 1}
                onChange={e => setDraft(d => ({ ...d, hace_guardia: e.target.checked ? 1 : 0 }))} />
              <label htmlFor={`hg-${emp.id}`} style={{ ...lblStyle, margin: 0, textTransform: "none", letterSpacing: 0 }}>Hace guardia</label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }} title="Quien cubre la franja nocturna acumula 0,5 días de descanso compensatorio por guardia.">
              <input type="checkbox" id={`cn-${emp.id}`} checked={draft.cubre_nocturna === 1}
                disabled={draft.hace_guardia !== 1}
                onChange={e => setDraft(d => ({ ...d, cubre_nocturna: e.target.checked ? 1 : 0 }))} />
              <label htmlFor={`cn-${emp.id}`} style={{ ...lblStyle, margin: 0, textTransform: "none", letterSpacing: 0, opacity: draft.hace_guardia !== 1 ? 0.5 : 1 }}>Cubre franja nocturna</label>
            </div>

            <div>
              <label style={lblStyle}>Complemento mensual fijo (€)</label>
              <input type="number" value={draft.complemento_mensual_eur}
                onChange={e => setDraft(d => ({ ...d, complemento_mensual_eur: parseInt(e.target.value) || 0 }))}
                style={fldStyle} />
              <div style={{ fontSize: 9, color: "#888", marginTop: 3 }}>
                Salario fijo. No depende de las guardias hechas.
              </div>
            </div>

            <div>
              <label style={lblStyle}>Horas laborables/mes (complemento)</label>
              <input type="number" value={draft.h_lab_complemento_mensual}
                onChange={e => setDraft(d => ({ ...d, h_lab_complemento_mensual: parseInt(e.target.value) || 0 }))}
                style={fldStyle} />
              <div style={{ fontSize: 9, color: "#888", marginTop: 3 }}>
                Horas asociadas al complemento mensual.
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* ── Horario base — Paso 1.4 (2026-04-06) ──                      */}
            {/* Selector de tipo + campos condicionales. Reemplaza el antiguo  */}
            {/* toggle "V distinto" que no cubría partidos L-V reales.         */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={lblStyle}>Tipo de horario</label>
              <select
                value={draft.tipo_horario}
                onChange={e => {
                  const next = e.target.value as TipoHorario;
                  setDraft(d => {
                    // Transición a "continuo": limpiamos el bloque _b.
                    if (next === "continuo") {
                      return { ...d, tipo_horario: next, horario_inicio_b: null, horario_fin_b: null };
                    }
                    // Transición a "partido_lv" o "lj_distinto_v":
                    //   si _b está vacío, lo inicializamos a partir de _a para que
                    //   el usuario tenga un punto de partida y no pierda el foco.
                    if (d.horario_inicio_b == null || d.horario_fin_b == null) {
                      return { ...d, tipo_horario: next, horario_inicio_b: d.horario_inicio_a, horario_fin_b: d.horario_fin_a };
                    }
                    return { ...d, tipo_horario: next };
                  });
                }}
                style={fldStyle}
              >
                {(Object.entries(TIPO_HORARIO_LABEL) as [TipoHorario, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <div style={{ fontSize: 9, color: "#888", marginTop: 3 }}>
                Continuo: un solo tramo L-V. Partido L-V: mañana y tarde iguales toda la semana. L-J + V distinto: el viernes tiene horario propio (caso Zule).
              </div>
            </div>

            {/* ── Caso A: horario continuo L-V (un único tramo) ── */}
            {draft.tipo_horario === "continuo" && (<>
              <div>
                <label style={lblStyle}>Entrada L-V</label>
                <input type="time" step={1800}
                  value={hhToTime(draft.horario_inicio_a)}
                  onChange={e => setDraft(d => ({ ...d, horario_inicio_a: timeToHh(e.target.value) }))}
                  style={fldStyle} />
              </div>
              <div>
                <label style={lblStyle}>Salida L-V</label>
                <input type="time" step={1800}
                  value={hhToTime(draft.horario_fin_a)}
                  onChange={e => setDraft(d => ({ ...d, horario_fin_a: timeToHh(e.target.value) }))}
                  style={fldStyle} />
              </div>
            </>)}

            {/* ── Caso B: partido L-V (mañana + tarde iguales toda la semana) ── */}
            {draft.tipo_horario === "partido_lv" && (<>
              <div>
                <label style={lblStyle}>Entrada mañana (L-V)</label>
                <input type="time" step={1800}
                  value={hhToTime(draft.horario_inicio_a)}
                  onChange={e => setDraft(d => ({ ...d, horario_inicio_a: timeToHh(e.target.value) }))}
                  style={fldStyle} />
              </div>
              <div>
                <label style={lblStyle}>Salida mañana (L-V)</label>
                <input type="time" step={1800}
                  value={hhToTime(draft.horario_fin_a)}
                  onChange={e => setDraft(d => ({ ...d, horario_fin_a: timeToHh(e.target.value) }))}
                  style={fldStyle} />
              </div>
              <div>
                <label style={lblStyle}>Entrada tarde (L-V)</label>
                <input type="time" step={1800}
                  value={hhToTime(draft.horario_inicio_b)}
                  onChange={e => setDraft(d => ({ ...d, horario_inicio_b: timeToHh(e.target.value) }))}
                  style={fldStyle} />
              </div>
              <div>
                <label style={lblStyle}>Salida tarde (L-V)</label>
                <input type="time" step={1800}
                  value={hhToTime(draft.horario_fin_b)}
                  onChange={e => setDraft(d => ({ ...d, horario_fin_b: timeToHh(e.target.value) }))}
                  style={fldStyle} />
              </div>
            </>)}

            {/* ── Caso C: L-J + viernes distinto (caso Zule) ── */}
            {draft.tipo_horario === "lj_distinto_v" && (<>
              <div>
                <label style={lblStyle}>Entrada L-J</label>
                <input type="time" step={1800}
                  value={hhToTime(draft.horario_inicio_a)}
                  onChange={e => setDraft(d => ({ ...d, horario_inicio_a: timeToHh(e.target.value) }))}
                  style={fldStyle} />
              </div>
              <div>
                <label style={lblStyle}>Salida L-J</label>
                <input type="time" step={1800}
                  value={hhToTime(draft.horario_fin_a)}
                  onChange={e => setDraft(d => ({ ...d, horario_fin_a: timeToHh(e.target.value) }))}
                  style={fldStyle} />
              </div>
              <div>
                <label style={lblStyle}>Entrada Viernes</label>
                <input type="time" step={1800}
                  value={hhToTime(draft.horario_inicio_b)}
                  onChange={e => setDraft(d => ({ ...d, horario_inicio_b: timeToHh(e.target.value) }))}
                  style={fldStyle} />
              </div>
              <div>
                <label style={lblStyle}>Salida Viernes</label>
                <input type="time" step={1800}
                  value={hhToTime(draft.horario_fin_b)}
                  onChange={e => setDraft(d => ({ ...d, horario_fin_b: timeToHh(e.target.value) }))}
                  style={fldStyle} />
              </div>
            </>)}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* Sección: Datos de nómina (módulo /rrhh/nominas — sesión 5)  */}
            {/* Ver REIG-BASE → 06-OPERATIVA-FARMACIA/nominas-rrhh.md §3–§5 */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div style={{ gridColumn: "1 / -1", marginTop: 10, paddingTop: 14, borderTop: "1px dashed #86efac" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GREEN_DARK, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                💰 Datos de nómina
              </div>
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                Campos del módulo <code style={{ background: "#ecfdf5", padding: "0 3px", borderRadius: 3 }}>/rrhh/nominas</code>. Determinan cómo el motor calcula la nómina mensual de cada persona.
              </div>
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <label style={lblStyle}>Nombre formal en la gestoría</label>
              <input type="text" value={draft.nombre_formal_nomina}
                onChange={e => setDraft(d => ({ ...d, nombre_formal_nomina: e.target.value }))}
                style={fldStyle}
                placeholder="Ej: REYES Gregoria" />
              <div style={{ fontSize: 9, color: "#888", marginTop: 3 }}>
                Como aparece oficialmente en las nóminas (puede diferir del nombre común). Dejar vacío si no va a nómina.
              </div>
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <label style={lblStyle}>Tipo de cálculo nómina</label>
              <select value={draft.tipo_calculo}
                onChange={e => setDraft(d => ({ ...d, tipo_calculo: e.target.value }))}
                style={fldStyle}>
                <option value="">— No aplica (no va a nómina) —</option>
                {(Object.entries(TIPO_CALCULO_LABEL) as [TipoCalculoNomina, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <div style={{ fontSize: 9, color: "#888", marginTop: 3 }}>
                Determina qué fórmula usa el motor. Ver nominas-rrhh.md §5.
              </div>
            </div>

            <div>
              <label style={lblStyle}>H. extras fijas / mes</label>
              <input type="number" min={0} value={draft.h_extras_fijas_mes}
                onChange={e => setDraft(d => ({ ...d, h_extras_fijas_mes: parseInt(e.target.value) || 0 }))}
                style={fldStyle} />
              <div style={{ fontSize: 9, color: "#888", marginTop: 3 }}>
                Auxiliares farmacia: 4. Javier: 4. El resto: 0.
              </div>
            </div>

            <div>
              <label style={lblStyle}>H. extras fijas / semana</label>
              <input type="number" min={0} value={draft.h_extras_fijas_semana}
                onChange={e => setDraft(d => ({ ...d, h_extras_fijas_semana: parseInt(e.target.value) || 0 }))}
                style={fldStyle} />
              <div style={{ fontSize: 9, color: "#888", marginTop: 3 }}>
                Zule: 4 (viernes que trabaja). El resto: 0.
              </div>
            </div>

            <div>
              <label style={lblStyle}>H. extras por día trabajado</label>
              <input type="number" min={0} step={0.5} value={draft.h_extra_diaria}
                onChange={e => setDraft(d => ({ ...d, h_extra_diaria: parseFloat(e.target.value) || 0 }))}
                style={fldStyle} />
              <div style={{ fontSize: 9, color: "#888", marginTop: 3 }}>
                María: 0.5. Javier: 0.5. El resto: 0.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}
                 title="Los días que hace guardia no acumula h_extra_diaria. Solo María — ver §5.4.">
              <input type="checkbox" id={`dmg-${emp.id}`}
                checked={draft.descuenta_media_en_guardia === 1}
                disabled={draft.h_extra_diaria === 0}
                onChange={e => setDraft(d => ({ ...d, descuenta_media_en_guardia: e.target.checked ? 1 : 0 }))} />
              <label htmlFor={`dmg-${emp.id}`} style={{
                ...lblStyle, margin: 0, textTransform: "none", letterSpacing: 0,
                opacity: draft.h_extra_diaria === 0 ? 0.5 : 1,
              }}>
                No pagar h/día en guardia
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}
                 title="Aparece en la hoja mensual enviada a la gestoría. Distinto de 'activo' (que controla el planning).">
              <input type="checkbox" id={`ien-${emp.id}`}
                checked={draft.incluir_en_nomina === 1}
                onChange={e => setDraft(d => ({ ...d, incluir_en_nomina: e.target.checked ? 1 : 0 }))} />
              <label htmlFor={`ien-${emp.id}`} style={{ ...lblStyle, margin: 0, textTransform: "none", letterSpacing: 0 }}>
                Incluir en nómina mensual
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}
                 title="Aparece en /rrhh/vacaciones. Necesario para Tere/Dolores que no están en el planning pero sí tienen vacaciones.">
              <input type="checkbox" id={`iv-${emp.id}`}
                checked={draft.incluir_vacaciones === 1}
                onChange={e => setDraft(d => ({ ...d, incluir_vacaciones: e.target.checked ? 1 : 0 }))} />
              <label htmlFor={`iv-${emp.id}`} style={{ ...lblStyle, margin: 0, textTransform: "none", letterSpacing: 0 }}>
                Incluir en vacaciones
              </label>
            </div>

          </div>

          {saveMsg && (
            <div style={{
              marginTop: 14, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: saveMsg.ok ? "#dcfce7" : "#fef2f2",
              color: saveMsg.ok ? "#166534" : "#c0392b",
            }}>
              {saveMsg.text}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
            <button onClick={handleSave} disabled={saving}
              style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: "10px 28px", cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Guardando…" : "✓ Guardar cambios"}
            </button>
            <button onClick={() => setEditing(false)}
              style={{ background: "#f5f5f5", color: "#555", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontSize: 13 }}>
              Cancelar
            </button>
            <button onClick={() => onBaja(emp.id)}
              style={{ marginLeft: "auto", background: "#fef2f2", color: "#c0392b", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", cursor: "pointer", fontSize: 12 }}>
              Dar de baja
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Horario en texto para mostrar en tabla (derivado de HORARIO_DEFAULT confirmados)
const HORARIO_TEXTO: Record<string, string> = {
  ovidio:  "11:30 – 20:30",
  bea:     "7:00 – 15:30",
  maria:   "12:30 – 20:30",
  julio:   "9:00 – 14:00 / 17:00 – 20:00",
  celia:   "9:00 – 17:00",
  noelia:  "9:00 – 13:00 / 15:00 – 18:30",
  miriam:  "9:00 – 17:00",
  monica:  "9:00 – 17:00",
  javier:  "9:00 – 17:00 (guardia: 9–14 / 20–23)",
  zuleica: "16:30 – 20:30 (L-J) · Viernes diferente",
  davinia: "9:00 – 14:00 (en prácticas)",
  teresa:  "8:30 – 12:00",
  luisa:   "8:30 – 12:00",
};

// ── Modal editor de horarios de turnos ───────────────────────────────────────

function timeToHhLocal(t: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return null;
  return h * 2 + (m >= 30 ? 1 : 0);
}

function TurnoEditorModal({ turnos, onSave, onClose }: {
  turnos: TurnoConfig[];
  onSave: (cfg: TurnoConfig) => Promise<void>;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<TurnoConfig[]>(turnos);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError]   = useState("");

  const hhToTimeLocal = (hh: number | null): string => {
    if (hh == null) return "";
    const h = Math.floor(hh / 2);
    const m = hh % 2 === 0 ? "00" : "30";
    return `${h.toString().padStart(2, "0")}:${m}`;
  };

  const setField = (turno: number, field: keyof TurnoConfig, val: number | null) => {
    setDrafts(prev => prev.map(d => d.turno === turno ? { ...d, [field]: val } : d));
  };

  const handleSave = async (turno: number) => {
    const cfg = drafts.find(d => d.turno === turno);
    if (!cfg) return;
    setSaving(turno);
    setError("");
    try {
      await onSave(cfg);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(null);
    }
  };

  const inp: React.CSSProperties = {
    border: "1px solid #ddd", borderRadius: 6, fontSize: 12,
    padding: "4px 8px", background: "#fff", width: "100%",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 14, padding: 24,
        maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: GREEN_DARK }}>⚙ Horarios de turnos</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#999" }}>×</button>
        </div>

        <div style={{ fontSize: 11, color: "#888", marginBottom: 16 }}>
          Edita los horarios de cada turno. Los cambios afectan al planning de toda la semana.
        </div>

        {drafts.map(d => {
          const colors = TURNO_COLORS[d.turno];
          return (
            <div key={d.turno} style={{
              background: colors.bg, borderRadius: 10, padding: "12px 16px",
              marginBottom: 10, border: `1px solid ${colors.color}22`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontWeight: 700, color: colors.color, fontSize: 13 }}>
                  {TURNO_SHORT[d.turno]} · {TURNO_LABELS[d.turno].split("·")[0].trim()}
                </span>
                <button
                  onClick={() => handleSave(d.turno)}
                  disabled={saving === d.turno}
                  style={{
                    background: GREEN, color: "#fff", border: "none", borderRadius: 6,
                    padding: "4px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  }}
                >
                  {saving === d.turno ? "…" : "Guardar"}
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9, color: "#666", marginBottom: 3 }}>Entrada A</div>
                  <input type="time" step={1800} value={hhToTimeLocal(d.ia)}
                    onChange={e => setField(d.turno, "ia", timeToHhLocal(e.target.value))}
                    style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#666", marginBottom: 3 }}>Salida A</div>
                  <input type="time" step={1800} value={hhToTimeLocal(d.fa)}
                    onChange={e => setField(d.turno, "fa", timeToHhLocal(e.target.value))}
                    style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#666", marginBottom: 3 }}>Entrada B</div>
                  <input type="time" step={1800} value={hhToTimeLocal(d.ib ?? null)}
                    onChange={e => setField(d.turno, "ib", timeToHhLocal(e.target.value) ?? null)}
                    style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#666", marginBottom: 3 }}>Salida B</div>
                  <input type="time" step={1800} value={hhToTimeLocal(d.fb ?? null)}
                    onChange={e => setField(d.turno, "fb", timeToHhLocal(e.target.value) ?? null)}
                    style={inp} />
                </div>
              </div>
              <div style={{ fontSize: 9, color: colors.color, marginTop: 6 }}>
                {hhToLabel(d.ia)}–{hhToLabel(d.fa)}{d.ib && d.fb ? ` / ${hhToLabel(d.ib)}–${hhToLabel(d.fb)}` : ""}
              </div>
            </div>
          );
        })}

        {error && (
          <div style={{ background: "#fef2f2", color: "#c0392b", padding: "8px 12px", borderRadius: 6, fontSize: 12, marginTop: 8 }}>{error}</div>
        )}
      </div>
    </div>
  );
}

// ── Vista de horarios de todo el equipo ───────────────────────────────────────

function HorariosTab({ empleados, asignaciones, week, onChangeWeek, onSaveAsignacion }: {
  empleados: Empleado[];
  asignaciones: HorarioAsignacion[];
  week: string;
  onChangeWeek: (w: string) => void;
  onSaveAsignacion: (empId: string, turno: number) => Promise<void>;
}) {
  const activos = empleados.filter(e => e.activo !== 0);

  const getAsignacion = (empId: string): number => {
    const override = asignaciones.find(a => a.empleado_id === empId && a.week_start === week);
    if (override) return override.turno;
    if (EMPLEADOS_ESPECIALES.includes(empId)) return 0;
    return getTurnoForWeek(empId, week);
  };

  const [saving, setSaving] = useState<string | null>(null);
  const [showTurnoEditor, setShowTurnoEditor] = useState(false);
  const [turnosConfig, setTurnosConfig] = useState<TurnoConfig[]>([]);

  useEffect(() => {
    fetch("/api/rrhh/turnos-config")
      .then(r => r.json())
      .then(d => {
        if (d.ok && d.turnos?.length) {
          setTurnosConfig(d.turnos.map((t: { turno: number; inicio_a: number; fin_a: number; inicio_b: number | null; fin_b: number | null }) => ({
            turno: t.turno, ia: t.inicio_a, fa: t.fin_a, ib: t.inicio_b, fb: t.fin_b,
          })));
        }
      })
      .catch(() => undefined);
  }, []);

  const handleSaveTurno = async (cfg: TurnoConfig) => {
    const r = await fetch("/api/rrhh/turnos-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turno: cfg.turno, inicio_a: cfg.ia, fin_a: cfg.fa, inicio_b: cfg.ib ?? null, fin_b: cfg.fb ?? null }),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error ?? "Error al guardar");
    setTurnosConfig(prev => prev.map(t => t.turno === cfg.turno ? cfg : t));
  };

  const handleChangeTurno = async (empId: string, turno: number) => {
    setSaving(empId);
    await onSaveAsignacion(empId, turno);
    setSaving(null);
  };

  const isCurrentWeek = week === getWeekStart(new Date());

  const inp: React.CSSProperties = {
    border: "none", background: "none", fontSize: 11, color: "#555",
    cursor: "default", width: "100%",
  };

  return (
    <div>
      {showTurnoEditor && turnosConfig.length > 0 && (
        <TurnoEditorModal
          turnos={turnosConfig}
          onSave={handleSaveTurno}
          onClose={() => setShowTurnoEditor(false)}
        />
      )}

      {/* Navegación de semana */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button onClick={() => onChangeWeek(addWeeks(week, -1))} style={{ background: GREEN_LIGHT, border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: GREEN_DARK, fontSize: 14, fontWeight: 700 }}>◀</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: GREEN_DARK }}>{fmtWeek(week)}</div>
          {isCurrentWeek && <div style={{ fontSize: 10, color: GREEN, fontWeight: 600 }}>Semana actual</div>}
        </div>
        <button onClick={() => onChangeWeek(addWeeks(week, 1))} style={{ background: GREEN_LIGHT, border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: GREEN_DARK, fontSize: 14, fontWeight: 700 }}>▶</button>
        {!isCurrentWeek && (
          <button onClick={() => onChangeWeek(getWeekStart(new Date()))} style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Hoy</button>
        )}
        <button
          onClick={() => setShowTurnoEditor(true)}
          title="Editar horarios de turnos"
          style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 14 }}
        >⚙</button>
      </div>

      {/* Tabla de todos los empleados */}
      <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
        <div style={{ background: GREEN, padding: "8px 16px", display: "grid", gridTemplateColumns: "1.2fr 0.8fr 2fr", gap: 8 }}>
          {["Empleado/a", "Turno / selector", "Horario"].map(h => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>
          ))}
        </div>

        {activos.map((emp, i) => {
          const isRotativo = EMPLEADOS_ROTATIVOS.includes(emp.id);
          const isEspecial = EMPLEADOS_ESPECIALES.includes(emp.id);
          const turno      = isRotativo || isEspecial ? getAsignacion(emp.id) : -1;
          const colors     = turno >= 0 ? (TURNO_COLORS[turno] ?? TURNO_COLORS[1]) : { bg: "#f9fafb", color: "#555" };
          const horarioTxt = turno >= 0 ? TURNO_LABELS[turno] : (HORARIO_TEXTO[emp.id] ?? "—");

          return (
            <div key={emp.id} style={{
              display: "grid", gridTemplateColumns: "1.2fr 0.8fr 2fr", gap: 8,
              padding: "10px 16px", alignItems: "center",
              background: i % 2 === 0 ? "#fff" : "#f9fafb",
              borderBottom: "1px solid #f0f0f0",
            }}>
              {/* Nombre */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: emp.farmaceutico ? GREEN : "#9ca3af",
                }} />
                <span style={{ fontSize: 12, fontWeight: emp.farmaceutico ? 700 : 500, color: "#2a2e2b" }}>
                  {emp.nombre}
                </span>
                {emp.empresa === "mirelus" && (
                  <span style={{ fontSize: 8, color: "#9ca3af", background: "#f3f4f6", padding: "1px 4px", borderRadius: 4 }}>ext.</span>
                )}
              </div>

              {/* Selector de turno (rotativos) o badge fijo */}
              <div>
                {isRotativo && (
                  <>
                    <select
                      value={turno}
                      disabled={saving === emp.id}
                      onChange={e => handleChangeTurno(emp.id, parseInt(e.target.value))}
                      style={{
                        border: `1px solid ${colors.color}`, borderRadius: 6,
                        padding: "3px 8px", fontSize: 12, fontWeight: 700,
                        background: colors.bg, color: colors.color, cursor: "pointer",
                      }}
                    >
                      {[1, 2, 3].map(t => (
                        <option key={t} value={t}>{TURNO_SHORT[t]}</option>
                      ))}
                    </select>
                    {saving === emp.id && <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>…</span>}
                  </>
                )}
                {isEspecial && (
                  <span style={{ ...TURNO_COLORS[0], padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                    {TURNO_SHORT[0]}
                  </span>
                )}
                {!isRotativo && !isEspecial && (
                  <span style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic" }}>fijo</span>
                )}
              </div>

              {/* Horario texto */}
              <div style={{ ...inp }}>{horarioTxt}</div>
            </div>
          );
        })}
      </div>

      {/* Info rotación */}
      <div style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 8, fontSize: 10, color: "#888" }}>
        <strong>Rotación:</strong> T1 → T2 → T3 → T1 (ciclo de 3 semanas) · Semana ancla: {ANCHOR_WEEK}
        <br />
        Cambiar el selector sobreescribe la rotación automática para esa semana.
        Los valores sin cambios siguen la rotación calculada.
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function EquipoPage() {
  const [tab, setTab]             = useState<TabEquipo>("personal");
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [asignaciones, setAsignaciones] = useState<HorarioAsignacion[]>([]);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [showNuevo, setShowNuevo] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [week, setWeek]           = useState(() => getWeekStart(new Date()));

  const loadEmpleados = useCallback(async (inactivos = mostrarInactivos) => {
    // Auto-migrate versionado: si la versión de datos cambió, re-sincronizar
    // v7 (sesión 5, 2026-04-06): 8 campos nuevos de nómina + alta Dolores.
    // Bumpear este valor cada vez que cambien las columnas o el seed de rrhh_empleados.
    const MIGRATE_KEY = "rrhh_migrate_v7";
    if (typeof window !== "undefined" && !localStorage.getItem(MIGRATE_KEY)) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        await fetch("/api/rrhh/migrate", { method: "POST", signal: ctrl.signal });
        clearTimeout(t);
      } catch { /* silencioso — timeout o error no bloquea la carga */ } finally {
        localStorage.setItem(MIGRATE_KEY, "1"); // siempre marcar para no reintentar
      }
    }
    const r = await fetch(`/api/rrhh/empleados${inactivos ? "?incluir_inactivos=1" : ""}`).then(r => r.json());
    if (r.ok) {
      setEmpleados(r.empleados);
    } else {
      setError(r.error);
    }
  }, [mostrarInactivos]);

  const loadHorarios = useCallback(async (w: string) => {
    const r = await fetch(`/api/rrhh/horarios?week=${w}&weeks=1`).then(r => r.json());
    if (r.ok) setAsignaciones(r.asignaciones);
  }, []);

  useEffect(() => {
    Promise.all([
      loadEmpleados(),
      loadHorarios(week),
    ]).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChangeWeek = async (newWeek: string) => {
    setWeek(newWeek);
    await loadHorarios(newWeek);
  };

  const handleUpdate = async (id: string, fields: Partial<Empleado>) => {
    const res  = await fetch("/api/rrhh/empleados", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? `Error ${res.status}`);
    // Actualizar el empleado en el estado local inmediatamente con los datos devueltos
    if (data.empleado) {
      setEmpleados(prev => prev.map(e => e.id === id ? { ...e, ...data.empleado } : e));
    } else {
      await loadEmpleados();
    }
  };

  const handleBaja = async (id: string) => {
    const emp = empleados.find(e => e.id === id);
    if (!emp) return;
    if (!confirm(`¿Dar de baja a ${emp.nombre}? No se borrará su historial.`)) return;
    await fetch("/api/rrhh/empleados", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, activo: 0 }),
    });
    await loadEmpleados();
  };

  const handleAlta = async (data: Partial<Empleado> & { id: string; nombre: string }) => {
    const res = await fetch("/api/rrhh/empleados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "Error al crear empleado");
    await loadEmpleados();
  };

  const handleSaveAsignacion = async (empId: string, turno: number) => {
    await fetch("/api/rrhh/horarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: week, empleado_id: empId, turno }),
    });
    await loadHorarios(week);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
        <div style={{ color: GREEN_DARK, fontSize: 14 }}>Cargando equipo…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, background: "#fef2f2", borderRadius: 8, color: "#c0392b" }}>
        <strong>Error:</strong> {error}
        <p style={{ fontSize: 11, marginTop: 8 }}>
          ¿Se han creado las tablas? Llama a <code>POST /api/rrhh/migrate</code> primero.
        </p>
      </div>
    );
  }

  const activos   = empleados.filter(e => e.activo !== 0);
  const inactivos = empleados.filter(e => e.activo === 0);
  const reigActivos   = activos.filter(e => e.empresa === "reig");
  const miRelusActivos = activos.filter(e => e.empresa === "mirelus");

  const total      = activos.length;
  const farmas     = activos.filter(e => e.farmaceutico === 1).length;
  const auxiliares = activos.filter(e => e.categoria === "auxiliar").length;
  const conGuardia = activos.filter(e => e.hace_guardia === 1).length;

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 960, margin: "0 auto" }}>
      {/* Título */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: GREEN_DARK, margin: 0 }}>
          Equipo — Farmacia Reig
        </h1>
        <p style={{ fontSize: 11, color: "#888", margin: "4px 0 0" }}>
          Personal activo · Categorías · Guardias · Horarios rotativos · 2026
        </p>
      </div>

      {/* Tarjetas KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {([
          ["Total personal",  total,      "#2a2e2b", "#f9fafb"],
          ["Farmacéuticos",   farmas,     GREEN_DARK, GREEN_LIGHT],
          ["Auxiliares",      auxiliares, "#1d4ed8",  "#eff6ff"],
          ["Hacen guardia",   conGuardia, GREEN,      GREEN_LIGHT],
        ] as [string, number, string, string][]).map(([label, value, color, bg]) => (
          <div key={label} style={{ background: bg, borderRadius: 10, padding: "14px 16px", borderLeft: `4px solid ${color}` }}>
            <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["personal", "horarios"] as TabEquipo[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13,
            fontWeight: tab === t ? 700 : 400,
            background: tab === t ? GREEN : GREEN_LIGHT,
            color: tab === t ? "#fff" : GREEN_DARK,
          }}>
            {t === "personal" ? "👥 Personal" : "📅 Horarios"}
          </button>
        ))}
      </div>

      {/* ── TAB PERSONAL ── */}
      {tab === "personal" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#888" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={mostrarInactivos}
                  onChange={async e => {
                    setMostrarInactivos(e.target.checked);
                    await loadEmpleados(e.target.checked);
                  }}
                />
                Mostrar empleados de baja
              </label>
            </div>
            <button
              onClick={() => setShowNuevo(true)}
              style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
            >
              + Alta empleado
            </button>
          </div>

          {/* Lista de empleados */}
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20, overflow: "hidden" }}>

            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, padding: "6px 16px 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Farmacia Reig</div>
              {reigActivos.map((emp, i) => (
                <EmpleadoRow key={emp.id} emp={emp} index={i} onUpdate={handleUpdate} onBaja={handleBaja} />
              ))}
            </div>

            {miRelusActivos.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", padding: "6px 16px 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Mirelus · Servicios externos</div>
                {miRelusActivos.map((emp, i) => (
                  <EmpleadoRow key={emp.id} emp={emp} index={i} onUpdate={handleUpdate} onBaja={handleBaja} />
                ))}
              </div>
            )}

            {mostrarInactivos && inactivos.length > 0 && (
              <div style={{ borderTop: "2px solid #f0f0f0", opacity: 0.65 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#c0392b", padding: "6px 16px 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Baja / Inactivos</div>
                {inactivos.map((emp, i) => (
                  <div key={emp.id} style={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1.8fr 0.9fr 0.6fr 0.8fr 0.8fr 0.7fr",
                    padding: "8px 16px", alignItems: "center",
                    background: i % 2 === 0 ? "#fff" : "#f9fafb",
                    borderBottom: "1px solid #f0f0f0", minWidth: 620,
                  }}>
                    <div style={{ fontSize: 12, color: "#aaa", textDecoration: "line-through" }}>{emp.nombre}</div>
                    <div style={{ fontSize: 11, color: "#ccc" }}>{CATEGORIA_LABEL[emp.categoria] ?? emp.categoria}</div>
                    <div style={{ fontSize: 11, color: "#ccc" }}>{JORNADA_ESPECIAL[emp.id] ?? (CATEGORIA_JORNADA[emp.categoria] ?? "—")}</div>
                    <div />
                    <div style={{ fontSize: 11, color: "#ccc" }}>—</div>
                    <div style={{ fontSize: 11, color: "#ccc" }}>—</div>
                    <button
                      onClick={() => handleUpdate(emp.id, { activo: 1 })}
                      style={{ background: GREEN_LIGHT, color: GREEN, border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 10 }}
                    >
                      Reactivar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leyenda */}
          <div style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 8, fontSize: 10, color: "#888", display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span><strong>Compl. €</strong> = Complemento salarial por guardia</span>
            <span><strong>h/Guardia</strong> = Horas de convenio por guardia laborable</span>
            <span>Auxiliares: 40h/sem · Zuleica: 4h/día + 4h extra viernes</span>
            <span>Clic en ✎ para editar complementos · ✗ para dar de baja</span>
          </div>
        </div>
      )}

      {/* ── TAB HORARIOS ── */}
      {tab === "horarios" && (
        <HorariosTab
          empleados={empleados.filter(e => e.activo !== 0 && e.empresa === "reig"
            && (EMPLEADOS_ROTATIVOS.includes(e.id) || EMPLEADOS_ESPECIALES.includes(e.id)))}
          asignaciones={asignaciones}
          week={week}
          onChangeWeek={handleChangeWeek}
          onSaveAsignacion={handleSaveAsignacion}
        />
      )}

      {/* Modal alta */}
      {showNuevo && (
        <NuevoEmpleadoModal onSave={handleAlta} onClose={() => setShowNuevo(false)} />
      )}
    </div>
  );
}
