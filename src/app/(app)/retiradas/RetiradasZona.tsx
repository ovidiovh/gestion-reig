"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createContext, useContext, Suspense } from "react";

type Zona = "farmacia" | "optica";

const ZonaContext = createContext<Zona>("farmacia");
export function useZona() { return useContext(ZonaContext); }

function RetiradasZonaInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const zona: Zona = searchParams.get("zona") === "optica" ? "optica" : "farmacia";

  const setZona = (z: Zona) => {
    const params = new URLSearchParams(searchParams.toString());
    if (z === "farmacia") params.delete("zona");
    else params.set("zona", z);
    const qs = params.toString();
    router.push(pathname + (qs ? `?${qs}` : ""));
  };

  const isFarma = zona === "farmacia";
  const activeColor = isFarma ? "var(--color-reig-green)" : "var(--color-reig-optica)";

  return (
    <ZonaContext.Provider value={zona}>
      {/* Barra de zona */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 10, overflow: "hidden", border: "1px solid #e0e0e0" }}>
        <button
          onClick={() => setZona("farmacia")}
          style={{
            flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 13, letterSpacing: 0.5,
            background: isFarma ? "var(--color-reig-green)" : "#f5f5f5",
            color: isFarma ? "#fff" : "#888",
            transition: "all 0.2s",
          }}
        >
          🏥 FARMACIA
        </button>
        <button
          onClick={() => setZona("optica")}
          style={{
            flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 13, letterSpacing: 0.5,
            background: !isFarma ? "var(--color-reig-optica)" : "#f5f5f5",
            color: !isFarma ? "#fff" : "#888",
            transition: "all 0.2s",
          }}
        >
          👓 ÓPTICA
        </button>
      </div>

      {/* Indicador visual de zona activa */}
      <div style={{
        height: 3, borderRadius: 2, marginBottom: 16, marginTop: -16,
        background: activeColor,
      }} />

      {children}
    </ZonaContext.Provider>
  );
}

export default function RetiradasZona({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div style={{ padding: 20, color: "#aaa" }}>Cargando...</div>}>
      <RetiradasZonaInner>{children}</RetiradasZonaInner>
    </Suspense>
  );
}
