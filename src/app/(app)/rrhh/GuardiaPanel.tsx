"use client";

import { useState } from "react";
import { GuardiaSlot, Guardia, Vacacion, GREEN, GREEN_DARK, GREEN_LIGHT } from "./types";

interface Props {
  guardia: Guardia;
  slots: GuardiaSlot[];
  vacaciones: Vacacion[];
  onClose: () => void;
  onSave: (slots: GuardiaSlot[], tipo: string, publicada: number) => void;
}

const HORAS_GRID = Array.from({ length: 16 }, (_, i) => i + 8); // 8..23
const HRS24 = Array.from({ length: 24 }, (_, i) => i);
const HRS34 = Array.from({ length: 26 }, (_, i) => i + 8); // 8..33

function fmtHora(h: number) {
  if (h > 23) return `${String(h - 24).padStart(2, "0")}:00+1`;
  return `${String(h).padStart(2, "0")}:00`;
}

export default function GuardiaPanel({ guardia, slots: initSlots, vacaciones, onClose, onSave }: Props) {
  const [tipo, setTipo] = useState<string>(guardia.tipo);
  const [slots, setSlots] = useState<GuardiaSlot[]>(initSlots);
  const [saving, setSaving] = useState(false);

  const fecha = new Date(guardia.fecha + "T00:00:00");
  const fechaLabel = fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // IDs de personas de vacaciones ese día
  const vacIds = new Set(
    vacaciones
      .filter(v => guardia.fecha >= v.fecha_inicio && guardia.fecha <= v.fecha_fin)
      .map(v => v.empleado_id)
  );

  const updateSlot = (empId: string, field: "hora_inicio" | "hora_fin", val: number) => {
    setSlots(prev => prev.map(s => s.empleado_id === empId ? { ...s, [field]: val } : s));
  };

  // Cobertura por hora
  const cobertura = HORAS_GRID.map(h =>
    slots.filter(s => !vacIds.has(s.empleado_id) && h >= s.hora_inicio && h < Math.min(s.hora_fin, 24)).length
  );
  const maxCob = Math.max(...cobertura, 1);

  // Validación farmacéutico
  const hasFarma = slots.some(s => s.farmaceutico === 1 && !vacIds.has(s.empleado_id));

  const handleSave = async (pub: number) => {
    setSaving(true);
    await onSave(slots, tipo, pub);
    setSaving(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }}>
      <div style={{
        background: "#fff", borderRadius: 14, padding: 20,
        maxWidth: 700, width: "100%", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: GREEN_DARK, textTransform: "capitalize" }}>{fechaLabel}</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Plantilla de guardia</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setTipo(t => t === "lab" ? "fest" : "lab")}
              style={{
                padding: "4px 12px", borderRadius: 20, border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 10,
                background: tipo === "lab" ? GREEN_LIGHT : "#fdecea",
                color: tipo === "lab" ? GREEN_DARK : "#c0392b",
              }}
            >
              {tipo === "lab" ? "⚙ LABORABLE" : "🎉 FESTIVO"}
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#999", lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Slots */}
        <div style={{ marginBottom: 8 }}>
          {/* Header horas */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, paddingLeft: 130 }}>
            {HORAS_GRID.map(h => (
              <div key={h} style={{ flex: 1, textAlign: "center", fontSize: 7, color: "#bbb", fontFamily: "'JetBrains Mono', monospace" }}>{h}</div>
            ))}
            <div style={{ width: 30 }} />
          </div>

          {slots.map(slot => {
            const isVac = vacIds.has(slot.empleado_id);
            const isFarma = slot.farmaceutico === 1;
            const totalH = slot.hora_fin - slot.hora_inicio;

            return (
              <div key={slot.empleado_id} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 0", borderBottom: "1px solid #f5f5f5",
                opacity: isVac ? 0.5 : 1,
              }}>
                {/* Nombre */}
                <div style={{
                  width: 72, fontSize: 10, fontWeight: isFarma ? 700 : 400,
                  color: isVac ? "#ccc" : isFarma ? GREEN_DARK : "#333",
                  textDecoration: isVac ? "line-through" : "none",
                  flexShrink: 0,
                }}>
                  {slot.nombre}
                  {isVac && <span style={{ color: "#ef4444", fontSize: 7, marginLeft: 2 }}>VAC</span>}
                  {slot.empresa === "mirelus" && (
                    <span style={{ fontSize: 7, background: "#a9d18e", padding: "0 3px", borderRadius: 2, marginLeft: 3 }}>M</span>
                  )}
                </div>

                {/* Hora inicio */}
                <select
                  value={slot.hora_inicio}
                  onChange={e => updateSlot(slot.empleado_id, "hora_inicio", parseInt(e.target.value))}
                  disabled={isVac}
                  style={{
                    width: 52, border: "1px solid #ddd", borderRadius: 4,
                    fontSize: 9, padding: "2px 0", textAlign: "center",
                    background: isVac ? "#f5f5f5" : "#fff",
                    color: isVac ? "#ccc" : "#333",
                    flexShrink: 0,
                  }}
                >
                  {HRS24.map(h => <option key={h} value={h}>{fmtHora(h)}</option>)}
                </select>

                <span style={{ color: "#ccc", fontSize: 9, flexShrink: 0 }}>→</span>

                {/* Hora fin */}
                <select
                  value={slot.hora_fin}
                  onChange={e => updateSlot(slot.empleado_id, "hora_fin", parseInt(e.target.value))}
                  disabled={isVac}
                  style={{
                    width: 60, border: "1px solid #ddd", borderRadius: 4,
                    fontSize: 9, padding: "2px 0", textAlign: "center",
                    background: isVac ? "#f5f5f5" : "#fff",
                    color: isVac ? "#ccc" : "#333",
                    flexShrink: 0,
                  }}
                >
                  {HRS34.map(h => <option key={h} value={h}>{fmtHora(h)}</option>)}
                </select>

                {/* Barra visual */}
                <div style={{ display: "flex", flex: 1, gap: 1 }}>
                  {HORAS_GRID.map(h => {
                    const active = h >= slot.hora_inicio && h < Math.min(slot.hora_fin, 24);
                    return (
                      <div key={h} style={{
                        flex: 1, height: 16, borderRadius: 2,
                        background: isVac ? "#f0f0f0" : active ? (h >= 22 ? GREEN_DARK : GREEN) : "#f0f0f0",
                        border: isFarma && active && !isVac ? `2px solid #0a4a1e` : "none",
                        boxSizing: "border-box" as const,
                      }} />
                    );
                  })}
                </div>

                {/* Horas totales */}
                <div style={{ width: 24, textAlign: "center", fontSize: 11, fontWeight: 600, color: isVac ? "#ddd" : "#333", flexShrink: 0 }}>
                  {isVac ? "—" : totalH}
                </div>
              </div>
            );
          })}
        </div>

        {/* Validación farmacéutico */}
        <div style={{
          padding: "5px 10px", borderRadius: 6, marginBottom: 10,
          background: hasFarma ? GREEN_LIGHT : "#fdecea",
          color: hasFarma ? GREEN_DARK : "#c0392b",
          fontWeight: 700, fontSize: 10,
        }}>
          {hasFarma ? "✓ Farmacéutico cubierto" : "✗ ¡FALTA FARMACÉUTICO!"}
        </div>

        {/* Gráfico cobertura */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: GREEN_DARK, marginBottom: 4 }}>Cobertura por hora</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 48 }}>
            {HORAS_GRID.map((h, i) => (
              <div key={h} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: GREEN_DARK, marginBottom: 2 }}>{cobertura[i]}</div>
                <div style={{
                  height: `${(cobertura[i] / maxCob) * 32}px`,
                  borderRadius: "2px 2px 0 0",
                  background: h >= 22 ? GREEN_DARK : cobertura[i] <= 1 ? "#ef4444" : cobertura[i] <= 2 ? "#f59e0b" : GREEN,
                  minHeight: cobertura[i] > 0 ? 4 : 0,
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
            {HORAS_GRID.map(h => (
              <div key={h} style={{ flex: 1, textAlign: "center", fontSize: 7, color: "#bbb", fontFamily: "'JetBrains Mono', monospace" }}>{h}</div>
            ))}
          </div>
        </div>

        {/* Botones */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => handleSave(guardia.publicada)}
            disabled={saving}
            style={{
              background: GREEN, color: "#fff", border: "none", borderRadius: 8,
              padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 600,
            }}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          <button
            onClick={() => handleSave(1)}
            disabled={saving || !hasFarma}
            style={{
              background: hasFarma ? "#fff" : "#f5f5f5",
              color: hasFarma ? GREEN : "#ccc",
              border: `2px solid ${hasFarma ? GREEN : "#ddd"}`,
              borderRadius: 8, padding: "8px 16px", cursor: hasFarma ? "pointer" : "not-allowed",
              fontSize: 12, fontWeight: 600,
            }}
          >
            {guardia.publicada ? "✓ Publicada" : "Publicar"}
          </button>
          <button
            onClick={onClose}
            style={{
              background: "#f5f5f5", color: "#666", border: "none",
              borderRadius: 8, padding: "8px 16px", cursor: "pointer",
              fontSize: 12, fontWeight: 600, marginLeft: "auto",
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
