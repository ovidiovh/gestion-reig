"use client";

import { useState } from "react";
import { Empleado, Vacacion, GuardiaStats, GREEN, GREEN_DARK, fmtDate, daysBetween } from "./types";

interface Props {
  empleados: Empleado[];
  vacaciones: Vacacion[];
  guardiaStats: GuardiaStats[];
  onAddVacacion: (empId: string, desde: string, hasta: string, estado: string, tipo: string) => Promise<void>;
  onUpdateEstado: (id: number, estado: string) => Promise<void>;
  onDeleteVacacion: (id: number) => Promise<void>;
  onUpdateGuardiasManual: (empId: string, value: number | null) => Promise<void>;
}

const STATUS_COLOR: Record<string, string> = { done: GREEN, conf: "#3b82f6", pend: "#f59e0b" };
const STATUS_LABEL: Record<string, string> = { done: "Disfrutado", conf: "Confirmado", pend: "Pendiente" };

function VacStats(vacs: Vacacion[]) {
  const vacOnly = vacs.filter(v => v.tipo !== "comp");
  const done = vacOnly.filter(v => v.estado === "done").reduce((a, v) => a + daysBetween(v.fecha_inicio, v.fecha_fin), 0);
  const conf = vacOnly.filter(v => v.estado === "conf").reduce((a, v) => a + daysBetween(v.fecha_inicio, v.fecha_fin), 0);
  const pend = vacOnly.filter(v => v.estado === "pend").reduce((a, v) => a + daysBetween(v.fecha_inicio, v.fecha_fin), 0);
  return { done, conf, pend, avail: 30 - done - conf - pend };
}

function CompStats(vacs: Vacacion[], guardias: number) {
  const compUsed = vacs
    .filter(v => v.tipo === "comp")
    .reduce((a, v) => a + daysBetween(v.fecha_inicio, v.fecha_fin), 0);
  return { guardias, earned: guardias, used: compUsed, balance: guardias - compUsed };
}

/** Devuelve el número efectivo de guardias: manual si está fijado, calculado si no */
function effectiveGuardias(stat: GuardiaStats | undefined): number {
  if (!stat) return 0;
  return stat.guardias_manual !== null && stat.guardias_manual !== undefined
    ? stat.guardias_manual
    : stat.guardias_hechas;
}

// ── Subcomponente: editor inline del contador de guardias ─────────────────────

function GuardiasEditor({ stat, onSave }: {
  stat: GuardiaStats | undefined;
  onSave: (value: number | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState<string>("");
  const [saving, setSaving]   = useState(false);

  const computed  = stat?.guardias_hechas ?? 0;
  const manual    = stat?.guardias_manual ?? null;
  const effective = effectiveGuardias(stat);
  const isOverride = manual !== null && manual !== undefined;

  const startEdit = () => {
    setDraft(String(effective));
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const parsed = parseInt(draft);
    if (!isNaN(parsed) && parsed >= 0) {
      await onSave(parsed);
    }
    setSaving(false);
    setEditing(false);
  };

  const handleReset = async () => {
    setSaving(true);
    await onSave(null); // null = volver al calculado
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#fffbeb", borderRadius: 8, border: "1px solid #fde68a" }}>
        <span style={{ fontSize: 11, color: "#555" }}>Guardias realizadas:</span>
        <input
          type="number"
          min={0}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          autoFocus
          style={{ width: 56, border: "1px solid #ddd", borderRadius: 4, padding: "3px 8px", fontSize: 14, fontWeight: 700, textAlign: "center" }}
        />
        <button onClick={handleSave} disabled={saving} style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 4, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
          {saving ? "…" : "Guardar"}
        </button>
        {isOverride && (
          <button onClick={handleReset} disabled={saving} style={{ background: "#f3f4f6", color: "#555", border: "none", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}
            title="Volver al valor calculado automáticamente">
            Restablecer
          </button>
        )}
        <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#aaa" }}>×</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#333", fontFamily: "'JetBrains Mono', monospace" }}>
        {effective}
      </div>
      {isOverride && (
        <span style={{ fontSize: 9, background: "#fef3c7", color: "#92400e", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>
          manual
        </span>
      )}
      {!isOverride && computed > 0 && (
        <span style={{ fontSize: 9, background: "#f0fdf4", color: "#166534", padding: "1px 5px", borderRadius: 4 }}>
          auto
        </span>
      )}
      <button
        onClick={startEdit}
        title="Editar número de guardias realizadas"
        style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 10, color: "#555" }}
      >
        ✎ editar
      </button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function VacacionesTab({
  empleados, vacaciones, guardiaStats,
  onAddVacacion, onUpdateEstado, onDeleteVacacion, onUpdateGuardiasManual,
}: Props) {
  const [selEmp, setSelEmp]   = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [desde, setDesde]     = useState("");
  const [hasta, setHasta]     = useState("");
  const [estado, setEstado]   = useState("pend");
  const [tipoAdd, setTipoAdd] = useState<"vac" | "comp">("vac");
  const [saving, setSaving]   = useState(false);

  const pendientes = vacaciones.filter(v => v.estado === "pend" && v.tipo !== "comp");

  const handleAdd = async () => {
    if (!selEmp || !desde || !hasta) return;
    setSaving(true);
    await onAddVacacion(selEmp, desde, hasta, estado, tipoAdd);
    setDesde(""); setHasta(""); setShowAdd(false);
    setSaving(false);
  };

  if (selEmp) {
    const emp = empleados.find(e => e.id === selEmp)!;
    const empVacs = vacaciones.filter(v => v.empleado_id === selEmp);
    const st = VacStats(empVacs);
    const stat = guardiaStats.find(g => g.empleado_id === selEmp);
    const guardCount = effectiveGuardias(stat);
    const comp = CompStats(empVacs, guardCount);
    const isFarma = emp.farmaceutico === 1;

    return (
      <div>
        <button
          onClick={() => { setSelEmp(null); setShowAdd(false); }}
          style={{ background: "#fff", color: GREEN, border: `1px solid ${GREEN}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 10, marginBottom: 12 }}
        >
          ← Volver
        </button>

        <div style={{ fontSize: 16, fontWeight: 700, color: GREEN_DARK, marginBottom: 10 }}>
          {emp.nombre}
          <span style={{ fontSize: 10, fontWeight: 400, color: "#999", marginLeft: 8 }}>
            {emp.farmaceutico ? "Farmacéutico/a" : "Auxiliar"}
            {emp.empresa === "mirelus" && <span style={{ marginLeft: 4, background: "#a9d18e", padding: "0 4px", borderRadius: 3, fontSize: 9 }}>Mirelus</span>}
          </span>
        </div>

        {/* Vacaciones ordinarias */}
        <div style={{ fontSize: 10, fontWeight: 600, color: "#666", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Vacaciones ordinarias (30 días)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 10 }}>
          {([
            ["Total",       30,       "#333"],
            ["Disfrutados", st.done,  GREEN],
            ["Confirmados", st.conf,  "#3b82f6"],
            ["Pedidos",     st.pend,  "#f59e0b"],
            ["Disponibles", st.avail, st.avail <= 5 ? "#ef4444" : "#333"],
          ] as [string, number, string][]).map(([l, v, c]) => (
            <div key={l} style={{ textAlign: "center", padding: "8px 4px", background: "#f9fafb", borderRadius: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: "'JetBrains Mono', monospace" }}>{v}</div>
              <div style={{ fontSize: 8, color: "#999", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Barra progreso */}
        <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "#eee", marginBottom: 16 }}>
          <div style={{ width: `${(st.done / 30) * 100}%`, background: GREEN }} />
          <div style={{ width: `${(st.conf / 30) * 100}%`, background: "#3b82f6" }} />
          <div style={{ width: `${(st.pend / 30) * 100}%`, background: "#f59e0b" }} />
        </div>

        {/* Compensatorios — solo farmacéuticos */}
        {isFarma && (
          <div style={{ padding: "14px 16px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: GREEN_DARK, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              Descansos compensatorios por guardia
            </div>

            {/* Editor de guardias realizadas */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>
                Guardias realizadas
                <span style={{ marginLeft: 6, color: "#9ca3af" }}>
                  (calculado automáticamente desde guardias pasadas; editable si hay discrepancia)
                </span>
              </div>
              <GuardiasEditor
                stat={stat}
                onSave={v => onUpdateGuardiasManual(selEmp, v)}
              />
            </div>

            {/* Cuadrícula balance */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {([
                ["Días ganados",  comp.earned,  GREEN],
                ["Días usados",   comp.used,    "#3b82f6"],
                ["Balance",       comp.balance, comp.balance < 0 ? "#ef4444" : comp.balance === 0 ? "#666" : GREEN],
              ] as [string, number, string][]).map(([l, v, c]) => (
                <div key={l} style={{ textAlign: "center", padding: "8px 4px", background: "#fff", borderRadius: 8, border: "1px solid #d1fae5" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c, fontFamily: "'JetBrains Mono', monospace" }}>{v}</div>
                  <div style={{ fontSize: 8, color: "#6b7280", marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 9, color: "#6b7280", marginTop: 8 }}>
              Cada guardia nocturna genera 1 día de descanso compensatorio. Registra los días usados con tipo «Comp.» abajo.
            </div>
          </div>
        )}

        {/* Añadir período */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: GREEN_DARK }}>Períodos registrados</div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 10, fontWeight: 600 }}
          >
            + Añadir
          </button>
        </div>

        {showAdd && (
          <div style={{ padding: 12, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" }}>
              {isFarma && (
                <select value={tipoAdd} onChange={e => setTipoAdd(e.target.value as "vac" | "comp")}
                  style={{ border: "1px solid #ddd", borderRadius: 4, padding: "3px 6px", fontSize: 10 }}>
                  <option value="vac">Vacaciones</option>
                  <option value="comp">Comp. guardia</option>
                </select>
              )}
              <label style={{ fontSize: 10, color: "#666" }}>
                Desde:&nbsp;
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                  style={{ border: "1px solid #ddd", borderRadius: 4, padding: "3px 6px", fontSize: 10 }} />
              </label>
              <label style={{ fontSize: 10, color: "#666" }}>
                Hasta:&nbsp;
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                  style={{ border: "1px solid #ddd", borderRadius: 4, padding: "3px 6px", fontSize: 10 }} />
              </label>
              {tipoAdd === "vac" && (
                <select value={estado} onChange={e => setEstado(e.target.value)}
                  style={{ border: "1px solid #ddd", borderRadius: 4, padding: "3px 6px", fontSize: 10 }}>
                  <option value="pend">Pedidas</option>
                  <option value="conf">Confirmadas</option>
                  <option value="done">Disfrutadas</option>
                </select>
              )}
              <button onClick={handleAdd} disabled={saving || !desde || !hasta}
                style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>
                {saving ? "…" : "Guardar"}
              </button>
            </div>
          </div>
        )}

        {empVacs.length === 0 && (
          <p style={{ fontSize: 11, color: "#aaa", fontStyle: "italic" }}>Sin períodos registrados</p>
        )}

        {/* Vacaciones ordinarias */}
        {empVacs.filter(v => v.tipo !== "comp").length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Vacaciones</div>
            {empVacs.filter(v => v.tipo !== "comp").map(v => (
              <VacRow key={v.id} v={v} onUpdate={onUpdateEstado} onDelete={onDeleteVacacion} />
            ))}
          </div>
        )}

        {/* Compensatorios */}
        {isFarma && empVacs.filter(v => v.tipo === "comp").length > 0 && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Compensatorios guardia</div>
            {empVacs.filter(v => v.tipo === "comp").map(v => (
              <VacRow key={v.id} v={v} onUpdate={onUpdateEstado} onDelete={onDeleteVacacion} isComp />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Vista general ──────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: GREEN_DARK, marginBottom: 12 }}>Vacaciones 2026</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
        {empleados.map(emp => {
          const empVacs  = vacaciones.filter(v => v.empleado_id === emp.id);
          const st       = VacStats(empVacs);
          const stat     = guardiaStats.find(g => g.empleado_id === emp.id);
          const guardCount = effectiveGuardias(stat);
          const comp     = CompStats(empVacs, guardCount);
          const isManual = stat && stat.guardias_manual !== null && stat.guardias_manual !== undefined;

          return (
            <div
              key={emp.id}
              onClick={() => setSelEmp(emp.id)}
              style={{
                background: "#fff", borderRadius: 8, padding: "8px 10px", cursor: "pointer",
                border: `1px solid ${emp.farmaceutico ? GREEN : "#e5e7eb"}`,
                borderLeft: `4px solid ${emp.farmaceutico ? GREEN : "#d1d5db"}`,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 12, color: emp.farmaceutico ? GREEN_DARK : "#333", marginBottom: 4 }}>{emp.nombre}</div>
              {([
                ["Disfrut.",  st.done,  GREEN],
                ["Confirm.",  st.conf,  "#3b82f6"],
                ["Pend.",     st.pend,  "#f59e0b"],
                ["Disponib.", st.avail, st.avail <= 5 ? "#ef4444" : "#555"],
              ] as [string, number, string][]).map(([l, v, c]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 9, lineHeight: 1.6 }}>
                  <span style={{ color: "#888" }}>{l}</span>
                  <span style={{ fontWeight: 600, color: c }}>{v}</span>
                </div>
              ))}
              {emp.farmaceutico === 1 && guardCount > 0 && (
                <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px dashed #d1fae5" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, lineHeight: 1.6 }}>
                    <span style={{ color: "#6b7280" }}>
                      Guard. {isManual ? <span style={{ color: "#92400e" }}>✎</span> : ""}
                    </span>
                    <span style={{ fontWeight: 600, color: GREEN }}>{guardCount}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, lineHeight: 1.6 }}>
                    <span style={{ color: "#6b7280" }}>Balance comp.</span>
                    <span style={{ fontWeight: 600, color: comp.balance < 0 ? "#ef4444" : "#555" }}>{comp.balance}</span>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", background: "#eee", marginTop: 4 }}>
                <div style={{ width: `${(st.done / 30) * 100}%`, background: GREEN }} />
                <div style={{ width: `${(st.conf / 30) * 100}%`, background: "#3b82f6" }} />
                <div style={{ width: `${(st.pend / 30) * 100}%`, background: "#f59e0b" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Pendientes de aprobar */}
      {pendientes.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: GREEN_DARK, marginBottom: 6 }}>Pendientes de aprobar</div>
          {pendientes.map(v => (
            <div key={v.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 10px", background: "#fffbeb", borderRadius: 6,
              borderLeft: "3px solid #f59e0b", marginBottom: 4,
            }}>
              <span style={{ fontSize: 11 }}>
                <b>{v.nombre}</b>{" "}
                {fmtDate(v.fecha_inicio)} — {fmtDate(v.fecha_fin)}
                <span style={{ fontSize: 9, color: "#888", marginLeft: 4 }}>({daysBetween(v.fecha_inicio, v.fecha_fin)}d)</span>
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => onUpdateEstado(v.id, "conf")}
                  style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontSize: 10 }}>✓</button>
                <button onClick={() => onDeleteVacacion(v.id)}
                  style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #ef4444", borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontSize: 10 }}>✗</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VacRow({ v, onUpdate, onDelete, isComp = false }: {
  v: Vacacion;
  onUpdate: (id: number, estado: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  isComp?: boolean;
}) {
  const color = isComp ? GREEN : STATUS_COLOR[v.estado];
  const label = isComp ? "Compensatorio" : STATUS_LABEL[v.estado];

  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 10px", background: "#fff", borderRadius: "0 6px 6px 0", marginBottom: 4,
      border: "1px solid #f0f0f0", borderLeftWidth: 3, borderLeftColor: color,
    }}>
      <span style={{ fontSize: 11 }}>
        {fmtDate(v.fecha_inicio)} — {fmtDate(v.fecha_fin)}
        <span style={{ fontSize: 9, color: "#888", marginLeft: 6 }}>({daysBetween(v.fecha_inicio, v.fecha_fin)}d)</span>
      </span>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: 9, fontWeight: 700, color }}>{label}</span>
        {!isComp && v.estado === "pend" && (
          <button onClick={() => onUpdate(v.id, "conf")}
            style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 9 }}>✓</button>
        )}
        <button onClick={() => onDelete(v.id)}
          style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #ef4444", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 9 }}>✗</button>
      </div>
    </div>
  );
}
