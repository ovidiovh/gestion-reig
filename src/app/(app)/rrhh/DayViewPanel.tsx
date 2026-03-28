"use client";

import { useState, useEffect } from "react";
import {
  Empleado, Festivo, Vacacion, HorarioAsignacion,
  GRID_START_HH, GRID_END_HH, GRID_COLS,
  TURNO_HORARIO, HORARIO_DEFAULT, hhToLabel,
  EMPLEADOS_ROTATIVOS, EMPLEADOS_ESPECIALES,
  getTurnoForWeek, getWeekStart,
  GREEN, GREEN_DARK, GREEN_LIGHT,
} from "./types";

// ── Colores por departamento ──────────────────────────────────────────────────

const DEPTO: Record<string, { bar: string; bg: string; label: string }> = {
  farmacia:  { bar: "#166534", bg: "#dcfce7", label: "Farmacia" },
  optica:    { bar: "#1d4ed8", bg: "#dbeafe", label: "Óptica" },
  ortopedia: { bar: "#b45309", bg: "#fef3c7", label: "Ortopedia" },
  otro:      { bar: "#6b7280", bg: "#f3f4f6", label: "Otros" },
};

// ── Helpers de posición ───────────────────────────────────────────────────────

const pct  = (hh: number) => `${((hh - GRID_START_HH) / GRID_COLS) * 100}%`;
const pctW = (a: number, b: number) => `${((b - a) / GRID_COLS) * 100}%`;

// ── Ticks del eje horario (cada ~2h + 20:30 final) ────────────────────────────

const TICKS = [17, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 41]
  .filter(hh => hh >= GRID_START_HH && hh <= GRID_END_HH);

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface GSlot {
  empleado_id: string;
  hora_inicio: number;
  hora_fin: number;
  hora_inicio2: number | null;
  hora_fin2: number | null;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function DayViewPanel({
  fecha,
  empleados,
  festivos,
  vacaciones,
  asignaciones,
  guardiaId,
  isGuardia,
  loadingGuardia,
  onOpenGuardia,
  onGoToVac,
  onClose,
}: {
  fecha: string;
  empleados: Empleado[];
  festivos: Festivo[];
  vacaciones: Vacacion[];
  asignaciones: HorarioAsignacion[];
  guardiaId: number | undefined;
  isGuardia: boolean;
  loadingGuardia: boolean;
  onOpenGuardia: () => void;
  onGoToVac: () => void;
  onClose: () => void;
}) {
  const [guardiaSlots, setGuardiaSlots] = useState<GSlot[]>([]);

  // Cargar slots de guardia al abrir si es día de guardia
  useEffect(() => {
    if (!isGuardia || !guardiaId) return;
    fetch(`/api/rrhh/guardias/${guardiaId}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setGuardiaSlots(d.slots); })
      .catch(() => undefined);
  }, [isGuardia, guardiaId]);

  const dt        = new Date(fecha + "T00:00:00");
  const dow       = dt.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const weekStart = getWeekStart(dt);
  const festivo   = festivos.find(f => f.fecha === fecha);
  const vacsHoy   = vacaciones.filter(v => fecha >= v.fecha_inicio && fecha <= v.fecha_fin);

  const fechaLabel = dt.toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long",
  });

  // Determina los bloques de trabajo de un empleado para este día
  const getBlocks = (emp: Empleado): [number, number][] => {
    if (isWeekend) return [];
    if (vacsHoy.some(v => v.empleado_id === emp.id)) return [];

    // Si es guardia y hay slots cargados, usar los de guardia para ese empleado
    if (isGuardia && guardiaSlots.length > 0) {
      const gs = guardiaSlots.find(s => s.empleado_id === emp.id);
      if (gs) {
        const blocks: [number, number][] = [[gs.hora_inicio, gs.hora_fin]];
        if (gs.hora_inicio2 != null && gs.hora_fin2 != null)
          blocks.push([gs.hora_inicio2, gs.hora_fin2]);
        return blocks;
      }
    }

    // Turno rotativo
    if (EMPLEADOS_ROTATIVOS.includes(emp.id) || EMPLEADOS_ESPECIALES.includes(emp.id)) {
      const override = asignaciones.find(a => a.empleado_id === emp.id && a.week_start === weekStart);
      const turno = override
        ? override.turno
        : EMPLEADOS_ESPECIALES.includes(emp.id) ? 0 : getTurnoForWeek(emp.id, weekStart);
      const h = TURNO_HORARIO[turno];
      if (!h) return [];
      const blocks: [number, number][] = [[h[0], h[1]]];
      if (h[2] != null && h[3] != null) blocks.push([h[2], h[3]]);
      return blocks;
    }

    // Horario fijo: primero columnas de BD, luego HORARIO_DEFAULT
    const hIa = emp.horario_inicio_a ?? HORARIO_DEFAULT[emp.id]?.[0] ?? null;
    const hFa = emp.horario_fin_a   ?? HORARIO_DEFAULT[emp.id]?.[1] ?? null;
    const hIb = emp.horario_inicio_b ?? HORARIO_DEFAULT[emp.id]?.[2] ?? null;
    const hFb = emp.horario_fin_b   ?? HORARIO_DEFAULT[emp.id]?.[3] ?? null;
    if (hIa == null || hFa == null) return [];
    const blocks: [number, number][] = [[hIa, hFa]];
    if (hIb != null && hFb != null) blocks.push([hIb, hFb]);
    return blocks;
  };

  // Empleados activos ordenados
  const activos = empleados
    .filter(e => e.activo !== 0)
    .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));

  // Bloques según horario programado, ignorando vacaciones (para detectar huecos)
  const getScheduledBlocks = (emp: Empleado): [number, number][] => {
    if (isWeekend) return [];
    if (isGuardia && guardiaSlots.length > 0) {
      const gs = guardiaSlots.find(s => s.empleado_id === emp.id);
      if (gs) {
        const b: [number, number][] = [[gs.hora_inicio, gs.hora_fin]];
        if (gs.hora_inicio2 != null && gs.hora_fin2 != null) b.push([gs.hora_inicio2, gs.hora_fin2]);
        return b;
      }
    }
    if (EMPLEADOS_ROTATIVOS.includes(emp.id) || EMPLEADOS_ESPECIALES.includes(emp.id)) {
      const override = asignaciones.find(a => a.empleado_id === emp.id && a.week_start === weekStart);
      const turno = override
        ? override.turno
        : EMPLEADOS_ESPECIALES.includes(emp.id) ? 0 : getTurnoForWeek(emp.id, weekStart);
      const h = TURNO_HORARIO[turno];
      if (!h) return [];
      const b: [number, number][] = [[h[0], h[1]]];
      if (h[2] != null && h[3] != null) b.push([h[2], h[3]]);
      return b;
    }
    const hIa = emp.horario_inicio_a ?? HORARIO_DEFAULT[emp.id]?.[0] ?? null;
    const hFa = emp.horario_fin_a   ?? HORARIO_DEFAULT[emp.id]?.[1] ?? null;
    const hIb = emp.horario_inicio_b ?? HORARIO_DEFAULT[emp.id]?.[2] ?? null;
    const hFb = emp.horario_fin_b   ?? HORARIO_DEFAULT[emp.id]?.[3] ?? null;
    if (hIa == null || hFa == null) return [];
    const b: [number, number][] = [[hIa, hFa]];
    if (hIb != null && hFb != null) b.push([hIb, hFb]);
    return b;
  };

  // Por franja: personas presentes y huecos por vacaciones
  const slotData = Array.from({ length: GRID_COLS }, (_, i) => {
    const hh = GRID_START_HH + i;
    let present = 0;
    let absent  = 0;
    for (const emp of activos) {
      const isVac = vacsHoy.some(v => v.empleado_id === emp.id);
      const scheduled = getScheduledBlocks(emp);
      if (scheduled.some(([a, b]) => a <= hh && hh < b)) {
        if (isVac) absent++;
        else present++;
      }
    }
    return { present, absent };
  });
  const maxTotal = Math.max(...slotData.map(s => s.present + s.absent), 1);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "12px",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 14, padding: 20,
        maxWidth: 820, width: "100%", maxHeight: "92vh", overflowY: "auto",
        boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
      }}>
        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: GREEN_DARK, textTransform: "capitalize" }}>
              {fechaLabel}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              {festivo && (
                <span style={{ fontSize: 10, background: "#fdecea", color: "#c0392b", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                  🎉 {festivo.nombre}
                </span>
              )}
              {isGuardia && (
                <span style={{ fontSize: 10, background: GREEN_LIGHT, color: GREEN_DARK, padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                  🏥 DÍA DE GUARDIA
                </span>
              )}
              {isWeekend && !festivo && (
                <span style={{ fontSize: 10, background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: 10 }}>
                  Fin de semana
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#aaa", lineHeight: 1 }}
          >×</button>
        </div>

        {/* ── Leyenda departamentos ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {Object.entries(DEPTO).map(([key, d]) => (
            activos.some(e => (e.departamento || "farmacia") === key) && (
              <span key={key} style={{
                fontSize: 9, padding: "2px 8px", borderRadius: 10, fontWeight: 700,
                background: d.bg, color: d.bar,
              }}>
                {d.label}
              </span>
            )
          ))}
          {vacsHoy.length > 0 && (
            <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: "#f3f4f6", color: "#9ca3af" }}>
              🌴 Vacaciones
            </span>
          )}
        </div>

        {/* ── Grid planning ── */}
        {!isWeekend ? (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 480 }}>
              {/* Eje horario */}
              <div style={{ display: "flex", marginBottom: 2 }}>
                <div style={{ width: 90, flexShrink: 0 }} />
                <div style={{ flex: 1, position: "relative", height: 18 }}>
                  {TICKS.map(hh => (
                    <div
                      key={hh}
                      style={{
                        position: "absolute", top: 0,
                        left: pct(hh),
                        transform: "translateX(-50%)",
                        fontSize: 8, color: "#aaa", whiteSpace: "nowrap",
                      }}
                    >
                      {hhToLabel(hh)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Líneas de cuadrícula (fondo) */}
              <div style={{ display: "flex" }}>
                <div style={{ width: 90, flexShrink: 0 }} />
                <div style={{ flex: 1, position: "relative", height: 1, background: "#f0f0f0" }}>
                  {TICKS.map(hh => (
                    <div key={hh} style={{
                      position: "absolute", top: 0, bottom: 0,
                      left: pct(hh), width: 1, background: "#e5e7eb",
                    }} />
                  ))}
                </div>
              </div>

              {/* Filas de empleados */}
              {activos.map((emp, idx) => {
                const blocks  = getBlocks(emp);
                const isVac   = vacsHoy.some(v => v.empleado_id === emp.id);
                const depto   = DEPTO[emp.departamento || "farmacia"] ?? DEPTO.otro;
                const hasData = blocks.length > 0 || isVac || HORARIO_DEFAULT[emp.id] || EMPLEADOS_ROTATIVOS.includes(emp.id) || EMPLEADOS_ESPECIALES.includes(emp.id);
                if (!hasData) return null;

                return (
                  <div
                    key={emp.id}
                    style={{
                      display: "flex", alignItems: "center",
                      background: idx % 2 === 0 ? "#fafafa" : "#fff",
                      borderBottom: "1px solid #f0f0f0",
                      minHeight: 30,
                    }}
                  >
                    {/* Nombre */}
                    <div style={{
                      width: 90, flexShrink: 0, paddingRight: 8,
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                        background: isVac ? "#d1d5db" : depto.bar,
                      }} />
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: isVac ? "#9ca3af" : "#374151",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {emp.nombre}
                      </span>
                    </div>

                    {/* Barra de tiempo */}
                    <div style={{ flex: 1, position: "relative", height: 22 }}>
                      {/* Fondo cuadrícula */}
                      {TICKS.map(hh => (
                        <div key={hh} style={{
                          position: "absolute", top: 0, bottom: 0,
                          left: pct(hh), width: 1, background: "#f0f0f0",
                        }} />
                      ))}

                      {/* Vacaciones overlay */}
                      {isVac && (
                        <div style={{
                          position: "absolute", inset: "2px 0",
                          background: "#e5e7eb", borderRadius: 4, opacity: 0.8,
                          display: "flex", alignItems: "center", paddingLeft: 6,
                        }}>
                          <span style={{ fontSize: 9, color: "#9ca3af" }}>🌴 Vacaciones</span>
                        </div>
                      )}

                      {/* Bloques de trabajo */}
                      {!isVac && blocks.map(([a, b], bi) => (
                        <div
                          key={bi}
                          title={`${hhToLabel(a)} – ${hhToLabel(b)}`}
                          style={{
                            position: "absolute",
                            left:  pct(Math.max(a, GRID_START_HH)),
                            width: pctW(Math.max(a, GRID_START_HH), Math.min(b, GRID_END_HH)),
                            top: 2, bottom: 2,
                            background: depto.bar,
                            borderRadius: 4,
                            opacity: 0.85,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <span style={{ fontSize: 8, color: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {hhToLabel(a)}–{hhToLabel(b)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* ── Fila de personas: recuadritos presentes + huecos vacaciones ── */}
              <div style={{ display: "flex", marginTop: 6, alignItems: "flex-end" }}>
                <div style={{
                  width: 90, flexShrink: 0,
                  fontSize: 8, color: "#888", fontWeight: 700, textAlign: "right", paddingRight: 6,
                  lineHeight: 1.2,
                }}>
                  personas<br />
                  <span style={{ fontWeight: 400, color: "#bbb" }}>▣ ausente</span>
                </div>
                <div style={{ flex: 1, display: "flex" }}>
                  {slotData.map(({ present, absent }, i) => {
                    const total = present + absent;
                    const SQ = 5; // tamaño del cuadradito en px
                    const GAP = 1;
                    const rowH = Math.max(maxTotal, 1) * (SQ + GAP) + 10;
                    return (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          display: "flex", flexDirection: "column-reverse",
                          alignItems: "center", gap: GAP,
                          height: rowH, justifyContent: "flex-start", paddingTop: 2,
                        }}
                      >
                        {/* Cuadraditos de personas presentes (abajo) */}
                        {Array.from({ length: present }, (_, j) => (
                          <div key={`p${j}`} style={{
                            width: SQ, height: SQ, flexShrink: 0,
                            background: present >= 7 ? "#14702e" : present >= 5 ? "#1a8c3a" : present >= 3 ? "#4ade80" : "#86efac",
                            borderRadius: 1,
                          }} />
                        ))}
                        {/* Cuadraditos de huecos por vacaciones (arriba, sombreados) */}
                        {Array.from({ length: absent }, (_, j) => (
                          <div key={`a${j}`} style={{
                            width: SQ, height: SQ, flexShrink: 0,
                            background: "#e5e7eb",
                            border: "1px dashed #9ca3af",
                            borderRadius: 1,
                            boxSizing: "border-box",
                          }} />
                        ))}
                        {/* Número total al pie */}
                        {total > 0 && (
                          <div style={{ fontSize: 6, color: absent > 0 ? "#ef4444" : "#555", fontWeight: 700, lineHeight: 1, marginTop: 1 }}>
                            {absent > 0 ? `${present}+${absent}` : present}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "#aaa", fontSize: 13, padding: "20px 0" }}>
            Día libre — fin de semana
          </div>
        )}

        {/* ── Vacaciones hoy ── */}
        {vacsHoy.length > 0 && (
          <div style={{ marginTop: 14, borderTop: "1px solid #f0f0f0", paddingTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              De vacaciones / ausencia
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {vacsHoy.map(v => {
                const emp = empleados.find(e => e.id === v.empleado_id);
                const depto = DEPTO[(emp?.departamento || "farmacia")] ?? DEPTO.otro;
                return (
                  <button
                    key={v.id}
                    onClick={() => { onClose(); onGoToVac(); }}
                    style={{
                      background: depto.bg, color: depto.bar,
                      border: "none", borderRadius: 20, padding: "4px 12px",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                    title="Ver en pestaña Vacaciones"
                  >
                    {v.nombre} →
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Botón guardia ── */}
        {isGuardia && (
          <button
            onClick={() => { onClose(); onOpenGuardia(); }}
            disabled={loadingGuardia}
            style={{
              marginTop: 14, width: "100%", background: GREEN, color: "#fff",
              border: "none", borderRadius: 8, padding: "10px",
              cursor: "pointer", fontSize: 13, fontWeight: 700,
            }}
          >
            {loadingGuardia ? "Cargando…" : "🏥 Abrir plantilla de guardia"}
          </button>
        )}
      </div>
    </div>
  );
}
