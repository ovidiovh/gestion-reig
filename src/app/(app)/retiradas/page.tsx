"use client";

import { useState, useCallback } from "react";
import { useZona } from "./layout";

// ── Types ──

interface CajaBilletes {
  b200: number; b100: number; b50: number; b20: number; b10: number; b5: number;
}

interface ConteoBilletes {
  b500: number; b200: number; b100: number; b50: number; b20: number; b10: number; b5: number;
}

interface Movimiento {
  tipo: "sacar" | "ingresar";
  caja_num: number;
  importe: number;
  motivo: string;
}

const BILLETES_CAJA: { key: keyof CajaBilletes; label: string; valor: number }[] = [
  { key: "b200", label: "200 €", valor: 200 },
  { key: "b100", label: "100 €", valor: 100 },
  { key: "b50",  label: "50 €",  valor: 50 },
  { key: "b20",  label: "20 €",  valor: 20 },
  { key: "b10",  label: "10 €",  valor: 10 },
  { key: "b5",   label: "5 €",   valor: 5 },
];

const BILLETES_CONTEO: { key: keyof ConteoBilletes; label: string; valor: number }[] = [
  { key: "b500", label: "500 €", valor: 500 },
  { key: "b200", label: "200 €", valor: 200 },
  { key: "b100", label: "100 €", valor: 100 },
  { key: "b50",  label: "50 €",  valor: 50 },
  { key: "b20",  label: "20 €",  valor: 20 },
  { key: "b10",  label: "10 €",  valor: 10 },
  { key: "b5",   label: "5 €",   valor: 5 },
];

const emptyCaja = (): CajaBilletes => ({ b200: 0, b100: 0, b50: 0, b20: 0, b10: 0, b5: 0 });
const emptyConteo = (): ConteoBilletes => ({ b500: 0, b200: 0, b100: 0, b50: 0, b20: 0, b10: 0, b5: 0 });

function totalCaja(c: CajaBilletes): number {
  return c.b200 * 200 + c.b100 * 100 + c.b50 * 50 + c.b20 * 20 + c.b10 * 10 + c.b5 * 5;
}

function totalConteo(c: ConteoBilletes): number {
  return c.b500 * 500 + c.b200 * 200 + c.b100 * 100 + c.b50 * 50 + c.b20 * 20 + c.b10 * 10 + c.b5 * 5;
}

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

// ── Styles ──

const card: React.CSSProperties = {
  background: "#fff", borderRadius: 12, padding: 20,
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)", marginBottom: 16,
};
const btnBase: React.CSSProperties = {
  border: "none", borderRadius: 8, padding: "10px 20px",
  fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all 0.15s",
};

export default function RetiradasPage() {
  const zona = useZona();
  const CAJAS_DISPONIBLES = zona === "optica" ? [11] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const [paso, setPaso] = useState<1 | 2 | 3>(1);

  // Paso 1: cajas
  const [cajasActivas, setCajasActivas] = useState<Set<number>>(new Set());
  const [cajasData, setCajasData] = useState<Record<number, CajaBilletes>>({});

  // Paso 2: conteo
  const [conteo, setConteo] = useState<ConteoBilletes>(emptyConteo());
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [showModal, setShowModal] = useState<"sacar" | "ingresar" | null>(null);
  const [modalCaja, setModalCaja] = useState(1);
  const [modalImporte, setModalImporte] = useState(0);
  const [modalMotivo, setModalMotivo] = useState("");

  // Paso 3: resultado
  const [resultado, setResultado] = useState<{ id: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Paso 1 helpers ──

  const toggleCaja = (n: number) => {
    setCajasActivas((prev) => {
      const next = new Set(prev);
      if (next.has(n)) { next.delete(n); } else { next.add(n); }
      return next;
    });
    if (!cajasData[n]) setCajasData((p) => ({ ...p, [n]: emptyCaja() }));
  };

  const updateBillete = (cajaNum: number, key: keyof CajaBilletes, val: number) => {
    setCajasData((prev) => ({
      ...prev,
      [cajaNum]: { ...(prev[cajaNum] || emptyCaja()), [key]: Math.max(0, val) },
    }));
  };

  const totalGlobal = Array.from(cajasActivas).reduce(
    (s, n) => s + totalCaja(cajasData[n] || emptyCaja()), 0
  );

  // ── Paso 2 helpers ──

  const totalConteoVal = totalConteo(conteo);
  const ajustesTotal = movimientos.reduce(
    (s, m) => s + (m.tipo === "ingresar" ? m.importe : -m.importe), 0
  );
  const totalCajasAjustado = totalGlobal + ajustesTotal;
  const diferencia = Math.round((totalConteoVal - totalCajasAjustado) * 100) / 100;
  const cuadra = Math.abs(diferencia) < 0.01;

  const addMovimiento = useCallback(() => {
    if (modalImporte <= 0) return;
    setMovimientos((prev) => [
      ...prev,
      { tipo: showModal!, caja_num: modalCaja, importe: modalImporte, motivo: modalMotivo },
    ]);
    setShowModal(null);
    setModalImporte(0);
    setModalMotivo("");
  }, [showModal, modalCaja, modalImporte, modalMotivo]);

  // ── Guardar ──

  const guardar = async () => {
    setSaving(true);
    setError("");
    try {
      const cajasArr = Array.from(cajasActivas).sort().map((n) => {
        const c = cajasData[n] || emptyCaja();
        return { caja_num: n, ...c, total: totalCaja(c) };
      });
      const body = {
        fecha: new Date().toISOString().slice(0, 10),
        cajas: cajasArr,
        conteo: {
          ...conteo,
          total_conteo: totalConteoVal,
          total_cajas: totalCajasAjustado,
          diferencia,
          cuadra,
        },
        movimientos,
      };
      const res = await fetch("/api/retiradas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Error al guardar");
      setResultado({ id: data.id, total: data.total });
      setPaso(3);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Reset ──

  const reset = () => {
    setPaso(1);
    setCajasActivas(new Set());
    setCajasData({});
    setConteo(emptyConteo());
    setMovimientos([]);
    setResultado(null);
    setError("");
  };

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Retiradas de caja</h1>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        Paso {paso} de 3 — {paso === 1 ? "Selecciona cajas y cuenta billetes" : paso === 2 ? "Conteo total y validación" : "Guardado"}
      </p>

      {/* ═══════════ PASO 1: CAJAS ═══════════ */}
      {paso === 1 && (
        <>
          {/* Selector de cajas */}
          <div style={card}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Selecciona las cajas</h3>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(CAJAS_DISPONIBLES.length, 5)}, 1fr)`, gap: 8 }}>
              {CAJAS_DISPONIBLES.map((n) => {
                const active = cajasActivas.has(n);
                return (
                  <button
                    key={n}
                    onClick={() => toggleCaja(n)}
                    style={{
                      ...btnBase,
                      padding: "14px 0",
                      fontSize: 16,
                      background: active ? "var(--color-reig-green, #16a34a)" : "#f3f4f6",
                      color: active ? "#fff" : "#666",
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formulario por caja */}
          {Array.from(cajasActivas).sort().map((n) => {
            const c = cajasData[n] || emptyCaja();
            const t = totalCaja(c);
            return (
              <div key={n} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Caja {n}</h3>
                  <span style={{ fontWeight: 800, fontSize: 16, color: t > 0 ? "var(--color-reig-green, #16a34a)" : "#aaa" }}>
                    {eur(t)}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {BILLETES_CAJA.map(({ key, label, valor }) => (
                    <div key={key} style={{ textAlign: "center" }}>
                      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>{label}</label>
                      <input
                        type="number"
                        min={0}
                        value={c[key] || ""}
                        onChange={(e) => updateBillete(n, key, parseInt(e.target.value) || 0)}
                        style={{
                          width: "100%", padding: "8px 4px", border: "1px solid #e0e0e0",
                          borderRadius: 6, textAlign: "center", fontSize: 16, fontWeight: 600,
                        }}
                        placeholder="0"
                      />
                      {c[key] > 0 && (
                        <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{eur(c[key] * valor)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Resumen + Finalizar */}
          {cajasActivas.size > 0 && (
            <div style={{ ...card, background: "#f0fdf4", borderLeft: "4px solid var(--color-reig-green, #16a34a)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, color: "#666" }}>{cajasActivas.size} caja{cajasActivas.size > 1 ? "s" : ""} seleccionada{cajasActivas.size > 1 ? "s" : ""}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-reig-green, #16a34a)" }}>{eur(totalGlobal)}</div>
                </div>
                <button
                  onClick={() => { if (totalGlobal > 0) setPaso(2); }}
                  disabled={totalGlobal <= 0}
                  style={{
                    ...btnBase,
                    padding: "14px 32px",
                    fontSize: 16,
                    background: totalGlobal > 0 ? "var(--color-reig-green, #16a34a)" : "#ccc",
                    color: "#fff",
                  }}
                >
                  Finalizar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════ PASO 2: CONTEO ═══════════ */}
      {paso === 2 && (
        <>
          {/* Referencia */}
          <div style={{ ...card, background: "#f8fafc" }}>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>Total suma de cajas</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{eur(totalCajasAjustado)}</div>
            {ajustesTotal !== 0 && (
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                Original: {eur(totalGlobal)} {ajustesTotal > 0 ? "+" : ""}{eur(ajustesTotal)} ajustes
              </div>
            )}
          </div>

          {/* Conteo de billetes */}
          <div style={card}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Conteo total de billetes</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {BILLETES_CONTEO.map(({ key, label, valor }) => (
                <div key={key} style={{ textAlign: "center" }}>
                  <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>{label}</label>
                  <input
                    type="number"
                    min={0}
                    value={conteo[key] || ""}
                    onChange={(e) => setConteo((p) => ({ ...p, [key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                    style={{
                      width: "100%", padding: "8px 4px", border: "1px solid #e0e0e0",
                      borderRadius: 6, textAlign: "center", fontSize: 16, fontWeight: 600,
                    }}
                    placeholder="0"
                  />
                  {conteo[key] > 0 && (
                    <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{eur(conteo[key] * valor)}</div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ textAlign: "right", marginTop: 12, fontSize: 18, fontWeight: 800 }}>
              Total conteo: {eur(totalConteoVal)}
            </div>
          </div>

          {/* Resultado validación */}
          {totalConteoVal > 0 && (
            <div style={{
              ...card,
              background: cuadra ? "#f0fdf4" : "#fef2f2",
              borderLeft: `4px solid ${cuadra ? "#16a34a" : "#dc2626"}`,
            }}>
              {cuadra ? (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#16a34a", marginBottom: 8 }}>
                    El conteo cuadra
                  </div>
                  <button
                    onClick={guardar}
                    disabled={saving}
                    style={{
                      ...btnBase,
                      width: "100%",
                      padding: "14px 0",
                      fontSize: 16,
                      background: saving ? "#aaa" : "var(--color-reig-green, #16a34a)",
                      color: "#fff",
                    }}
                  >
                    {saving ? "Guardando..." : "Confirmar y guardar"}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>
                    No cuadra — diferencia: {eur(diferencia)}
                  </div>
                  <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>
                    {diferencia > 0
                      ? "El conteo tiene MAS dinero que la suma de cajas."
                      : "El conteo tiene MENOS dinero que la suma de cajas."}
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setShowModal("sacar")}
                      style={{ ...btnBase, flex: 1, background: "#fee2e2", color: "#dc2626" }}
                    >
                      Sacar de una caja
                    </button>
                    <button
                      onClick={() => setShowModal("ingresar")}
                      style={{ ...btnBase, flex: 1, background: "#dbeafe", color: "#2563eb" }}
                    >
                      Ingresar en caja
                    </button>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button
                      onClick={guardar}
                      disabled={saving}
                      style={{
                        ...btnBase,
                        width: "100%",
                        padding: "12px 0",
                        fontSize: 14,
                        background: saving ? "#aaa" : "#f59e0b",
                        color: "#fff",
                      }}
                    >
                      {saving ? "Guardando..." : "Guardar con diferencia"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Movimientos registrados */}
          {movimientos.length > 0 && (
            <div style={card}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Ajustes realizados</h3>
              {movimientos.map((m, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13,
                }}>
                  <span>
                    <span style={{ color: m.tipo === "ingresar" ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                      {m.tipo === "ingresar" ? "+" : "-"}{eur(m.importe)}
                    </span>
                    {" "}Caja {m.caja_num} — {m.motivo || "Sin motivo"}
                  </span>
                  <button
                    onClick={() => setMovimientos((p) => p.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 16 }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Botón volver */}
          <button
            onClick={() => setPaso(1)}
            style={{ ...btnBase, background: "#f3f4f6", color: "#666", marginBottom: 20 }}
          >
            Volver a cajas
          </button>

          {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{error}</div>}

          {/* Modal ajuste */}
          {showModal && (
            <div style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}
              onClick={() => setShowModal(null)}
            >
              <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: 340, maxWidth: "90vw" }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                  {showModal === "sacar" ? "Sacar de una caja" : "Ingresar en caja"}
                </h3>
                <label style={{ fontSize: 12, color: "#888" }}>Caja</label>
                <select
                  value={modalCaja}
                  onChange={(e) => setModalCaja(Number(e.target.value))}
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #e0e0e0", marginBottom: 12 }}
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>Caja {n}</option>
                  ))}
                </select>
                <label style={{ fontSize: 12, color: "#888" }}>Importe</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={modalImporte || ""}
                  onChange={(e) => setModalImporte(parseFloat(e.target.value) || 0)}
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #e0e0e0", marginBottom: 12, fontSize: 16 }}
                  placeholder="0.00"
                />
                <label style={{ fontSize: 12, color: "#888" }}>Motivo</label>
                <input
                  type="text"
                  value={modalMotivo}
                  onChange={(e) => setModalMotivo(e.target.value)}
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #e0e0e0", marginBottom: 16 }}
                  placeholder="Motivo del ajuste"
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setShowModal(null)}
                    style={{ ...btnBase, flex: 1, background: "#f3f4f6", color: "#666" }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={addMovimiento}
                    disabled={modalImporte <= 0}
                    style={{
                      ...btnBase, flex: 1,
                      background: showModal === "ingresar" ? "#2563eb" : "#dc2626",
                      color: "#fff",
                      opacity: modalImporte <= 0 ? 0.5 : 1,
                    }}
                  >
                    {showModal === "ingresar" ? "Ingresar" : "Sacar"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════ PASO 3: GUARDADO ═══════════ */}
      {paso === 3 && resultado && (
        <div style={{ ...card, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>&#10003;</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-reig-green, #16a34a)", marginBottom: 8 }}>
            Retirada guardada
          </h2>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{eur(resultado.total)}</div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
            {cajasActivas.size} caja{cajasActivas.size > 1 ? "s" : ""} — ID #{resultado.id}
          </div>
          {!cuadra && (
            <div style={{ fontSize: 13, color: "#f59e0b", marginBottom: 16 }}>
              Guardada con diferencia de {eur(diferencia)}
            </div>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={reset} style={{ ...btnBase, background: "var(--color-reig-green, #16a34a)", color: "#fff", padding: "12px 24px" }}>
              Nueva retirada
            </button>
            <button
              onClick={() => window.location.href = "/retiradas?view=historial"}
              style={{ ...btnBase, background: "#f3f4f6", color: "#666", padding: "12px 24px" }}
            >
              Ver historial
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
