"use client";

import { useState, useCallback } from "react";
import { useZona } from "./layout";

// ─── Tipos ───────────────────────────────────────────────
const DENOMINACIONES = [200, 100, 50, 20, 10, 5] as const;
type Denom = (typeof DENOMINACIONES)[number];
type Billetes = Record<Denom, number>;

interface CajaData {
  num_caja: number;
  billetes: Billetes;
  total: number;
}

type Paso = "cajas" | "resumen" | "audit" | "resultado";

const emptyBilletes = (): Billetes => ({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 });
const calcTotal = (b: Billetes) =>
  DENOMINACIONES.reduce((sum, d) => sum + d * b[d], 0);

const hoy = () => new Date().toISOString().slice(0, 10);

// ─── Componente principal ────────────────────────────────
export default function RetiradasPage() {
  const zona = useZona();
  const isFarma = zona === "farmacia";
  const CAJAS_DISPONIBLES = isFarma ? Array.from({ length: 10 }, (_, i) => i + 1) : [11];
  const accentColor = isFarma ? "var(--color-reig-green)" : "var(--color-reig-optica)";
  const accentDark  = isFarma ? "var(--color-reig-green-dark)" : "var(--color-reig-optica-dark)";
  const accentLight = isFarma ? "var(--color-reig-green-light)" : "var(--color-reig-optica-light)";

  const [paso, setPaso] = useState<Paso>("cajas");
  const fecha = hoy(); // Siempre hoy, no editable
  const [cajasSeleccionadas, setCajasSeleccionadas] = useState<number[]>([]);
  const [cajaActual, setCajaActual] = useState<number | null>(null);
  const [cajasData, setCajasData] = useState<CajaData[]>([]);
  const [billetes, setBilletes] = useState<Billetes>(emptyBilletes());
  const [auditBilletes, setAuditBilletes] = useState<Billetes>(emptyBilletes());
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{
    ok: boolean;
    cuadra: boolean;
    totalCajas: number;
    totalAudit: number;
    detalle: { denom: Denom; cajas: number; audit: number; ok: boolean }[];
  } | null>(null);

  // ─── Selección de cajas ──────────────────────────────
  const toggleCaja = (n: number) => {
    setCajasSeleccionadas((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)
    );
  };

  const empezarConteo = () => {
    if (cajasSeleccionadas.length === 0) return;
    setCajaActual(cajasSeleccionadas[0]);
    setBilletes(emptyBilletes());
  };

  // ─── Conteo por caja ────────────────────────────────
  const setBillete = (denom: Denom, valor: number) => {
    setBilletes((prev) => ({ ...prev, [denom]: Math.max(0, valor) }));
  };

  const guardarCaja = () => {
    if (cajaActual === null) return;
    const total = calcTotal(billetes);
    const nueva: CajaData = { num_caja: cajaActual, billetes: { ...billetes }, total };

    setCajasData((prev) => {
      const sin = prev.filter((c) => c.num_caja !== cajaActual);
      return [...sin, nueva].sort((a, b) => a.num_caja - b.num_caja);
    });

    // Siguiente caja o resumen
    const idx = cajasSeleccionadas.indexOf(cajaActual);
    if (idx < cajasSeleccionadas.length - 1) {
      setCajaActual(cajasSeleccionadas[idx + 1]);
      setBilletes(emptyBilletes());
    } else {
      setCajaActual(null);
      setPaso("resumen");
    }
  };

  // ─── Auditoría ───────────────────────────────────────
  const setAuditBillete = (denom: Denom, valor: number) => {
    setAuditBilletes((prev) => ({ ...prev, [denom]: Math.max(0, valor) }));
  };

  const sumarPorDenom = useCallback(
    (denom: Denom) => cajasData.reduce((s, c) => s + c.billetes[denom], 0),
    [cajasData]
  );

  const ejecutarAudit = () => {
    const totalCajas = cajasData.reduce((s, c) => s + c.total, 0);
    const totalAudit = calcTotal(auditBilletes);
    const detalle = DENOMINACIONES.map((d) => ({
      denom: d,
      cajas: sumarPorDenom(d),
      audit: auditBilletes[d],
      ok: sumarPorDenom(d) === auditBilletes[d],
    }));
    const cuadra = detalle.every((d) => d.ok);
    setResultado({ ok: true, cuadra, totalCajas, totalAudit, detalle });
    setPaso("resultado");
  };

  // ─── Guardar en servidor ─────────────────────────────
  const guardarTodo = async () => {
    setGuardando(true);
    try {
      const body = {
        fecha,
        destino: "caja_fuerte",
        origen: zona,
        cajas: cajasData.map((c) => ({
          num_caja: c.num_caja,
          b200: c.billetes[200], b100: c.billetes[100], b50: c.billetes[50],
          b20: c.billetes[20], b10: c.billetes[10], b5: c.billetes[5],
        })),
        audit: {
          b200: auditBilletes[200], b100: auditBilletes[100], b50: auditBilletes[50],
          b20: auditBilletes[20], b10: auditBilletes[10], b5: auditBilletes[5],
        },
      };
      const res = await fetch("/api/retiradas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      alert("Retirada guardada correctamente");
    } catch (err) {
      alert("Error al guardar: " + String(err));
    } finally {
      setGuardando(false);
    }
  };

  const reset = () => {
    setPaso("cajas");
    // fecha se calcula siempre con hoy()
    setCajasSeleccionadas([]);
    setCajaActual(null);
    setCajasData([]);
    setBilletes(emptyBilletes());
    setAuditBilletes(emptyBilletes());
    setResultado(null);
  };

  // ─── RENDER ──────────────────────────────────────────
  return (
    <div className="max-w-2xl">
      <h2 className="font-serif text-3xl mb-1" style={{ color: accentColor }}>
        Retiradas — {isFarma ? "Farmacia" : "Óptica"}
      </h2>
      <p className="text-gray-500 mb-6">
        {isFarma ? "Cajas 1-10 · Registro de retiradas de efectivo" : "Caja 11 · Retirada de óptica"}
      </p>

      {/* ── PASO 1: Selección de cajas ────────────────── */}
      {paso === "cajas" && cajaActual === null && (
        <div>
          {/* Fecha: siempre hoy */}
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
            <span>Fecha:</span>
            <span className="font-mono font-medium text-gray-800">
              {new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>

          <p className="text-sm font-medium text-gray-700 mb-3">
            Selecciona las cajas de las que vas a retirar:
          </p>
          <div className={`grid gap-2 mb-6 ${isFarma ? "grid-cols-5" : "grid-cols-1 max-w-[200px]"}`}>
            {CAJAS_DISPONIBLES.map((n) => (
              <button
                key={n}
                onClick={() => toggleCaja(n)}
                style={{
                  padding: "12px", borderRadius: 8, fontSize: 16, fontWeight: 700,
                  transition: "all 0.2s",
                  background: cajasSeleccionadas.includes(n) ? accentColor : "#f3f4f6",
                  color: cajasSeleccionadas.includes(n) ? "#fff" : "#666",
                  boxShadow: cajasSeleccionadas.includes(n) ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                  border: "none", cursor: "pointer",
                }}
              >
                {n === 11 ? "Óptica (11)" : n}
              </button>
            ))}
          </div>

          {cajasSeleccionadas.length > 0 && (
            <button
              onClick={empezarConteo}
              style={{ width: "100%", padding: "12px", background: accentColor, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}
            >
              {isFarma
                ? `Empezar conteo (${cajasSeleccionadas.length} caja${cajasSeleccionadas.length > 1 ? "s" : ""})`
                : "Empezar conteo óptica"
              }
            </button>
          )}
        </div>
      )}

      {/* ── PASO 2: Conteo de billetes por caja ───────── */}
      {paso === "cajas" && cajaActual !== null && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg sm:text-xl font-semibold">
              Caja {cajaActual}
              <span className="text-xs sm:text-sm text-gray-400 ml-2">
                ({cajasSeleccionadas.indexOf(cajaActual) + 1}/{cajasSeleccionadas.length})
              </span>
            </h3>
            <span className="text-xl sm:text-2xl font-mono font-bold" style={{ color: accentColor }}>
              {calcTotal(billetes).toFixed(2)} €
            </span>
          </div>

          <div className="space-y-3">
            {DENOMINACIONES.map((d) => (
              <div
                key={d}
                className="flex items-center gap-2 sm:gap-4 bg-gray-50 rounded-lg p-2 sm:p-3"
              >
                <span className="w-12 sm:w-16 text-right font-mono font-semibold text-base sm:text-lg">
                  {d}€
                </span>
                <span className="text-gray-400 text-sm">×</span>
                <input
                  type="number"
                  min={0}
                  value={billetes[d] || ""}
                  onChange={(e) =>
                    setBillete(d, parseInt(e.target.value) || 0)
                  }
                  onFocus={(e) => e.target.select()}
                  className="w-16 sm:w-20 text-center border border-gray-300 rounded-lg py-2 text-base sm:text-lg font-mono outline-none focus:ring-2"
                  inputMode="numeric"
                />
                <span className="text-gray-400 text-sm">=</span>
                <span className="flex-1 text-right font-mono text-base sm:text-lg">
                  {(d * billetes[d]).toFixed(0)}€
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={guardarCaja}
            style={{ width: "100%", marginTop: 24, padding: "12px", background: accentColor, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}
          >
            {cajasSeleccionadas.indexOf(cajaActual) <
            cajasSeleccionadas.length - 1
              ? `Siguiente caja (${
                  cajasSeleccionadas[cajasSeleccionadas.indexOf(cajaActual) + 1]
                })`
              : "Finalizar conteo"}
          </button>
        </div>
      )}

      {/* ── PASO 3: Resumen antes de auditoría ─────────── */}
      {paso === "resumen" && (
        <div>
          <h3 className="text-xl font-semibold mb-2">Resumen de cajas</h3>
          <p className="text-sm text-gray-500 mb-4">
            {new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })} — Destino: Caja fuerte
          </p>
          <div className="space-y-2 mb-4">
            {cajasData.map((c) => (
              <div
                key={c.num_caja}
                className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3"
              >
                <span className="font-medium">Caja {c.num_caja}</span>
                <span className="font-mono font-bold">
                  {c.total.toFixed(2)} €
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center rounded-lg px-4 py-3 mb-6" style={{ background: accentLight }}>
            <span className="font-semibold" style={{ color: accentColor }}>Total cajas</span>
            <span className="font-mono font-bold text-xl" style={{ color: accentColor }}>
              {cajasData.reduce((s, c) => s + c.total, 0).toFixed(2)} €
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPaso("audit")}
              style={{ flex: 1, padding: "12px", background: accentColor, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}
            >
              Verificar (auditoría)
            </button>
            <button
              onClick={() => {
                setCajaActual(cajasSeleccionadas[0]);
                setBilletes(emptyBilletes());
                setCajasData([]);
                setPaso("cajas");
              }}
              className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Repetir
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 4: Auditoría ──────────────────────────── */}
      {paso === "audit" && (
        <div>
          <h3 className="text-xl font-semibold mb-2">Verificación</h3>
          <p className="text-sm text-gray-500 mb-4">
            Cuenta todos los billetes juntos por denominación y pon la cantidad
            total de cada tipo:
          </p>

          <div className="space-y-3">
            {DENOMINACIONES.map((d) => (
              <div
                key={d}
                className="flex items-center gap-4 bg-gray-50 rounded-lg p-3"
              >
                <span className="w-16 text-right font-mono font-semibold text-lg">
                  {d} €
                </span>
                <span className="text-gray-400">×</span>
                <input
                  type="number"
                  min={0}
                  value={auditBilletes[d] || ""}
                  onChange={(e) =>
                    setAuditBillete(d, parseInt(e.target.value) || 0)
                  }
                  onFocus={(e) => e.target.select()}
                  className="w-20 text-center border border-gray-300 rounded-lg py-2 text-lg font-mono outline-none focus:ring-2"
                  inputMode="numeric"
                />
                <span className="text-gray-400">=</span>
                <span className="w-24 text-right font-mono text-lg">
                  {(d * auditBilletes[d]).toFixed(2)} €
                </span>
                <span className="text-xs text-gray-400 hidden sm:inline">
                  cajas: {sumarPorDenom(d)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center bg-gray-100 rounded-lg px-4 py-3 mt-4 mb-6">
            <span className="font-medium">Total verificación</span>
            <span className="font-mono font-bold text-xl">
              {calcTotal(auditBilletes).toFixed(2)} €
            </span>
          </div>

          <button
            onClick={ejecutarAudit}
            style={{ width: "100%", padding: "12px", background: accentColor, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}
          >
            Comprobar
          </button>
        </div>
      )}

      {/* ── PASO 5: Resultado ──────────────────────────── */}
      {paso === "resultado" && resultado && (
        <div>
          <div
            className={`p-6 rounded-xl mb-6 text-center ${
              resultado.cuadra
                ? "bg-green-50 border-2 border-green-300"
                : "bg-red-50 border-2 border-red-300"
            }`}
          >
            <span className="text-4xl">
              {resultado.cuadra ? "✓" : "✗"}
            </span>
            <h3
              className={`text-2xl font-bold mt-2 ${
                resultado.cuadra ? "text-green-700" : "text-red-700"
              }`}
            >
              {resultado.cuadra ? "CUADRA" : "DESCUADRE"}
            </h3>
            <p className="text-sm mt-1 text-gray-600">
              Cajas: {resultado.totalCajas.toFixed(2)} € — Verificación:{" "}
              {resultado.totalAudit.toFixed(2)} €
            </p>
          </div>

          {/* Detalle por denominación */}
          <div className="space-y-1 mb-6">
            {resultado.detalle.map((d) => (
              <div
                key={d.denom}
                className={`flex items-center justify-between px-4 py-2 rounded-lg text-sm ${
                  d.ok ? "bg-gray-50" : "bg-red-50"
                }`}
              >
                <span className="font-mono font-medium">{d.denom} €</span>
                <span>
                  Cajas: <strong>{d.cajas}</strong> — Conteo:{" "}
                  <strong>{d.audit}</strong>
                </span>
                <span>{d.ok ? "✓" : `✗ (dif: ${d.audit - d.cajas})`}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={guardarTodo}
              disabled={guardando}
              className="flex-1 py-3 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              style={{ background: accentColor }}
            >
              {guardando ? "Guardando..." : "Guardar retirada"}
            </button>
            <button
              onClick={reset}
              className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Nueva
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
