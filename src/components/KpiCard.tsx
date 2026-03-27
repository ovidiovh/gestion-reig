"use client";

interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  color?: string;
}

export default function KpiCard({ label, value, subtitle, color = "#1a8c3a" }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e5e7eb" }}>
      <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "#5a615c" }}>
        {label}
      </p>
      <p
        className="text-2xl font-semibold"
        style={{ color, fontFamily: "'JetBrains Mono', monospace" }}
      >
        {value}
      </p>
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: "#5a615c" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
