"use client";

import { useState } from "react";
import { Empleado, Vacacion, GREEN, GREEN_DARK, GREEN_LIGHT, fmtDate, daysBetween } from "./types";

interface Props {
  empleados: Empleado[];
  vacaciones: Vacacion[];
  onAddVacacion: (empId: string, desde: string, hasta: string, estado: string) => Promise<void>;
  onUpdateEstado: (id: number, estado: string) => Promise<void>;
  onDeleteVacacion: (id: number) => Promise<void>;
}

const STATUS_COLOR: Record<string, string> = { done: GREEN, conf: "#3b82f6", pend: "#f59e0b" };
const STATUS_LABEL: Record<string, string> = { done: "Disfrutado", conf: "Confirmado", pend: "Pendiente" };

function VacStats(vacs: Vacacion[]) {
  const done = vacs.filter(v => v.estado === "done").reduce((a, v) => a + daysBetween(v.fecha_inicio, v.fecha_fin), 0);
  const conf = vacs.filter(v => v.estado === "conf").reduce((a, v) => a + daysBetween(v.fecha_inicio, v.fecha_fin), 0);
  const pend = vacs.filter(v => v.estado === "pend").reduce((a, v) => a + daysBetween(v.fecha_inicio, v.fecha_fin), 0);
  return { done, conf, pend, avail: 30 - done - conf - pend };
}

export default function VacacionesTab({ empleados, vacaciones, onAddVacacion, onUpdateEstado, onDeleteVacacion }: Props) {
  const [selEmp, setSelEmp] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [estado, setEstado] = useState("pend");
  const [saving, setSaving] = useState(false);

  // Lista de empleados con guardia (los relevantes)
  const empConGuardia = empleados.filter(e => e.hace_guardia || e.complemento_eur > 0 || ["ovidio","bea","maria","julio","celia"].includes(e.id));
  const pendientes = vacaciones.filter(v => v.estado === "pend");

  const handleAdd = async () => {
    if (!selEmp || !desde || !hasta) return;
    setSaving(true);
    await onAddVacacion(selEmp, desde, hasta, estado);
    setDesde(""); setHasta(""); setShowAdd(false);
    setSaving(false);
  };

  if (selEmp) {
    const emp = empleados.find(e => e.id === selEmp)!;
    const empVacs = vacaciones.filter(v => v.empleado_id === selEmp);
    const st = VacStats(empVacs);

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

        {/* Contadores */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 10 }}>
          {([["Total", 30, "#333"], ["Disfrutados", st.done, GREEN], ["Confirmados", st.conf, "#3b82f6"], ["Pendientes", st.pend, "#f59e0b"], ["Disponibles", st.avail, st.avail <= 5 ? "#ef4444" : "#333"]] as [string, number, string][]).map(([l, v, c]) => (
            <div key={l} style={{ textAlign: "center", padding: "8px 4px", background: "#f9fafb", borderRadius: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: "'JetBrains Mono', monospace" }}>{v}</div>
              <div style={{ fontSize: 8, color: "#999", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Barra progreso */}
        <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "#eee", marginBottom: 14 }}>
          <div style={{ width: `${(st.done / 30) * 100}%`, background: GREEN }} />
          <div style={{ width: `${(st.conf / 30) * 100}%`, background: "#3b82f6" }} />
          <div style={{ width: `${(st.pend / 30) * 100}%`, background: "#f59e0b" }} />
        </div>

        {/* Añadir vacaciones */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: GREEN_DARK }}>Períodos de vacaciones</div>
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
              <select value={estado} onChange={e => setEstado(e.target.value)}
                style={{ border: "1px solid #ddd", borderRadius: 4, padding: "3px 6px", fontSize: 10 }}>
                <option value="pend">Pedidas</option>
                <option value="conf">Confirmadas</option>
                <option value="done">Disfrutadas</option>
              </select>
              <button onClick={handleAdd} disabled={saving || !desde || !hasta}
                style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>
                {saving ? "…" : "Guardar"}
              </button>
            </div>
          </div>
        )}

        {empVacs.length === 0 && (
          <p style={{ fontSize: 11, color: "#aaa", fontStyle: "italic" }}>Sin vacaciones registradas</p>
        )}

        {empVacs.map(v => (
          <div key={v.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "6px 10px", borderLeft: `3px solid ${STATUS_COLOR[v.estado]}`,
            background: "#fff", borderRadius: "0 6px 6px 0", marginBottom: 4,
            border: `1px solid #f0f0f0`, borderLeftWidth: 3, borderLeftColor: STATUS_COLOR[v.estado],
          }}>
            <span style={{ fontSize: 11 }}>
              {fmtDate(v.fecha_inicio)} — {fmtDate(v.fecha_fin)}
              <span style={{ fontSize: 9, color: "#888", marginLeft: 6 }}>({daysBetween(v.fecha_inicio, v.fecha_fin)}d)</span>
            </span>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: STATUS_COLOR[v.estado] }}>{STATUS_LABEL[v.estado]}</span>
              {v.estado === "pend" && (
                <button onClick={() => onUpdateEstado(v.id, "conf")}
                  style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 9 }}>✓</button>
              )}
              <button onClick={() => onDeleteVacacion(v.id)}
                style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #ef4444", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 9 }}>✗</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Vista general
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: GREEN_DARK, marginBottom: 12 }}>Vacaciones 2026</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
        {empConGuardia.map(emp => {
          const empVacs = vacaciones.filter(v => v.empleado_id === emp.id);
          const st = VacStats(empVacs);
          return (
            <div
              key={emp.id}
              onClick={() => setSelEmp(emp.id)}
              style={{
                background: "#fff", borderRadius: 8, padding: "8px 10px", cursor: "pointer",
                border: `1px solid ${emp.farmaceutico ? GREEN : "#e5e7eb"}`,
                borderLeft: `4px solid ${emp.farmaceutico ? GREEN : "#d1d5db"}`,
                transition: "box-shadow 0.15s",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 12, color: emp.farmaceutico ? GREEN_DARK : "#333", marginBottom: 4 }}>{emp.nombre}</div>
              {([["Disfrut.", st.done, GREEN], ["Confirm.", st.conf, "#3b82f6"], ["Pend.", st.pend, "#f59e0b"], ["Disponib.", st.avail, st.avail <= 5 ? "#ef4444" : "#555"]] as [string, number, string][]).map(([l, v, c]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 9, lineHeight: 1.6 }}>
                  <span style={{ color: "#888" }}>{l}</span>
                  <span style={{ fontWeight: 600, color: c }}>{v}</span>
                </div>
              ))}
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
