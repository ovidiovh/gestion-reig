"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface TimeChartProps {
  data: { periodo: string; facturacion: number; tickets: number }[];
  onBarClick?: (periodo: string) => void;
  selectedPeriodo?: string;
}

const formatEur = (v: number) =>
  v >= 1000
    ? `${(v / 1000).toFixed(0)}K`
    : v.toFixed(0);

export default function TimeChart({ data, onBarClick, selectedPeriodo }: TimeChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-sm" style={{ color: "#5a615c" }}>
        Sin datos para el período seleccionado
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="periodo"
          tick={{ fontSize: 11, fill: "#5a615c", fontFamily: "'JetBrains Mono', monospace" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#5a615c", fontFamily: "'JetBrains Mono', monospace" }}
          tickFormatter={formatEur}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <Tooltip
          formatter={(value) => [`${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`, "Facturación"]}
          labelStyle={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
        />
        <Bar
          dataKey="facturacion"
          radius={[4, 4, 0, 0]}
          cursor="pointer"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={(entry: any) => onBarClick?.(entry?.periodo)}
        >
          {data.map((entry) => (
            <Cell
              key={entry.periodo}
              fill={entry.periodo === selectedPeriodo ? "#14702e" : "#1a8c3a"}
              opacity={selectedPeriodo && entry.periodo !== selectedPeriodo ? 0.4 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
