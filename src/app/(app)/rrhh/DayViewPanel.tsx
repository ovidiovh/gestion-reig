"use client";

import { useState, useEffect } from "react";
import {
  Empleado, Festivo, Vacacion, HorarioAsignacion,
  GRID_START_HH, GRID_COLS,
  TURNO_HORARIO, TURNO_COLORS, TURNO_SHORT, TURNO_LABELS, HORARIO_DEFAULT, hhToLabel,
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

const DEPT_ORDER = ["farmacia", "optica", "ortopedia", "otro"];

// ── Helper posición ───────────────────────────────────────────────────────────

const pct = (hh: number) => `${((hh - GRID_START_HH) / GRID_COLS) * 100}%`;

// ── Ticks del eje horario ─────────────────────────────────────────────────────

const TICKS = [17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41]
  .filter(hh => hh >= GRID_START_HH && hh <= GRID_START_HH + GRID_COLS);

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface GSlot {
  empleado_id: string;
  hora_inicio: number;
  hora_fin: number;
  hora_inicio2: number | null;
  hora_fin2: number | null;
}

interface SlotSquare { dept: string; present: boolean; }

// ── Formato de fecha corta ────────────────────────────────────────────────────

function fmtShort(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
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

  // Bloques según horario (sin tener en cuenta vacaciones)
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

  const activos = empleados
    .filter(e => e.activo !== 0)
    .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));

  // Por franja: cuadradito por persona (con dept y si está presente o ausente)
  const slotData = Array.from({ length: GRID_COLS }, (_, i) => {
    const hh = GRID_START_HH + i;
    const squares: SlotSquare[] = [];
    for (const emp of activos) {
      const isVac = vacsHoy.some(v => v.empleado_id === emp.id);
      const scheduled = getScheduledBlocks(emp);
      if (scheduled.some(([a, b]) => a <= hh && hh < b)) {
        squares.push({ dept: emp.departamento || "farmacia", present: !isVac });
      }
    }
    squares.sort((a, b) => DEPT_ORDER.indexOf(a.dept) - DEPT_ORDER.indexOf(b.dept));
    return squares;
  });
  const maxSlotLen = Math.max(...slotData.map(s => s.length), 1);

  // Turnos rotativos de la semana agrupados por turno
  const turnoGroups: Record<number, string[]> = {};
  [...EMPLEADOS_ESPECIALES, ...EMPLEADOS_ROTATIVOS].forEach(empId => {
    const emp = activos.find(e => e.id === empId);
    if (!emp) return;
    const override = asignaciones.find(a => a.empleado_id === empId && a.week_start === weekStart);
    const turno = override
      ? override.turno
      : EMPLEADOS_ESPECIALES.includes(empId) ? 0 : getTurnoForWeek(empId, weekStart);
    if (!turnoGroups[turno]) turnoGroups[turno] = [];
    turnoGroups[turno].push(emp.nombre);
  });

  const SQ  = 6;  // tamaño cuadradito px
  const GAP = 1;  // gap entre cuadraditos px
  const rowH = maxSlotLen * (SQ + GAP) + 14; // altura total fila

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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {DEPT_ORDER.map(key => {
            const d = DEPTO[key];
            const hasAny = activos.some(e => (e.departamento || "farmacia") === key);
            if (!hasAny) return null;
            return (
              <span key={key} style={{
                fontSize: 9, padding: "2px 8px", borderRadius: 10, fontWeight: 700,
                background: d.bg, color: d.bar,
              }}>
                ■ {d.label}
              </span>
            );
          })}
          {vacsHoy.length > 0 && (
            <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: "#f3f4f6", color: "#9ca3af" }}>
              ▣ ausencia/vacaciones
            </span>
          )}
        </div>

        {/* ── Grid de cuadritos ── */}
        {!isWeekend ? (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 480 }}>

              {/* Eje horario */}
              <div style={{ display: "flex", marginBottom: 2 }}>
                <div style={{ width: 72, flexShrink: 0 }} />
                <div style={{ flex: 1, position: "relative", height: 16 }}>
                  {TICKS.map(hh => (
                    <div key={hh} style={{
                      position: "absolute", top: 0,
                      left: pct(hh), transform: "translateX(-50%)",
                      fontSize: 8, color: "#aaa", whiteSpace: "nowrap",
                    }}>
                      {hhToLabel(hh)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Fila de cuadritos */}
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                {/* Etiqueta lateral */}
                <div style={{
                  width: 72, flexShrink: 0,
                  fontSize: 8, color: "#888", fontWeight: 700, textAlign: "right", paddingRight: 6,
                  lineHeight: 1.3,
                }}>
                  personas<br />
                  <span style={{ fontWeight: 400, color: "#bbb", fontSize: 7 }}>▣ ausente</span>
                </div>

                {/* Columnas de cuadritos (una por franja de 30 min) */}
                <div style={{ flex: 1, display: "flex", borderTop: "1px solid #e5e7eb", borderLeft: "1px solid #e5e7eb" }}>
                  {slotData.map((squares, i) => {
                    const present = squares.filter(s => s.present);
                    const absent  = squares.filter(s => !s.present);
                    const total   = squares.length;
                    return (
                      <div
                        key={i}
                        style={{
                          flex: 1, height: rowH,
                          display: "flex", flexDirection: "column-reverse",
                          alignItems: "center", justifyContent: "flex-start",
                          gap: GAP, paddingTop: 2, paddingBottom: 2,
                          borderRight: "1px solid #e5e7eb",
                          borderBottom: "1px solid #e5e7eb",
                          background: i % 2 === 0 ? "#fafafa" : "#fff",
                          position: "relative",
                        }}
                      >
                        {/* Cuadritos presentes (abajo) */}
                        {present.map((sq, j) => {
                          const d = DEPTO[sq.dept] ?? DEPTO.otro;
                          return (
                            <div key={`p${j}`} style={{
                              width: SQ, height: SQ, flexShrink: 0,
                              background: d.bar,
                              borderRadius: 1,
                            }} />
                          );
                        })}
                        {/* Cuadritos ausentes (encima, sombreados con borde) */}
                        {absent.map((sq, j) => {
                          const d = DEPTO[sq.dept] ?? DEPTO.otro;
                          return (
                            <div key={`a${j}`} style={{
                              width: SQ, height: SQ, flexShrink: 0,
                              background: d.bg,
                              border: `1px dashed ${d.bar}`,
                              borderRadius: 1,
                              boxSizing: "border-box",
                              opacity: 0.8,
                            }} />
                          );
                        })}
                        {/* Número al pie */}
                        {total > 0 && (
                          <div style={{
                            position: "absolute", bottom: 1,
                            fontSize: 6, fontWeight: 700, lineHeight: 1,
                            color: absent.length > 0 ? "#ef4444" : "#6b7280",
                          }}>
                            {absent.length > 0 ? `${present.length}+${absent.length}` : present.length}
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

        {/* ── Turnos rotativos de la semana ── */}
        {Object.keys(turnoGroups).length > 0 && (
          <div style={{ marginTop: 16, borderTop: "1px solid #f0f0f0", paddingTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Turnos esta semana
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[0, 1, 2, 3].map(t => {
                const nombres = turnoGroups[t];
                if (!nombres?.length) return null;
                const colors = TURNO_COLORS[t];
                return (
                  <div key={t} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 12px", borderRadius: 20,
                    background: colors.bg, color: colors.color,
                    fontSize: 12,
                  }}>
                    <strong style={{ fontSize: 11 }}>{TURNO_SHORT[t]}</strong>
                    <span>{nombres.join(", ")}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {[1, 2, 3, 0].map(t => {
                const colors = TURNO_COLORS[t];
                return (
                  <span key={t} style={{ fontSize: 9, color: colors.color, background: colors.bg, padding: "1px 6px", borderRadius: 6 }}>
                    {TURNO_SHORT[t]}: {TURNO_LABELS[t]}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Vacaciones / ausencias hoy ── */}
        {vacsHoy.length > 0 && (
          <div style={{ marginTop: 14, borderTop: "1px solid #f0f0f0", paddingTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              De vacaciones / ausencia
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {vacsHoy.map(v => {
                const emp   = empleados.find(e => e.id === v.empleado_id);
                const depto = DEPTO[emp?.departamento || "farmacia"] ?? DEPTO.otro;
                const desde = fmtShort(v.fecha_inicio);
                const hasta = fmtShort(v.fecha_fin);
                return (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: depto.bar, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{v.nombre}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{desde} – {hasta}</span>
                    <button
                      onClick={() => { onClose(); onGoToVac(); }}
                      style={{
                        background: depto.bg, color: depto.bar,
                        border: "none", borderRadius: 10, padding: "2px 8px",
                        fontSize: 10, fontWeight: 600, cursor: "pointer", marginLeft: "auto",
                      }}
                    >
                      ver →
                    </button>
                  </div>
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
