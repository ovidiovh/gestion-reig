"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Empleado, Festivo, Guardia, GuardiaSlot, Vacacion, GuardiaStats,
  HorarioAsignacion,
  calcGuardDates, MESES, DIAS_SEMANA,
  GREEN, GREEN_DARK, GREEN_LIGHT,
  toDateStr, getWeekStart,
} from "./types";
import GuardiaPanel from "./GuardiaPanel";
import VacacionesTab from "./VacacionesTab";
import DayViewPanel from "./DayViewPanel";

// ── Guardias precalculadas (cliente) ─────────────────────────────────────────
const GUARD_DATES = calcGuardDates();

// ── Tipos de vista ────────────────────────────────────────────────────────────
type MainView = "cal" | "guard" | "vac";
type CalView  = "mes" | "trimestre" | "anual";

// ── Helpers de estilo ────────────────────────────────────────────────────────
const btnBase: React.CSSProperties = {
  background: GREEN_LIGHT, border: "none", borderRadius: 6,
  padding: "5px 12px", cursor: "pointer", color: GREEN_DARK,
  fontSize: 14, fontWeight: 700,
};

// ── Componente principal ───────────────────────────────────────────────────────

export default function RRHHPage() {
  const [view, setView]         = useState<MainView>("cal");
  const [calView, setCalView]   = useState<CalView>("mes");
  const [month, setMonth]       = useState(new Date().getMonth());
  const [quarter, setQuarter]   = useState(() => Math.floor(new Date().getMonth() / 3));

  const [empleados,     setEmpleados]     = useState<Empleado[]>([]);
  const [festivos,      setFestivos]      = useState<Festivo[]>([]);
  const [guardias,      setGuardias]      = useState<Guardia[]>([]);
  const [vacaciones,    setVacaciones]    = useState<Vacacion[]>([]);
  const [guardiaStats,  setGuardiaStats]  = useState<GuardiaStats[]>([]);
  const [asignaciones,  setAsignaciones]  = useState<HorarioAsignacion[]>([]);

  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [activeGuardia,  setActiveGuardia]  = useState<{ guardia: Guardia; slots: GuardiaSlot[] } | null>(null);
  const [loadingGuardia, setLoadingGuardia] = useState(false);
  const [dayView,        setDayView]        = useState<string | null>(null); // fecha YYYY-MM-DD

  // ── Carga inicial con auto-migración ──────────────────────────────────────
  const loadAll = useCallback(async () => {
    const [e, f, g, v, gs] = await Promise.all([
      fetch("/api/rrhh/empleados").then(r => r.json()),
      fetch("/api/rrhh/festivos?year=2026").then(r => r.json()),
      fetch("/api/rrhh/guardias?year=2026").then(r => r.json()),
      fetch("/api/rrhh/vacaciones?year=2026").then(r => r.json()),
      fetch("/api/rrhh/guardias/stats?year=2026").then(r => r.json()),
    ]);
    if (e.ok) setEmpleados(e.empleados);
    if (f.ok) setFestivos(f.festivos);
    if (g.ok) setGuardias(g.guardias);
    if (v.ok) setVacaciones(v.vacaciones);
    if (gs.ok) setGuardiaStats(gs.stats);
    return e.ok;
  }, []);

  // Cargar asignaciones de horarios (semana actual + próximas 12)
  const loadAsignaciones = useCallback(async () => {
    const weekStart = getWeekStart(new Date());
    const r = await fetch(`/api/rrhh/horarios?week=${weekStart}&weeks=52`).then(r => r.json());
    if (r.ok) setAsignaciones(r.asignaciones);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const ok = await loadAll();
      if (!ok) {
        await fetch("/api/rrhh/migrate", { method: "POST" });
        await loadAll();
      }
      // Auto-generar guardias del año (idempotente)
      await fetch("/api/rrhh/guardias/auto-generar", { method: "POST" });
      // Recargar guardias tras auto-generar
      const g = await fetch("/api/rrhh/guardias?year=2026").then(r => r.json());
      if (g.ok) setGuardias(g.guardias);
      // Cargar asignaciones horarias
      await loadAsignaciones();
    } catch (e) {
      setError("Error cargando datos: " + String(e));
    } finally {
      setLoading(false);
    }
  }, [loadAll, loadAsignaciones]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Lookups rápidos ────────────────────────────────────────────────────────
  const festivoSet = new Set(festivos.map(f => f.fecha));
  const guardiaMap = new Map(guardias.map(g => [g.fecha, g]));
  const vacsOnDay  = (ds: string) =>
    vacaciones.filter(v => ds >= v.fecha_inicio && ds <= v.fecha_fin);

  // ── Abrir / crear guardia ──────────────────────────────────────────────────
  const openGuardia = useCallback(async (fecha: string) => {
    setLoadingGuardia(true);
    try {
      let guardia = guardiaMap.get(fecha);

      if (!guardia) {
        const res  = await fetch("/api/rrhh/guardias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fecha }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error ?? "No se pudo crear la guardia");

        const gRes  = await fetch("/api/rrhh/guardias?year=2026");
        const gData = await gRes.json();
        if (gData.ok) setGuardias(gData.guardias);
        guardia = gData.guardias.find((g: Guardia) => g.fecha === fecha);
      }

      if (!guardia) throw new Error("Guardia no encontrada tras crearla");

      const detRes  = await fetch(`/api/rrhh/guardias/${guardia.id}`);
      const detData = await detRes.json();
      if (!detData.ok) throw new Error(detData.error);

      setActiveGuardia({ guardia: detData.guardia, slots: detData.slots });
      setView("guard");
    } catch (e) {
      alert("Error al abrir guardia: " + String(e));
    } finally {
      setLoadingGuardia(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardiaMap]);

  const saveGuardia = async (slots: GuardiaSlot[], tipo: string, publicada: number) => {
    if (!activeGuardia) return;
    await fetch(`/api/rrhh/guardias/${activeGuardia.guardia.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo, publicada,
        slots: slots.map(s => ({
          empleado_id: s.empleado_id,
          hora_inicio: s.hora_inicio,
          hora_fin:    s.hora_fin,
          hora_inicio2: s.hora_inicio2 ?? null,
          hora_fin2:    s.hora_fin2    ?? null,
        })),
      }),
    });
    const res  = await fetch("/api/rrhh/guardias?year=2026");
    const data = await res.json();
    if (data.ok) setGuardias(data.guardias);
    setActiveGuardia(prev =>
      prev ? { ...prev, guardia: { ...prev.guardia, tipo: tipo as "lab" | "fest", publicada } } : null
    );
  };

  // ── Vacaciones handlers ────────────────────────────────────────────────────
  const addVacacion = async (empId: string, desde: string, hasta: string, estado: string, tipo: string) => {
    await fetch("/api/rrhh/vacaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empleado_id: empId, fecha_inicio: desde, fecha_fin: hasta, estado, tipo }),
    });
    const d = await fetch("/api/rrhh/vacaciones?year=2026").then(r => r.json());
    if (d.ok) setVacaciones(d.vacaciones);
  };

  const updateEstadoVac = async (id: number, estado: string) => {
    await fetch(`/api/rrhh/vacaciones/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const d = await fetch("/api/rrhh/vacaciones?year=2026").then(r => r.json());
    if (d.ok) setVacaciones(d.vacaciones);
  };

  const deleteVacacion = async (id: number) => {
    await fetch(`/api/rrhh/vacaciones/${id}`, { method: "DELETE" });
    setVacaciones(prev => prev.filter(v => v.id !== id));
  };

  const updateGuardiasManual = async (empId: string, value: number | null) => {
    await fetch("/api/rrhh/empleados", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: empId, guardias_manual: value }),
    });
    // Recargar stats
    const gs = await fetch("/api/rrhh/guardias/stats?year=2026").then(r => r.json());
    if (gs.ok) setGuardiaStats(gs.stats);
  };

  // ── Renderizador de celda ──────────────────────────────────────────────────
  const renderCell = (m: number, d: number, size: "full" | "sm" | "xs") => {
    const year   = 2026;
    const ds     = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dt     = new Date(year, m, d);
    const dow    = dt.getDay();
    const isWE   = dow === 0 || dow === 6;
    const isG    = GUARD_DATES.has(ds);
    const isF    = festivoSet.has(ds);
    const gdb    = guardiaMap.get(ds);
    const vacsH  = vacsOnDay(ds);
    const isToday = toDateStr(new Date()) === ds;

    const cellH  = size === "xs" ? 20 : size === "sm" ? 34 : 64;
    const fSize  = size === "xs" ? 7  : size === "sm" ? 9  : 12;
    const bw     = size === "xs" ? 1  : 2;

    const handleClick = () => {
      if (size === "xs") {
        setMonth(m);
        setCalView("mes");
      } else if (size === "full") {
        // En vista mensual: click en cualquier día abre la vista diaria
        setDayView(ds);
      } else if (size === "sm" && isG) {
        openGuardia(ds);
      }
    };

    return (
      <div
        key={`${m}-${d}`}
        onClick={handleClick}
        style={{
          minHeight: cellH,
          borderRadius: size === "xs" ? 2 : 4,
          padding: size === "xs" ? "1px 2px" : size === "sm" ? "2px 3px" : "4px 5px",
          cursor: size === "xs" ? "pointer" : "pointer",
          background: isG ? GREEN_LIGHT : isF ? "#fff0f0" : isWE ? "#f8f8f8" : "#fff",
          border: isG
            ? `${bw}px solid ${GREEN}`
            : isToday
            ? `${bw}px solid #3b82f6`
            : "1px solid #eee",
          position: "relative" as const,
          overflow: "hidden",
        }}
      >
        {/* Número de día */}
        <div style={{
          fontWeight: 700, fontSize: fSize,
          color: isF ? "#c0392b" : isG ? GREEN_DARK : isWE ? "#888" : "#2a2e2b",
        }}>
          {d}
        </div>

        {/* ─── FULL (mensual) ─── */}
        {size === "full" && isG && (
          <div style={{
            background: gdb?.publicada ? GREEN : "#a0d9b4",
            color: "#fff", fontSize: 7, fontWeight: 700,
            padding: "1px 4px", borderRadius: 3,
            display: "inline-block", marginTop: 1,
          }}>
            {gdb?.publicada ? "GUARDIA ✓" : "GUARDIA"}
          </div>
        )}
        {size === "full" && isF && !isG && (
          <div style={{ fontSize: 7, color: "#c0392b", fontWeight: 600, marginTop: 2 }}>
            {festivos.find(f => f.fecha === ds)?.nombre.split(" ").slice(0, 2).join(" ")}
          </div>
        )}
        {size === "full" && vacsH.slice(0, 2).map(v => {
          const emp = empleados.find(e => e.id === v.empleado_id);
          if (!emp) return null;
          return (
            <div key={v.id} style={{
              fontSize: 7, marginTop: 1, padding: "1px 3px", borderRadius: 3,
              background: emp.farmaceutico ? "#fdecea" : "#dbeafe",
              color: emp.farmaceutico ? "#c0392b" : "#1d4ed8",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
            }}>
              {emp.nombre}
            </div>
          );
        })}
        {size === "full" && vacsH.length > 2 && (
          <div style={{ fontSize: 7, color: "#aaa" }}>+{vacsH.length - 2}</div>
        )}

        {/* ─── SM (trimestral) ─── */}
        {size === "sm" && isG && (
          <div style={{
            width: "100%", height: 2, borderRadius: 1, marginTop: 2,
            background: gdb?.publicada ? GREEN : "#a0d9b4",
          }} />
        )}
        {size === "sm" && isF && !isG && (
          <div style={{ width: "100%", height: 2, borderRadius: 1, marginTop: 2, background: "#fca5a5" }} />
        )}
        {size === "sm" && vacsH.length > 0 && (
          <div style={{ display: "flex", gap: 1, marginTop: 2, flexWrap: "wrap" as const }}>
            {vacsH.slice(0, 4).map(v => {
              const emp = empleados.find(e => e.id === v.empleado_id);
              if (!emp) return null;
              return (
                <div key={v.id} style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: emp.farmaceutico ? "#c0392b" : "#1d4ed8",
                }} />
              );
            })}
          </div>
        )}

        {/* ─── XS (anual) — punto vacaciones ─── */}
        {size === "xs" && vacsH.length > 0 && (
          <div style={{
            position: "absolute" as const, bottom: 1, right: 1,
            width: 3, height: 3, borderRadius: "50%",
            background: (() => {
              const emp = empleados.find(e => e.id === vacsH[0]?.empleado_id);
              return emp?.farmaceutico ? "#c0392b" : "#1d4ed8";
            })(),
          }} />
        )}
      </div>
    );
  };

  // ── Generador de celdas para un mes completo ──────────────────────────────
  const cellsForMonth = (m: number, size: "full" | "sm" | "xs") => {
    const year     = 2026;
    const dim      = new Date(year, m + 1, 0).getDate();
    const startDow = (new Date(year, m, 1).getDay() + 6) % 7;
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < startDow; i++) cells.push(<div key={`e${i}`} />);
    for (let d = 1; d <= dim; d++)     cells.push(renderCell(m, d, size));
    return cells;
  };

  // ── Sub-nav de vistas de calendario ──────────────────────────────────────
  const calViewNav = (
    <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
      {(["mes", "trimestre", "anual"] as CalView[]).map(cv => (
        <button
          key={cv}
          onClick={() => setCalView(cv)}
          style={{
            padding: "4px 12px", borderRadius: 20, border: "none",
            cursor: "pointer", fontSize: 11, fontWeight: calView === cv ? 700 : 400,
            background: calView === cv ? GREEN : GREEN_LIGHT,
            color: calView === cv ? "#fff" : GREEN_DARK,
          }}
        >
          {cv === "mes" ? "Mes" : cv === "trimestre" ? "Trimestre" : "Año"}
        </button>
      ))}
    </div>
  );

  // ── VISTA MENSUAL ─────────────────────────────────────────────────────────
  const renderMes = () => (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => setMonth(m => Math.max(0, m - 1))} style={btnBase}>◀</button>
        <span style={{ fontSize: 17, fontWeight: 700, color: GREEN_DARK, fontFamily: "'DM Serif Display', serif" }}>
          {MESES[month]} 2026
        </span>
        <button onClick={() => setMonth(m => Math.min(11, m + 1))} style={btnBase}>▶</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {DIAS_SEMANA.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#aaa", padding: "2px 0" }}>{d}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cellsForMonth(month, "full")}
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 9, color: "#888", flexWrap: "wrap" as const }}>
        <span><span style={{ background: GREEN, color: "#fff", padding: "0 4px", borderRadius: 3 }}>■</span> Guardia publicada</span>
        <span><span style={{ background: "#a0d9b4", padding: "0 4px", borderRadius: 3 }}>■</span> Guardia pendiente</span>
        <span style={{ color: "#c0392b" }}>■ Festivo / Farm. vac.</span>
        <span style={{ color: "#1d4ed8" }}>■ Aux. vacaciones</span>
        <span style={{ color: GREEN, fontSize: 8 }}>Clic en cualquier día → vista diaria</span>
      </div>
    </div>
  );

  // ── VISTA TRIMESTRAL ──────────────────────────────────────────────────────
  const renderTrimestre = () => {
    const startM  = quarter * 3;
    const months  = [startM, startM + 1, startM + 2];

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button
            onClick={() => setQuarter(q => Math.max(0, q - 1))}
            disabled={quarter === 0}
            style={{ ...btnBase, opacity: quarter === 0 ? 0.35 : 1, cursor: quarter === 0 ? "not-allowed" : "pointer" }}
          >◀</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: GREEN_DARK, fontFamily: "'DM Serif Display', serif" }}>
            T{quarter + 1} · {MESES[startM]} – {MESES[startM + 2]} 2026
          </span>
          <button
            onClick={() => setQuarter(q => Math.min(3, q + 1))}
            disabled={quarter === 3}
            style={{ ...btnBase, opacity: quarter === 3 ? 0.35 : 1, cursor: quarter === 3 ? "not-allowed" : "pointer" }}
          >▶</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {months.map(m => (
            <div key={m}>
              <div
                onClick={() => { setMonth(m); setCalView("mes"); }}
                style={{
                  textAlign: "center", fontSize: 12, fontWeight: 700, color: GREEN_DARK,
                  marginBottom: 5, fontFamily: "'DM Serif Display', serif",
                  cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2,
                }}
              >
                {MESES[m]}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 2 }}>
                {DIAS_SEMANA.map(d => (
                  <div key={d} style={{ textAlign: "center", fontSize: 7, fontWeight: 700, color: "#bbb" }}>{d}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                {cellsForMonth(m, "sm")}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 10, fontSize: 9, color: "#888", flexWrap: "wrap" as const }}>
          <span><span style={{ background: GREEN, color: "#fff", padding: "0 3px", borderRadius: 2 }}>■</span> Guardia</span>
          <span style={{ color: "#c0392b" }}>— Festivo / Farm.vac.</span>
          <span style={{ color: "#1d4ed8" }}>● Aux.vac.</span>
          <span style={{ color: GREEN, fontSize: 8 }}>Clic en nombre de mes → vista mensual · Clic en guardia → abrir plantilla</span>
        </div>
      </div>
    );
  };

  // ── VISTA ANUAL ───────────────────────────────────────────────────────────
  const renderAnual = () => (
    <div>
      <div style={{
        textAlign: "center", fontSize: 16, fontWeight: 700, color: GREEN_DARK,
        marginBottom: 14, fontFamily: "'DM Serif Display', serif",
      }}>
        2026 — Vista anual
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {Array.from({ length: 12 }, (_, m) => (
          <div key={m}>
            <div
              onClick={() => { setMonth(m); setCalView("mes"); }}
              style={{
                textAlign: "center", fontSize: 10, fontWeight: 700, color: GREEN_DARK,
                marginBottom: 3, cursor: "pointer",
                textDecoration: "underline", textUnderlineOffset: 2,
              }}
            >
              {MESES[m]}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 1 }}>
              {DIAS_SEMANA.map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: 5, color: "#ccc" }}>{d.charAt(0)}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
              {cellsForMonth(m, "xs")}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 9, color: "#888", textAlign: "center", marginTop: 10 }}>
        Clic en el nombre del mes para abrir vista mensual
      </div>
    </div>
  );

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
        <div style={{ color: GREEN_DARK, fontSize: 14 }}>Cargando módulo RRHH…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, background: "#fef2f2", borderRadius: 8, color: "#c0392b" }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  // ── Layout principal ───────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 960, margin: "0 auto" }}>
      {/* Título */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: GREEN_DARK, margin: 0 }}>
          RRHH — Farmacia Reig
        </h1>
        <p style={{ fontSize: 11, color: "#888", margin: "4px 0 0" }}>
          Guardias · Vacaciones · Planificación 2026
        </p>
      </div>

      {/* Tabs principales */}
      <div style={{
        display: "flex", background: GREEN_DARK, borderRadius: 10,
        overflow: "hidden", marginBottom: 16,
      }}>
        {([
          ["cal",   "📅", "Calendario"],
          ["guard", "🏥", "Guardia"],
          ["vac",   "🌴", "Vacaciones"],
        ] as [MainView, string, string][]).map(([k, ic, l]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            style={{
              flex: 1, padding: "10px 4px", border: "none", cursor: "pointer",
              background: view === k ? GREEN : "transparent",
              color: "#fff", fontSize: 11, fontWeight: view === k ? 700 : 400,
              borderBottom: view === k ? `3px solid ${GREEN_LIGHT}` : "3px solid transparent",
              transition: "background 0.15s",
            }}
          >
            <div style={{ fontSize: 16 }}>{ic}</div>
            {l}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

        {/* ── CALENDARIO ── */}
        {view === "cal" && (
          <div>
            {calViewNav}
            {calView === "mes"       && renderMes()}
            {calView === "trimestre" && renderTrimestre()}
            {calView === "anual"     && renderAnual()}
          </div>
        )}

        {/* ── GUARDIA (lista próximas) ── */}
        {view === "guard" && !activeGuardia && (
          <div>
            <p style={{ color: "#888", fontSize: 13 }}>
              Haz clic en un día de guardia en el{" "}
              <button
                onClick={() => setView("cal")}
                style={{ background: "none", border: "none", color: GREEN, cursor: "pointer", fontWeight: 700, fontSize: 13, padding: 0 }}
              >
                calendario
              </button>
              {" "}para abrir la plantilla.
            </p>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: GREEN_DARK, marginBottom: 8 }}>Próximas guardias</div>
              {Array.from(GUARD_DATES)
                .filter(d => d >= toDateStr(new Date()))
                .sort()
                .slice(0, 8)
                .map(fecha => {
                  const g   = guardiaMap.get(fecha);
                  const dow = new Date(fecha + "T00:00:00").toLocaleDateString("es-ES", {
                    weekday: "long", day: "numeric", month: "long",
                  });
                  return (
                    <div
                      key={fecha}
                      onClick={() => openGuardia(fecha)}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 12px", background: GREEN_LIGHT, borderRadius: 8,
                        marginBottom: 4, cursor: "pointer", border: `1px solid ${GREEN}`,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: GREEN_DARK, textTransform: "capitalize" }}>{dow}</span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {g?.publicada ? (
                          <span style={{ fontSize: 10, background: GREEN,      color: "#fff", padding: "2px 6px", borderRadius: 4 }}>Publicada</span>
                        ) : g ? (
                          <span style={{ fontSize: 10, background: "#f59e0b", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>Borrador</span>
                        ) : (
                          <span style={{ fontSize: 10, background: "#e5e7eb", color: "#555", padding: "2px 6px", borderRadius: 4 }}>Sin crear</span>
                        )}
                        <span style={{ fontSize: 10, color: GREEN }}>Abrir →</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ── VACACIONES ── */}
        {view === "vac" && (
          <VacacionesTab
            empleados={empleados}
            vacaciones={vacaciones}
            guardiaStats={guardiaStats}
            onAddVacacion={addVacacion}
            onUpdateEstado={updateEstadoVac}
            onDeleteVacacion={deleteVacacion}
            onUpdateGuardiasManual={updateGuardiasManual}
          />
        )}
      </div>

      {/* Panel guardia (overlay) */}
      {activeGuardia && (
        <GuardiaPanel
          guardia={activeGuardia.guardia}
          slots={activeGuardia.slots}
          vacaciones={vacaciones}
          onClose={() => setActiveGuardia(null)}
          onSave={saveGuardia}
        />
      )}

      {/* Vista diaria (overlay) */}
      {dayView && (
        <DayViewPanel
          fecha={dayView}
          empleados={empleados}
          festivos={festivos}
          vacaciones={vacaciones}
          asignaciones={asignaciones}
          guardiaId={guardiaMap.get(dayView)?.id}
          isGuardia={GUARD_DATES.has(dayView)}
          loadingGuardia={loadingGuardia}
          onOpenGuardia={() => openGuardia(dayView)}
          onGoToVac={() => { setView("vac"); }}
          onClose={() => setDayView(null)}
        />
      )}
    </div>
  );
}
