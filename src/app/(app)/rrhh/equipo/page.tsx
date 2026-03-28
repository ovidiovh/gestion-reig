"use client";

import { useState, useEffect } from "react";
import { Empleado, GREEN, GREEN_DARK, GREEN_LIGHT } from "../types";

// ── Mapas de display ──────────────────────────────────────────────────────────

const CATEGORIA_LABEL: Record<string, string> = {
  farmaceutico:  "Farmacéutico/a",
  auxiliar:      "Auxiliar de farmacia",
  mantenimiento: "Mantenimiento",
  limpieza:      "Limpieza",
  otro:          "Otros",
};

// Jornada según convenio farmacia (Las Palmas / Gran Canaria)
const CATEGORIA_JORNADA: Record<string, string> = {
  farmaceutico:  "40h / sem.",
  auxiliar:      "37,5h / sem.",
  mantenimiento: "Parcial",
  limpieza:      "Parcial",
  otro:          "—",
};

// ── Sub-componente: bloque por empresa ───────────────────────────────────────

interface SeccionProps {
  titulo: string;
  empleados: Empleado[];
  accentColor?: string;
}

function SeccionEmpresa({ titulo, empleados, accentColor = GREEN }: SeccionProps) {
  if (empleados.length === 0) return null;

  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{
        fontSize: 11, fontWeight: 700, color: accentColor,
        letterSpacing: "0.07em", textTransform: "uppercase",
        margin: "0 0 10px 0", paddingBottom: 6,
        borderBottom: `2px solid ${accentColor}33`,
      }}>
        {titulo} · {empleados.length} personas
      </h2>

      <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        {/* Cabecera */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1.8fr 0.9fr 0.65fr 0.75fr 0.75fr",
          background: accentColor, padding: "8px 16px",
        }}>
          {["Nombre", "Categoría", "Jornada", "Guardia", "Compl. €", "h/Guardia"].map(h => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {h}
            </div>
          ))}
        </div>

        {/* Filas */}
        {empleados.map((emp, i) => (
          <div
            key={emp.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1.5fr 1.8fr 0.9fr 0.65fr 0.75fr 0.75fr",
              padding: "10px 16px", alignItems: "center",
              background: i % 2 === 0 ? "#fff" : "#f9fafb",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            {/* Nombre */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: emp.farmaceutico ? GREEN_LIGHT : "#f0f0f0",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: emp.farmaceutico ? GREEN_DARK : "#888",
                flexShrink: 0,
              }}>
                {emp.nombre.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{
                  fontSize: 12, fontWeight: emp.farmaceutico ? 700 : 500,
                  color: emp.farmaceutico ? GREEN_DARK : "#2a2e2b",
                }}>
                  {emp.nombre}
                </div>
                {emp.farmaceutico ? (
                  <div style={{ fontSize: 8, color: GREEN, fontWeight: 700 }}>Farm.</div>
                ) : null}
              </div>
            </div>

            {/* Categoría */}
            <div style={{ fontSize: 11, color: "#555" }}>
              {CATEGORIA_LABEL[emp.categoria] ?? emp.categoria}
            </div>

            {/* Jornada */}
            <div style={{
              fontSize: 11, color: "#555",
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {CATEGORIA_JORNADA[emp.categoria] ?? "—"}
            </div>

            {/* Guardia */}
            <div>
              {emp.hace_guardia ? (
                <span style={{
                  background: GREEN_LIGHT, color: GREEN,
                  fontWeight: 700, fontSize: 9,
                  padding: "2px 7px", borderRadius: 10,
                }}>
                  ✓ Sí
                </span>
              ) : (
                <span style={{ color: "#ccc", fontSize: 10 }}>—</span>
              )}
            </div>

            {/* Complemento € */}
            <div style={{
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: emp.complemento_eur > 0 ? 700 : 400,
              color: emp.complemento_eur > 0 ? GREEN_DARK : "#ccc",
            }}>
              {emp.complemento_eur > 0 ? `${emp.complemento_eur}€` : "—"}
            </div>

            {/* h/Guardia */}
            <div style={{
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              color: emp.h_lab_complemento > 0 ? "#555" : "#ccc",
            }}>
              {emp.h_lab_complemento > 0 ? `${emp.h_lab_complemento}h` : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function EquipoPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rrhh/empleados")
      .then(r => r.json())
      .then(data => {
        if (data.ok) setEmpleados(data.empleados);
        else setError(data.error);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

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

  // ── Estadísticas ────────────────────────────────────────────────────────────
  const total      = empleados.length;
  const farmas     = empleados.filter(e => e.farmaceutico === 1).length;
  const auxiliares = empleados.filter(e => !e.farmaceutico && e.empresa === "reig").length;
  const conGuardia = empleados.filter(e => e.hace_guardia === 1).length;

  const reigEmps    = empleados.filter(e => e.empresa === "reig");
  const miRelusEmps = empleados.filter(e => e.empresa === "mirelus");

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 900, margin: "0 auto" }}>
      {/* Título */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: GREEN_DARK, margin: 0 }}>
          Equipo — Farmacia Reig
        </h1>
        <p style={{ fontSize: 11, color: "#888", margin: "4px 0 0" }}>
          Personal activo · Categorías · Guardias · 2026
        </p>
      </div>

      {/* Tarjetas KPI */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 10,
        marginBottom: 28,
      }}>
        {([
          ["Total personal",  total,      "#2a2e2b", "#f9fafb"],
          ["Farmacéuticos",   farmas,     GREEN_DARK, GREEN_LIGHT],
          ["Auxiliares",      auxiliares, "#1d4ed8",  "#eff6ff"],
          ["Hacen guardia",   conGuardia, GREEN,      GREEN_LIGHT],
        ] as [string, number, string, string][]).map(([label, value, color, bg]) => (
          <div key={label} style={{
            background: bg, borderRadius: 10, padding: "14px 16px",
            borderLeft: `4px solid ${color}`,
          }}>
            <div style={{
              fontSize: 28, fontWeight: 700, color,
              fontFamily: "'JetBrains Mono', monospace", lineHeight: 1,
            }}>
              {value}
            </div>
            <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Sección Farmacia Reig */}
      <SeccionEmpresa
        titulo="Farmacia Reig"
        empleados={reigEmps}
        accentColor={GREEN}
      />

      {/* Sección Mirelus */}
      <SeccionEmpresa
        titulo="Mirelus · Servicios externos"
        empleados={miRelusEmps}
        accentColor="#6b7280"
      />

      {/* Leyenda */}
      <div style={{
        marginTop: 8, padding: "10px 14px", background: "#f9fafb",
        borderRadius: 8, fontSize: 10, color: "#888",
        display: "flex", gap: 16, flexWrap: "wrap",
      }}>
        <span><strong>Compl. €</strong> = Complemento salarial por guardia</span>
        <span><strong>h/Guardia</strong> = Horas de convenio por guardia laborable</span>
        <span>Jornada basada en Convenio Colectivo Farmacias Las Palmas</span>
      </div>
    </div>
  );
}
