"use client";

export default function CrmPage() {
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
          Análisis de ventas y clientes · Farmacia Reig
        </p>
      </div>

      {/* Banner datos pendientes */}
      <div
        className="rounded-xl p-8 text-center"
        style={{ background: "#fffbeb", border: "2px dashed #fde68a" }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
        <h2 className="text-lg font-bold mb-2" style={{ color: "#92400e" }}>
          Datos pendientes de importar
        </h2>
        <p className="text-sm max-w-md mx-auto" style={{ color: "#78350f" }}>
          La tabla <code className="font-mono bg-amber-100 px-1 rounded">ventas</code> aún
          no está sincronizada con la base de datos en la nube (Turso).
          Los datos de ventas residen en el sistema local de la farmacia y
          están pendientes de migración.
        </p>
        <div
          className="mt-6 rounded-lg p-4 text-left max-w-sm mx-auto text-xs space-y-1"
          style={{ background: "#fef3c7", color: "#92400e" }}
        >
          <p className="font-bold">Pasos para importar:</p>
          <p>1. Exportar diario de ventas desde el TPV</p>
          <p>2. Subir el fichero Excel al módulo de importación</p>
          <p>3. Ejecutar la migración desde el panel de administración</p>
        </div>
      </div>
    </div>
  );
}
