"use client";

import { useState, useCallback } from "react";

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
  const [paso, setPaso] = useState<Paso>("cajas");
  const [fecha, setFecha] = useState(hoy());
  const [destino, setDestino] = useState<"caja_fuerte" | "bea">("caja_fuerte");
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
        destino,
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
    setFecha(hoy());
    setDestino("caja_fuerte");
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
      <h2 className="font-serif text-3xl text-reig-green mb-1">
        Retiradas de Caja
      </h2>
      <p className="text-gray-500 mb-6">Registro de retiradas de efectivo</p>

      {/* ── PASO 1: Selección de cajas ────────────────── */}
      {paso === "cajas" && cajaActual === null && (
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destino
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setDestino("caja_fuerte")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  destino === "caja_fuerte"
                    ? "bg-reig-green text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Caja fuerte
              </button>
              <button
                onClick={() => setDestino("bea")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  destino === "bea"
                    ? "bg-reig-green text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Entrega a Bea
              </button>
            </div>
          </div>

          <p className="text-sm font-medium text-gray-700 mb-3">
            Selecciona las cajas de las que vas a retirar:
          </p>
          <div className="grid grid-cols-5 gap-2 mb-6">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => toggleCaja(n)}
                className={`py-3 rounded-lg text-lg font-semibold transition-all ${
                  cajasSeleccionadas.includes(n)
                    ? "bg-reig-green text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          {cajasSeleccionadas.length > 0 && (
            <button
              onClick={empezarConteo}
              className="w-full py-3 bg-reig-green text-white rounded-lg font-semibold hover:bg-reig-green-dark transition-colors"
            >
              Empezar conteo ({cajasSeleccionadas.length} caja
              {cajasSeleccionadas.length > 1 ? "s" : ""})
            </button>
          )}
        </div>
      )}

      {/* ── PASO 2: Conteo de billetes por caja ───────── */}
      {paso === "cajas" && cajaActual !== null && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">
              Caja {cajaActual}
              <span className="text-sm text-gray-400 ml-2">
                ({cajasSeleccionadas.indexOf(cajaActual) + 1} de{" "}
                {cajasSeleccionadas.length})
              </span>
            </h3>
            <span className="text-2xl font-mono font-bold text-reig-green">
              {calcTotal(billetes).toFixed(2)} €
            </span>
          </div>

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
                  value={billetes[d] || ""}
                  onChange={(e) =>
                    setBillete(d, parseInt(e.target.value) || 0)
                  }
                  onFocus={(e) => e.target.select()}
                  className="w-20 text-center border border-gray-300 rounded-lg py-2 text-lg font-mono focus:border-reig-green focus:ring-1 focus:ring-reig-green outline-none"
                  inputMode="numeric"
                />
                <span className="text-gray-400">=</span>
                <span className="w-24 text-right font-mono text-lg">
                  {(d * billetes[d]).toFixed(2)} €
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={guardarCaja}
            className="w-full mt-6 py-3 bg-reig-green text-white rounded-lg font-semibold hover:bg-reig-green-dark transition-colors"
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
            {fecha} — Destino: {destino === "caja_fuerte" ? "Caja fuerte" : "Entrega a Bea"}
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
          <div className="flex justify-between items-center bg-reig-green-light rounded-lg px-4 py-3 mb-6">
            <span className="font-semibold text-reig-green">Total cajas</span>
            <span className="font-mono font-bold text-xl text-reig-green">
              {cajasData.reduce((s, c) => s + c.total, 0).toFixed(2)} €
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPaso("audit")}
              className="flex-1 py-3 bg-reig-green text-white rounded-lg font-semibold hover:bg-reig-green-dark transition-colors"
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
                  className="w-20 text-center border border-gray-300 rounded-lg py-2 text-lg font-mono focus:border-reig-green focus:ring-1 focus:ring-reig-green outline-none"
                  inputMode="numeric"
                />
                <span className="text-gray-400">=</span>
                <span className="w-24 text-right font-mono text-lg">
                  {(d * auditBilletes[d]).toFixed(2)} €
                </span>
                <span className="ml-auto text-xs text-gray-400">
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
            className="w-full py-3 bg-reig-green text-white rounded-lg font-semibold hover:bg-reig-green-dark transition-colors"
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
              className="flex-1 py-3 bg-reig-green text-white rounded-lg font-semibold hover:bg-reig-green-dark transition-colors disabled:opacity-50"
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
