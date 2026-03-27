export const dynamic = "force-dynamic";

import {
  getResumenBase,
  getClienteKpis,
  getTopVendedores,
  getVentasPorDia,
  getVentasPorHora,
  getUltimasVentas,
  getTopProductos,
  getTablasInfo,
} from "@/lib/crm-queries";

function formatNum(n: number) {
  return n.toLocaleString("es-ES");
}

function formatEur(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2 }) + " €";
}

export default async function CrmPage() {
  const [resumen, kpis, vendedores, porDia, porHora, ultimas, productos, tablas] =
    await Promise.all([
      getResumenBase(),
      getClienteKpis(),
      getTopVendedores(8),
      getVentasPorDia(),
      getVentasPorHora(),
      getUltimasVentas(15),
      getTopProductos(10),
      getTablasInfo(),
    ]);

  const totalFacturacion = kpis.reduce((s, k) => s + k.facturacion, 0);
  const totalTickets = kpis.reduce((s, k) => s + k.tickets, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl md:text-3xl font-semibold"
          style={{ fontFamily: "'DM Serif Display', serif", color: "#2a2e2b" }}
        >
          CRM — Base de datos
        </h1>
        <p className="text-sm mt-1" style={{ color: "#5a615c" }}>
          Datos en tiempo real desde Turso (libSQL cloud)
        </p>
      </div>

      {/* Database info banner */}
      <div
        className="rounded-xl p-4 flex flex-wrap gap-6 text-sm"
        style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span style={{ color: "#166534" }}>Turso conectado</span>
        </div>
        <div style={{ color: "#166534" }}>
          <strong>{resumen?.total_filas ? formatNum(resumen.total_filas) : "—"}</strong> líneas de venta
        </div>
        <div style={{ color: "#166534" }}>
          <strong>{resumen?.total_ventas ? formatNum(resumen.total_ventas) : "—"}</strong> tickets
        </div>
        <div style={{ color: "#166534" }}>
          Datos: <strong>{resumen?.fecha_min}</strong> → <strong>{resumen?.fecha_max}</strong>
        </div>
        <div style={{ color: "#166534" }}>
          <strong>{resumen?.total_vendedores}</strong> vendedores
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Facturación total" value={formatEur(totalFacturacion)} />
        <KpiCard label="Tickets totales" value={formatNum(totalTickets)} />
        <KpiCard
          label="Ticket medio"
          value={totalTickets > 0 ? formatEur(totalFacturacion / totalTickets) : "—"}
        />
        <KpiCard label="Tablas en BD" value={String(tablas.length)} />
      </div>

      {/* Crédito vs Contado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Tipo de venta">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ color: "#6b7280" }}>
                <th className="pb-2 font-medium">Tipo</th>
                <th className="pb-2 font-medium text-right">Tickets</th>
                <th className="pb-2 font-medium text-right">Facturación</th>
                <th className="pb-2 font-medium text-right">Ticket medio</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((k) => (
                <tr key={k.tipo} className="border-b border-gray-50">
                  <td className="py-2 font-medium" style={{ color: "#2a2e2b" }}>
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2"
                      style={{ background: k.tipo === "Credito" ? "#3b82f6" : "#0C6D32" }}
                    />
                    {k.tipo}
                  </td>
                  <td className="py-2 text-right" style={{ color: "#5a615c" }}>
                    {formatNum(k.tickets)}
                  </td>
                  <td className="py-2 text-right" style={{ color: "#5a615c" }}>
                    {formatEur(k.facturacion)}
                  </td>
                  <td className="py-2 text-right" style={{ color: "#5a615c" }}>
                    {formatEur(k.ticket_medio)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Ventas por franja horaria">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ color: "#6b7280" }}>
                <th className="pb-2 font-medium">Franja</th>
                <th className="pb-2 font-medium text-right">Tickets</th>
                <th className="pb-2 font-medium text-right">Facturación</th>
              </tr>
            </thead>
            <tbody>
              {porHora.map((h) => (
                <tr key={h.franja} className="border-b border-gray-50">
                  <td className="py-2" style={{ color: "#2a2e2b" }}>{h.franja}</td>
                  <td className="py-2 text-right" style={{ color: "#5a615c" }}>
                    {formatNum(h.tickets)}
                  </td>
                  <td className="py-2 text-right" style={{ color: "#5a615c" }}>
                    {formatEur(h.facturacion)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Vendedores + Día de la semana */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Top vendedores">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ color: "#6b7280" }}>
                <th className="pb-2 font-medium">Vendedor</th>
                <th className="pb-2 font-medium text-right">Tickets</th>
                <th className="pb-2 font-medium text-right">Facturación</th>
                <th className="pb-2 font-medium text-right">T. medio</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v, i) => (
                <tr key={v.vendedor} className="border-b border-gray-50">
                  <td className="py-2" style={{ color: "#2a2e2b" }}>
                    <span className="text-xs text-gray-400 mr-2">{i + 1}</span>
                    {v.vendedor}
                  </td>
                  <td className="py-2 text-right" style={{ color: "#5a615c" }}>
                    {formatNum(v.tickets)}
                  </td>
                  <td className="py-2 text-right" style={{ color: "#5a615c" }}>
                    {formatEur(v.facturacion)}
                  </td>
                  <td className="py-2 text-right" style={{ color: "#5a615c" }}>
                    {formatEur(v.ticket_medio)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] mt-2" style={{ color: "#9ca3af" }}>
            * Métricas por vendedor distorsionadas (se ticketea con usuario ajeno)
          </p>
        </Card>

        <Card title="Ventas por día de la semana">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ color: "#6b7280" }}>
                <th className="pb-2 font-medium">Día</th>
                <th className="pb-2 font-medium text-right">Tickets</th>
                <th className="pb-2 font-medium text-right">Facturación</th>
              </tr>
            </thead>
            <tbody>
              {porDia.map((d) => (
                <tr key={d.dia} className="border-b border-gray-50">
                  <td className="py-2" style={{ color: "#2a2e2b" }}>{d.dia_nombre}</td>
                  <td className="py-2 text-right" style={{ color: "#5a615c" }}>
                    {formatNum(d.tickets)}
                  </td>
                  <td className="py-2 text-right" style={{ color: "#5a615c" }}>
                    {formatEur(d.facturacion)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Top productos */}
      <Card title="Top 10 productos (por unidades)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ color: "#6b7280" }}>
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Código</th>
                <th className="pb-2 font-medium">Descripción</th>
                <th className="pb-2 font-medium text-right">Uds.</th>
                <th className="pb-2 font-medium text-right">Facturación</th>
                <th className="pb-2 font-medium text-right">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p, i) => (
                <tr key={p.codigo + i} className="border-b border-gray-50">
                  <td className="py-2 text-gray-400">{i + 1}</td>
                  <td className="py-2 font-mono text-xs" style={{ color: "#5a615c" }}>
                    {p.codigo}
                  </td>
                  <td className="py-2 max-w-[280px] truncate" style={{ color: "#2a2e2b" }}>
                    {p.descripcion}
                  </td>
                  <td className="py-2 text-right" style={{ color: "#5a615c" }}>
                    {formatNum(p.unidades)}
                  </td>
                  <td className="py-2 text-right" style={{ color: "#5a615c" }}>
                    {formatEur(p.facturacion)}
                  </td>
                  <td className="py-2 text-right" style={{ color: "#5a615c" }}>
                    {formatNum(p.tickets)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Últimas ventas */}
      <Card title="Últimas 15 líneas de venta">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ color: "#6b7280" }}>
                <th className="pb-2 font-medium">Fecha</th>
                <th className="pb-2 font-medium">Doc</th>
                <th className="pb-2 font-medium">Tipo</th>
                <th className="pb-2 font-medium">Vendedor</th>
                <th className="pb-2 font-medium">Descripción</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {ultimas.map((v, i) => (
                <tr key={v.num_doc + i} className="border-b border-gray-50">
                  <td className="py-2 whitespace-nowrap" style={{ color: "#5a615c" }}>
                    {v.fecha}
                  </td>
                  <td className="py-2 font-mono text-xs" style={{ color: "#5a615c" }}>
                    {v.num_doc}
                  </td>
                  <td className="py-2">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{
                        background: v.tipo === "Credito" ? "#dbeafe" : "#dcfce7",
                        color: v.tipo === "Credito" ? "#1d4ed8" : "#166534",
                      }}
                    >
                      {v.tipo}
                    </span>
                  </td>
                  <td className="py-2" style={{ color: "#5a615c" }}>{v.vendedor}</td>
                  <td className="py-2 max-w-[200px] truncate" style={{ color: "#2a2e2b" }}>
                    {v.descripcion}
                  </td>
                  <td className="py-2 text-right font-medium" style={{ color: "#2a2e2b" }}>
                    {formatEur(v.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Database tables */}
      <Card title="Tablas en Turso">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tablas.map((t) => (
            <div
              key={t.tabla}
              className="rounded-lg p-3"
              style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}
            >
              <p className="font-mono text-xs font-medium" style={{ color: "#2a2e2b" }}>
                {t.tabla}
              </p>
              <p className="text-lg font-semibold mt-1" style={{ color: "#0C6D32" }}>
                {formatNum(t.filas)}
              </p>
              <p className="text-[10px]" style={{ color: "#9ca3af" }}>filas</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ── Componentes auxiliares ── */

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="bg-white rounded-xl p-4"
      style={{ border: "1px solid #e5e7eb" }}
    >
      <p className="text-xs mb-1" style={{ color: "#6b7280" }}>{label}</p>
      <p className="text-xl font-semibold" style={{ color: "#2a2e2b" }}>{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="bg-white rounded-xl p-5"
      style={{ border: "1px solid #e5e7eb" }}
    >
      <h2
        className="text-base font-semibold mb-4"
        style={{ color: "#2a2e2b" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
