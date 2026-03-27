"use client";

import { useState, useEffect } from "react";

// ============================================================
// TIPOS
// ============================================================
interface VendedorRow {
  vendedor: string;
  facturacion: number;
  tickets: number;
  ticketMedio: number;
  unidades: number;
}

interface TicketRow {
  numDoc: string;
  hora: string;
  lineas: number;
  facturacion: number;
  tipoPago: string;
  tieneReceta: number;
  tieneLibre: number;
}

interface LineaRow {
  codigo: string;
  descripcion: string;
  unidades: number;
  pvp: number;
  importe: number;
  ta: string;
  esReceta: number;
}

type DrillLevel = "none" | "vendedores" | "tickets" | "lineas";

interface DrillDownProps {
  selectedDate: string | null;
  onClear: () => void;
}

const eur = (v: number) =>
  v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

// ============================================================
// COMPONENTE
// ============================================================
export default function DrillDown({ selectedDate, onClear }: DrillDownProps) {
  const [level, setLevel] = useState<DrillLevel>("none");
  const [vendedores, setVendedores] = useState<VendedorRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [lineas, setLineas] = useState<LineaRow[]>([]);
  const [selectedVendedor, setSelectedVendedor] = useState("");
  const [selectedTicket, setSelectedTicket] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch vendedores when date is selected
  useEffect(() => {
    if (!selectedDate) {
      setLevel("none");
      return;
    }
    setLoading(true);
    fetch(`/api/ventas/dia?fecha=${selectedDate}`)
      .then((r) => r.json())
      .then((d) => {
        setVendedores(d);
        setLevel("vendedores");
        setSelectedVendedor("");
        setSelectedTicket("");
      })
      .finally(() => setLoading(false));
  }, [selectedDate]);

  // Drill into vendedor
  function drillVendedor(vendedor: string) {
    if (!selectedDate) return;
    setLoading(true);
    setSelectedVendedor(vendedor);
    fetch(
      `/api/ventas/vendedor?fecha=${selectedDate}&vendedor=${encodeURIComponent(vendedor)}`
    )
      .then((r) => r.json())
      .then((d) => {
        setTickets(d);
        setLevel("tickets");
        setSelectedTicket("");
      })
      .finally(() => setLoading(false));
  }

  // Drill into ticket
  function drillTicket(numDoc: string) {
    setLoading(true);
    setSelectedTicket(numDoc);
    fetch(`/api/ventas/ticket?numDoc=${encodeURIComponent(numDoc)}`)
      .then((r) => r.json())
      .then((d) => {
        setLineas(d);
        setLevel("lineas");
      })
      .finally(() => setLoading(false));
  }

  // Breadcrumb navigation
  function goBack(to: DrillLevel) {
    if (to === "none") {
      onClear();
    } else if (to === "vendedores") {
      setLevel("vendedores");
      setSelectedVendedor("");
      setSelectedTicket("");
    } else if (to === "tickets") {
      setLevel("tickets");
      setSelectedTicket("");
    }
  }

  if (!selectedDate || level === "none") return null;

  return (
    <div className="bg-white rounded-xl border p-5 mt-4" style={{ borderColor: "#e5e7eb" }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-4 flex-wrap">
        <button
          onClick={() => goBack("none")}
          className="hover:underline"
          style={{ color: "#1a8c3a" }}
        >
          Gráfico
        </button>
        <span style={{ color: "#5a615c" }}>/</span>
        <button
          onClick={() => goBack("vendedores")}
          className="hover:underline"
          style={{ color: level === "vendedores" ? "#2a2e2b" : "#1a8c3a" }}
        >
          {selectedDate}
        </button>
        {selectedVendedor && (
          <>
            <span style={{ color: "#5a615c" }}>/</span>
            <button
              onClick={() => goBack("tickets")}
              className="hover:underline"
              style={{ color: level === "tickets" ? "#2a2e2b" : "#1a8c3a" }}
            >
              {selectedVendedor}
            </button>
          </>
        )}
        {selectedTicket && (
          <>
            <span style={{ color: "#5a615c" }}>/</span>
            <span style={{ color: "#2a2e2b" }}>{selectedTicket}</span>
          </>
        )}
      </div>

      {loading && (
        <div className="text-sm py-4 text-center" style={{ color: "#5a615c" }}>
          Cargando...
        </div>
      )}

      {/* LEVEL: Vendedores del día */}
      {!loading && level === "vendedores" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th className="text-left py-2 font-medium" style={{ color: "#5a615c" }}>Vendedor</th>
                <th className="text-right py-2 font-medium" style={{ color: "#5a615c" }}>Facturación</th>
                <th className="text-right py-2 font-medium" style={{ color: "#5a615c" }}>Tickets</th>
                <th className="text-right py-2 font-medium" style={{ color: "#5a615c" }}>Ticket medio</th>
                <th className="text-right py-2 font-medium" style={{ color: "#5a615c" }}>Uds</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => (
                <tr
                  key={v.vendedor}
                  onClick={() => drillVendedor(v.vendedor)}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ borderBottom: "1px solid #f3f4f6" }}
                >
                  <td className="py-2.5 font-medium" style={{ color: "#1a8c3a" }}>{v.vendedor}</td>
                  <td className="py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{eur(v.facturacion)}</td>
                  <td className="py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{v.tickets}</td>
                  <td className="py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{eur(v.ticketMedio)}</td>
                  <td className="py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{v.unidades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* LEVEL: Tickets del vendedor */}
      {!loading && level === "tickets" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th className="text-left py-2 font-medium" style={{ color: "#5a615c" }}>Ticket</th>
                <th className="text-left py-2 font-medium" style={{ color: "#5a615c" }}>Hora</th>
                <th className="text-right py-2 font-medium" style={{ color: "#5a615c" }}>Líneas</th>
                <th className="text-right py-2 font-medium" style={{ color: "#5a615c" }}>Importe</th>
                <th className="text-left py-2 font-medium" style={{ color: "#5a615c" }}>Pago</th>
                <th className="text-center py-2 font-medium" style={{ color: "#5a615c" }}>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.numDoc}
                  onClick={() => drillTicket(t.numDoc)}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ borderBottom: "1px solid #f3f4f6" }}
                >
                  <td className="py-2.5 font-medium" style={{ color: "#1a8c3a", fontFamily: "'JetBrains Mono', monospace" }}>
                    {t.numDoc}
                  </td>
                  <td className="py-2.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.hora}</td>
                  <td className="py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.lineas}</td>
                  <td className="py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{eur(t.facturacion)}</td>
                  <td className="py-2.5">{t.tipoPago}</td>
                  <td className="py-2.5 text-center">
                    {t.tieneReceta && t.tieneLibre ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: "#1a8c3a" }}>
                        Cross
                      </span>
                    ) : t.tieneReceta ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#e8f5ec", color: "#14702e" }}>
                        Receta
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#f3f4f6", color: "#5a615c" }}>
                        Libre
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* LEVEL: Líneas del ticket */}
      {!loading && level === "lineas" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th className="text-left py-2 font-medium" style={{ color: "#5a615c" }}>CN</th>
                <th className="text-left py-2 font-medium" style={{ color: "#5a615c" }}>Producto</th>
                <th className="text-right py-2 font-medium" style={{ color: "#5a615c" }}>Uds</th>
                <th className="text-right py-2 font-medium" style={{ color: "#5a615c" }}>PVP</th>
                <th className="text-right py-2 font-medium" style={{ color: "#5a615c" }}>Importe</th>
                <th className="text-center py-2 font-medium" style={{ color: "#5a615c" }}>TA</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td className="py-2.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", color: "#5a615c" }}>
                    {l.codigo}
                  </td>
                  <td className="py-2.5 max-w-xs truncate">{l.descripcion}</td>
                  <td className="py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{l.unidades}</td>
                  <td className="py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{eur(l.pvp)}</td>
                  <td className="py-2.5 text-right font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{eur(l.importe)}</td>
                  <td className="py-2.5 text-center">
                    {l.esReceta ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs" style={{ background: "#e8f5ec", color: "#14702e" }}>
                        {l.ta}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "#5a615c" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
