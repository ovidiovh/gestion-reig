export default function HistorialPage() {
  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-xl md:text-2xl font-semibold"
          style={{ fontFamily: "'DM Serif Display', serif", color: "#2a2e2b" }}
        >
          Historial
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#5a615c" }}>
          Retiradas registradas y remesas bancarias
        </p>
      </div>

      {/* Placeholder — the full historial with tabs will be implemented here */}
      <div
        className="bg-white rounded-xl border p-8 text-center"
        style={{ borderColor: "#e5e7eb" }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "#e8f5ec", color: "#0C6D32" }}
        >
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: "#2a2e2b" }}>
          Historial de retiradas
        </h2>
        <p className="text-sm" style={{ color: "#5a615c" }}>
          Aqui se mostrara el historial completo con las pestanas de retiradas y remesas bancarias.
        </p>
      </div>
    </div>
  );
}
