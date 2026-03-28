"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Empleado, Festivo, Guardia, GuardiaSlot, Vacacion,
  calcGuardDates, MESES, DIAS_SEMANA,
  GREEN, GREEN_DARK, GREEN_LIGHT,
  toDateStr,
} from "./types";
import GuardiaPanel from "./GuardiaPanel";
import VacacionesTab from "./VacacionesTab";

// ── Guardias precalculadas (cliente) ─────────────────────────────────────────
const GUARD_DATES = calcGuardDates();

// ── Helpers ──────────────────────────────────────────────────────────────────
type View = "cal" | "guard" | "vac";

export default function RRHHPage() {
  const [view, setView] = useState<View>("cal");
  const [month, setMonth] = useState(new Date().getMonth());
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [festivos, setFestivos] = useState<Festivo[]>([]);
  const [guardias, setGuardias] = useState<Guardia[]>([]);
  const [vacaciones, setVacaciones] = useState<Vacacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guardia activa en panel
  const [activeGuardia, setActiveGuardia] = useState<{ guardia: Guardia; slots: GuardiaSlot[] } | null>(null);
  const [loadingGuardia, setLoadingGuardia] = useState(false);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [empRes, festRes, guardRes, vacRes] = await Promise.all([
        fetch("/api/rrhh/empleados"),
        fetch("/api/rrhh/festivos?year=2026"),
        fetch("/api/rrhh/guardias?year=2026"),
        fetch("/api/rrhh/vacaciones?year=2026"),
      ]);
      const [empData, festData, guardData, vacData] = await Promise.all([
        empRes.json(), festRes.json(), guardRes.json(), vacRes.json(),
      ]);

      if (empData.ok)   setEmpleados(empData.empleados);
      if (festData.ok)  setFestivos(festData.festivos);
      if (guardData.ok) setGuardias(guardData.guardias);
      if (vacData.ok)   setVacaciones(vacData.vacaciones);
    } catch (e) {
      setError("Error cargando datos: " + String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Sets para lookup rápido ────────────────────────────────────────────────
  const festivoSet = new Set(festivos.map(f => f.fecha));
  const guardiaMap = new Map(guardias.map(g => [g.fecha, g]));

  // Vacaciones por día
  const vacsOnDay = (dateStr: string) =>
    vacaciones.filter(v => dateStr >= v.fecha_inicio && dateStr <= v.fecha_fin);

  // ── Abrir guardia ──────────────────────────────────────────────────────────
  const openGuardia = async (fecha: string) => {
    setLoadingGuardia(true);
    try {
      let guardia = guardiaMap.get(fecha);

      // Si no existe en BD, crearla
      if (!guardia) {
        const res = await fetch("/api/rrhh/guardias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fecha }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        // Recargar guardias
        const newGuardRes = await fetch("/api/rrhh/guardias?year=2026");
        const newGuardData = await newGuardRes.json();
        if (newGuardData.ok) setGuardias(newGuardData.guardias);

        guardia = newGuardData.guardias.find((g: Guardia) => g.fecha === fecha);
      }

      if (!guardia) throw new Error("No se pudo crear la guardia");

      // Cargar slots
      const detRes = await fetch(`/api/rrhh/guardias/${guardia.id}`);
      const detData = await detRes.json();
      if (!detData.ok) throw new Error(detData.error);

      setActiveGuardia({ guardia: detData.guardia, slots: detData.slots });
      setView("guard");
    } catch (e) {
      alert("Error: " + String(e));
    } finally {
      setLoadingGuardia(false);
    }
  };

  const saveGuardia = async (slots: GuardiaSlot[], tipo: string, publicada: number) => {
    if (!activeGuardia) return;
    const { guardia } = activeGuardia;
    await fetch(`/api/rrhh/guardias/${guardia.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        publicada,
        slots: slots.map(s => ({ empleado_id: s.empleado_id, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin })),
      }),
    });
    // Refrescar guardias
    const res = await fetch("/api/rrhh/guardias?year=2026");
    const data = await res.json();
    if (data.ok) setGuardias(data.guardias);
    setActiveGuardia(prev => prev ? { ...prev, guardia: { ...prev.guardia, tipo: tipo as "lab" | "fest", publicada } } : null);
  };

  // ── Vacaciones handlers ────────────────────────────────────────────────────
  const addVacacion = async (empId: string, desde: string, hasta: string, estado: string) => {
    const res = await fetch("/api/rrhh/vacaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empleado_id: empId, fecha_inicio: desde, fecha_fin: hasta, estado }),
    });
    if (res.ok) {
      const newRes = await fetch("/api/rrhh/vacaciones?year=2026");
      const d = await newRes.json();
      if (d.ok) setVacaciones(d.vacaciones);
    }
  };

  const updateEstadoVac = async (id: number, estado: string) => {
    await fetch(`/api/rrhh/vacaciones/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const res = await fetch("/api/rrhh/vacaciones?year=2026");
    const d = await res.json();
    if (d.ok) setVacaciones(d.vacaciones);
  };

  const deleteVacacion = async (id: number) => {
    await fetch(`/api/rrhh/vacaciones/${id}`, { method: "DELETE" });
    setVacaciones(prev => prev.filter(v => v.id !== id));
  };

  // ── Render calendario mensual ──────────────────────────────────────────────
  const renderCalendar = () => {
    const year = 2026;
    const dim = new Date(year, month + 1, 0).getDate();
    const startDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0=Lunes

    const days = [];

    // Vacíos iniciales
    for (let i = 0; i < startDow; i++) {
      days.push(<div key={`e${i}`} />);
    }

    for (let d = 1; d <= dim; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dt = new Date(year, month, d);
      const dow = dt.getDay(); // 0=dom, 6=sab
      const isWeekend = dow === 0 || dow === 6;
      const isGuard = GUARD_DATES.has(dateStr);
      const isFestivo = festivoSet.has(dateStr);
      const guardia = guardiaMap.get(dateStr);
      const vacsHoy = vacsOnDay(dateStr);
      const isToday = toDateStr(new Date()) === dateStr;

      days.push(
        <div
          key={d}
          onClick={() => isGuard ? openGuardia(dateStr) : null}
          style={{
            minHeight: 64,
            borderRadius: 6,
            padding: "4px 5px",
            cursor: isGuard ? "pointer" : "default",
            background: isGuard ? GREEN_LIGHT : isFestivo ? "#fff0f0" : isWeekend ? "#f8f8f8" : "#fff",
            border: isGuard
              ? `2px solid ${GREEN}`
              : isToday
              ? "2px solid #3b82f6"
              : "1px solid #eee",
            position: "relative" as const,
          }}
        >
          <div style={{
            fontWeight: 700, fontSize: 12,
            color: isFestivo ? "#c0392b" : isGuard ? GREEN_DARK : isWeekend ? "#888" : "#2a2e2b",
          }}>
            {d}
          </div>

          {isGuard && (
            <div style={{
              background: guardia?.publicada ? GREEN : "#a0d9b4",
              color: "#fff", fontSize: 7, fontWeight: 700,
              padding: "1px 4px", borderRadius: 3, display: "inline-block", marginTop: 1,
            }}>
              {loadingGuardia ? "…" : guardia?.publicada ? "GUARDIA ✓" : "GUARDIA"}
            </div>
          )}

          {isFestivo && !isGuard && (
            <div style={{ fontSize: 7, color: "#c0392b", fontWeight: 600, marginTop: 2 }}>
              {festivos.find(f => f.fecha === dateStr)?.nombre.split(" ").slice(0, 2).join(" ")}
            </div>
          )}

          {vacsHoy.slice(0, 2).map(v => {
            const emp = empleados.find(e => e.id === v.empleado_id);
            if (!emp) return null;
            return (
              <div key={v.id} style={{
                fontSize: 7, marginTop: 1, padding: "1px 3px", borderRadius: 3,
                background: emp.farmaceutico ? "#fdecea" : "#dbeafe",
                color: emp.farmaceutico ? "#c0392b" : "#1d4ed8",
                fontWeight: emp.farmaceutico ? 700 : 400,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
              }}>
                {emp.nombre}
              </div>
            );
          })}
          {vacsHoy.length > 2 && (
            <div style={{ fontSize: 7, color: "#aaa" }}>+{vacsHoy.length - 2} más</div>
          )}
        </div>
      );
    }

    return days;
  };

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
        <p style={{ fontSize: 11, marginTop: 8 }}>
          ¿Has ejecutado la migración? Llama a <code>POST /api/rrhh/migrate</code> primero.
        </p>
      </div>
    );
  }

  // ── Layout principal ───────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 900, margin: "0 auto" }}>
      {/* Título */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: GREEN_DARK, margin: 0 }}>
          RRHH — Farmacia Reig
        </h1>
        <p style={{ fontSize: 11, color: "#888", margin: "4px 0 0" }}>Guardias · Vacaciones · Planificación 2026</p>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", background: GREEN_DARK, borderRadius: 10,
        overflow: "hidden", marginBottom: 16,
      }}>
        {([
          ["cal", "📅", "Calendario"],
          ["guard", "🏥", "Guardia"],
          ["vac", "🌴", "Vacaciones"],
        ] as [View, string, string][]).map(([k, ic, l]) => (
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
            {/* Navegación mes */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button
                onClick={() => setMonth(m => Math.max(0, m - 1))}
                style={{ background: GREEN_LIGHT, border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: GREEN_DARK, fontSize: 14, fontWeight: 700 }}
              >◀</button>
              <span style={{ fontSize: 17, fontWeight: 700, color: GREEN_DARK, fontFamily: "'DM Serif Display', serif" }}>
                {MESES[month]} 2026
              </span>
              <button
                onClick={() => setMonth(m => Math.min(11, m + 1))}
                style={{ background: GREEN_LIGHT, border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: GREEN_DARK, fontSize: 14, fontWeight: 700 }}
              >▶</button>
            </div>

            {/* Cabecera días */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
              {DIAS_SEMANA.map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#aaa", padding: "2px 0" }}>{d}</div>
              ))}
            </div>

            {/* Grid días */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {renderCalendar()}
            </div>

            {/* Leyenda */}
            <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 9, color: "#888", flexWrap: "wrap" as const }}>
              <span><span style={{ background: GREEN, color: "#fff", padding: "0 4px", borderRadius: 3 }}>■</span> Guardia publicada</span>
              <span><span style={{ background: "#a0d9b4", padding: "0 4px", borderRadius: 3 }}>■</span> Guardia pendiente</span>
              <span style={{ color: "#c0392b" }}>■ Festivo</span>
              <span style={{ color: "#c0392b" }}>■ Farm. vacaciones</span>
              <span style={{ color: "#1d4ed8" }}>■ Aux. vacaciones</span>
            </div>
          </div>
        )}

        {/* ── GUARDIA ── */}
        {view === "guard" && !activeGuardia && (
          <div>
            <p style={{ color: "#888", fontSize: 13 }}>
              Haz clic en un día de guardia en el <button onClick={() => setView("cal")} style={{ background: "none", border: "none", color: GREEN, cursor: "pointer", fontWeight: 700, fontSize: 13, padding: 0 }}>calendario</button> para abrir la plantilla.
            </p>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: GREEN_DARK, marginBottom: 8 }}>Próximas guardias</div>
              {Array.from(GUARD_DATES)
                .filter(d => d >= toDateStr(new Date()))
                .sort()
                .slice(0, 6)
                .map(fecha => {
                  const g = guardiaMap.get(fecha);
                  const dow = new Date(fecha + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
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
                          <span style={{ fontSize: 10, background: GREEN, color: "#fff", padding: "2px 6px", borderRadius: 4 }}>Publicada</span>
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
            onAddVacacion={addVacacion}
            onUpdateEstado={updateEstadoVac}
            onDeleteVacacion={deleteVacacion}
          />
        )}
      </div>

      {/* Panel guardia (modal) */}
      {activeGuardia && (
        <GuardiaPanel
          guardia={activeGuardia.guardia}
          slots={activeGuardia.slots}
          vacaciones={vacaciones}
          onClose={() => { setActiveGuardia(null); }}
          onSave={saveGuardia}
        />
      )}
    </div>
  );
}
