"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Hook que registra cada navegación del usuario enviando un POST
 * a /api/admin/pageview. Fire-and-forget — nunca bloquea la UI.
 *
 * Uso: montar UNA VEZ en AppShell o layout cliente.
 *
 * Deduplicación: no envía dos veces la misma ruta consecutiva
 * (evita doble-render de React en dev).
 */
export function usePageView() {
  const pathname = usePathname();
  const lastSent = useRef<string>("");

  useEffect(() => {
    if (!pathname || pathname === lastSent.current) return;
    lastSent.current = pathname;

    // Fire-and-forget — no await, no catch visible al usuario
    fetch("/api/admin/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruta: pathname }),
    }).catch(() => {
      // Silencioso: si falla el tracking, la app sigue funcionando
    });
  }, [pathname]);
}
