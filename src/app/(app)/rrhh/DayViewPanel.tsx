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
  farmacia:  { bar: "var(--color-reig-green)", bg: "var(--color-reig-green-light)", label: "Farmacia" },   // verde
  optica:    { bar: "#CA8A04", bg: "#FEF9C3", label: "Óptica" },     // amarillo
  ortopedia: { bar: "#EA580C", bg: "#FFF7ED", label: "Ortopedia" },  // naranja
  otro:      { bar: "var(--color-reig-text-secondary)", bg: "var(--color-reig-bg)", label: "Otros" },
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

interface SlotSquare { dept: string; present: boolean; enPracticas: boolean; }

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
  guardiaPublicada = false,
  puedeEditarGuardia = true,
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
  guardiaPublicada?: boolean;
  puedeEditarGuardia?: boolean;
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
    if (isWeekend || festivo) return [];
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

    // Paso 1.4 (2026-04-06): branch según tipo_horario.
    //   - "continuo":      solo bloque _a, da igual el día L-V.
    //   - "partido_lv":    dos bloques (_a mañana + _b tarde) todos los días L-V.
    //   - "lj_distinto_v": _a de lunes a jueves (dow 1-4), _b el viernes (dow 5).
    // Default fallback: si tipo_horario es null/undefined (BD antigua), se
    // comporta como antes — dos bloques en el mismo día si existen.
    const tipo = emp.tipo_horario ?? null;

    if (tipo === "continuo") {
      if (hIa == null || hFa == null) return [];
      return [[hIa, hFa]];
    }
    if (tipo === "lj_distinto_v") {
      // dow: 0=Dom 1=Lun ... 5=Vie 6=Sab. El filtro isWeekend ya descartó
      // sábado y domingo, pero por seguridad dejamos la comprobación explícita.
      if (dow === 5) {
        if (hIb == null || hFb == null) return [];
        return [[hIb, hFb]];
      }
      if (hIa == null || hFa == null) return [];
      return [[hIa, hFa]];
    }
    // "partido_lv" o fallback legacy: dos bloques mismo día.
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
        squares.push({ dept: emp.departamento || "farmacia", present: !isVac, enPracticas: emp.categoria === "practicas" });
      }
    }
    squares.sort((a, b) => DEPT_ORDER.indexOf(a.dept) - DEPT_ORDER.indexOf(b.dept));
    return squares;
  });
  const maxSlotLen = Math.max(...slotData.map(s => s.length), 1);

  // Turnos rotativos de la semana agrupados por turno (solo EMPLEADOS_ROTATIVOS, sin Zuleica)
  const turnoGroups: Record<number, string[]> = {};
  EMPLEADOS_ROTATIVOS.forEach(empId => {
    const emp = activos.find(e => e.id === empId);
    if (!emp) return;
    const override = asignaciones.find(a => a.empleado_id === empId && a.week_start === weekStart);
    const turno = override ? override.turno : getTurnoForWeek(empId, weekStart);
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
        background: "var(--color-reig-surface)", borderRadius: 14, padding: 20,
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
                <span style={{ fontSize: 10, background: "var(--color-reig-danger-light)", color: "var(--color-reig-danger)", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                  🎉 {festivo.nombre}
                </span>
              )}
              {isGuardia && (
                <span style={{ fontSize: 10, background: GREEN_LIGHT, color: GREEN_DARK, padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                  🏥 DÍA DE GUARDIA
                </span>
              )}
              {isWeekend && !festivo && (
                <span style={{ fontSize: 10, background: "var(--color-reig-bg)", color: "var(--color-reig-text-secondary)", padding: "2px 8px", borderRadius: 10 }}>
                  Fin de semana
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "var(--color-reig-text-muted)", lineHeight: 1 }}
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
            <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: "var(--color-reig-bg)", color: "var(--color-reig-text-muted)" }}>
              ▣ ausencia/vacaciones
            </span>
          )}
        </div>

        {/* ── Grid de cuadritos ── */}
        {!isWeekend && !festivo ? (
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
                      fontSize: 8, color: "var(--color-reig-text-muted)", whiteSpace: "nowrap",
                    }}>
                      {hhToLabel(hh)}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Fila de cuadritos (personas por franja) ── */}
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <div style={{
                  width: 72, flexShrink: 0,
                  fontSize: 8, color: "var(--color-reig-text-secondary)", fontWeight: 700, textAlign: "right", paddingRight: 6,
                  lineHeight: 1.3,
                }}>
                  personas<br />
                  <span style={{ fontWeight: 400, color: "var(--color-reig-text-muted)", fontSize: 7 }}>▣ ausente</span>
                </div>

                <div style={{ flex: 1, display: "flex", borderTop: "1px solid var(--color-reig-border)", borderLeft: "1px solid var(--color-reig-border)" }}>
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
                          borderRight: "1px solid var(--color-reig-border)",
                          borderBottom: "1px solid var(--color-reig-border)",
                          background: i % 2 === 0 ? "var(--color-reig-bg)" : "var(--color-reig-surface)",
                          position: "relative",
                        }}
                      >
                        {present.map((sq, j) => {
                          const d = DEPTO[sq.dept] ?? DEPTO.otro;
                          if (sq.enPracticas) {
                            return (
                              <div key={`p${j}`} style={{
                                width: SQ, height: SQ, flexShrink: 0, borderRadius: 1,
                                background: d.bar,
                                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
                                backgroundSize: "3px 3px",
                              }} />
                            );
                          }
                          return <div key={`p${j}`} style={{ width: SQ, height: SQ, flexShrink: 0, background: d.bar, borderRadius: 1 }} />;
                        })}
                        {absent.map((sq, j) => {
                          const d = DEPTO[sq.dept] ?? DEPTO.otro;
                          return <div key={`a${j}`} style={{ width: SQ, height: SQ, flexShrink: 0, background: "#ffffff", border: `1.5px solid ${d.bar}`, borderRadius: 1, boxSizing: "border-box" }} />;
                        })}
                        {total > 0 && (
                          <div style={{ position: "absolute", bottom: 1, fontSize: 6, fontWeight: 700, lineHeight: 1, color: absent.length > 0 ? "var(--color-reig-danger)" : "var(--color-reig-text-secondary)" }}>
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
          <div style={{ textAlign: "center", color: "var(--color-reig-text-muted)", fontSize: 13, padding: "20px 0" }}>
            {festivo ? `🎉 Festivo — ${festivo.nombre}` : "Día libre — fin de semana"}
          </div>
        )}

        {/* ── Turnos rotativos de la semana — un chip por persona ── */}
        {Object.keys(turnoGroups).length > 0 && (
          <div style={{ marginTop: 16, borderTop: "1px solid var(--color-reig-border-light)", paddingTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-reig-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Turnos esta semana
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[1, 2, 3].flatMap(t => {
                const nombres = turnoGroups[t];
                if (!nombres?.length) return [];
                const colors = TURNO_COLORS[t];
                const time = TURNO_LABELS[t].split(' · ')[1] ?? '';
                return nombres.map(nombre => (
                  <div key={`${t}-${nombre}`} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "5px 10px", borderRadius: 20,
                    background: colors.bg, color: colors.color,
                    fontSize: 12,
                  }}>
                    <strong style={{ fontSize: 11 }}>{TURNO_SHORT[t]}</strong>
                    <span>{nombre}</span>
                    {time && <span style={{ opacity: 0.7, fontSize: 10 }}>{time}</span>}
                  </div>
                ));
              })}
            </div>
          </div>
        )}

        {/* ── Vacaciones / ausencias hoy ── */}
        {vacsHoy.length > 0 && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--color-reig-border-light)", paddingTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-reig-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
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
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-reig-text)" }}>{v.nombre}</span>
                    <span style={{ fontSize: 11, color: "var(--color-reig-text-muted)" }}>{desde} – {hasta}</span>
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
        {isGuardia && (puedeEditarGuardia || guardiaPublicada) && (
          <button
            onClick={() => { onClose(); onOpenGuardia(); }}
            disabled={loadingGuardia}
            style={{
              marginTop: 14, width: "100%", background: GREEN, color: "#fff",
              border: "none", borderRadius: 8, padding: "10px",
              cursor: "pointer", fontSize: 13, fontWeight: 700,
            }}
          >
            {loadingGuardia ? "Cargando…" : puedeEditarGuardia ? "🏥 Abrir plantilla de guardia" : "🏥 Ver guardia publicada"}
          </button>
        )}
      </div>
    </div>
  );
}
