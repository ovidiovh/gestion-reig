import Link from "next/link";

export default function RetiradasPage() {
  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-xl md:text-2xl font-semibold"
          style={{ fontFamily: "'DM Serif Display', serif", color: "#2a2e2b" }}
        >
          Nueva retirada
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#5a615c" }}>
          Registrar retirada de efectivo
        </p>
      </div>

      {/* Placeholder — the full 5-step flow will be implemented here */}
      <div
        className="bg-white rounded-xl border p-8 text-center"
        style={{ borderColor: "#e5e7eb" }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "#e8f5ec", color: "#0C6D32" }}
        >
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: "#2a2e2b" }}>
          Modulo de retiradas
        </h2>
        <p className="text-sm mb-6" style={{ color: "#5a615c" }}>
          El flujo completo de conteo de cajas se integrara aqui.
          <br />
          Por ahora puedes consultar el historial.
        </p>
        <Link
          href="/retiradas/historial"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ background: "#0C6D32" }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Ir al historial
        </Link>
      </div>
    </div>
  );
}
