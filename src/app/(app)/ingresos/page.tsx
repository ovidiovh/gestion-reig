"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ───── Tipos ───── */

interface Ingreso {
  id: number;
  fecha: string;
  hora: string | null;
  concepto: string;
  importe: number;
  num_operacion: string | null;
  origen: string;
  usuario_nombre: string | null;
  notas: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  farmacia: number;
  optica: number;
  pendientes: number;
  count: number;
}

type Paso = "listado" | "foto" | "ocr" | "formulario" | "guardado";

const CONCEPTOS = ["FARMACIA", "OPTICA", "REMESA FARMACIA", "REMESA OPTICA"] as const;

const COLORS = {
  green: "var(--color-reig-green)",
  greenLight: "var(--color-reig-green-light)",
  blue: "var(--color-reig-optica)",
  blueLight: "var(--color-reig-optica-light)",
  yellow: "var(--color-reig-warn)",
  yellowLight: "var(--color-reig-warn-light)",
  gray: "var(--color-reig-text-secondary)",
};

/* ───── Helpers ───── */

const eur = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

const conceptoColor = (c: string) => {
  if (c.includes("FARMACIA")) return { bg: COLORS.greenLight, fg: COLORS.green };
  if (c.includes("OPTICA")) return { bg: COLORS.blueLight, fg: COLORS.blue };
  return { bg: COLORS.yellowLight, fg: COLORS.yellow };
};

const origenBadge = (o: string) => {
  switch (o) {
    case "email": return { label: "Email", bg: "var(--color-reig-green-light)", fg: "var(--color-reig-green)" };
    case "foto":  return { label: "Foto",  bg: "var(--color-reig-optica-light)", fg: "var(--color-reig-optica)" };
    case "manual": return { label: "Manual", bg: "var(--color-reig-orto-light)", fg: "var(--color-reig-orto-mid)" };
    default: return { label: o, bg: "var(--color-reig-border-light)", fg: "var(--color-reig-text-secondary)" };
  }
};

/* ───── Componente de compresión de imagen ───── */

function compressImage(file: File, maxWidth: number = 1200, quality: number = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = (h * maxWidth) / w;
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No canvas context"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ───── Parser OCR ───── */

function parsearTextoOCR(texto: string): {
  fecha: string;
  hora: string;
  importe: string;
  num_operacion: string;
} {
  const result = { fecha: "", hora: "", importe: "", num_operacion: "" };

  // Fecha: buscar patrón YYYY-MM-DD o DD-MM-YYYY o DD/MM/YYYY
  const matchFecha = texto.match(/Fecha[:\s]*(\d{4}[-/]\d{2}[-/]\d{2})/i);
  if (matchFecha) {
    result.fecha = matchFecha[1].replace(/\//g, "-");
  } else {
    // Intentar formato DD-MM-YYYY
    const matchFecha2 = texto.match(/Fecha[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})/i);
    if (matchFecha2) {
      const parts = matchFecha2[1].split(/[-/]/);
      result.fecha = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  // Hora: buscar patrón HH:MM:SS
  const matchHora = texto.match(/Hora[:\s]*(\d{2}:\d{2}:\d{2})/i);
  if (matchHora) {
    result.hora = matchHora[1];
  }

  // Importe: buscar patrón con EUR o €
  const matchImporte = texto.match(/(?:efectivo|ingreso)[^€\d]*?([\d.,]+)\s*(?:€|EUR)/i);
  if (matchImporte) {
    result.importe = matchImporte[1].replace(/\./g, "").replace(",", ".");
  } else {
    // Buscar cualquier número grande con decimales
    const matchNum = texto.match(/([\d.]+,\d{2})\s*(?:€|EUR)/);
    if (matchNum) {
      result.importe = matchNum[1].replace(/\./g, "").replace(",", ".");
    }
  }

  // Nº Operación
  const matchOp = texto.match(/[Nn][°ºo]\s*(?:de\s*)?[Oo]peraci[oó]n[:\s]*([^\n]+)/i);
  if (matchOp) {
    result.num_operacion = matchOp[1].trim();
  }

  return result;
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */

export default function IngresosPage() {
  /* ── Estado ── */
  const [paso, setPaso] = useState<Paso>("listado");
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filtro, setFiltro] = useState("mes");
  const [loading, setLoading] = useState(true);

  // Upload + OCR
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string>("");
  const [fotoBase64, setFotoBase64] = useState<string>("");
  const [ocrTexto, setOcrTexto] = useState<string>("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrRunning, setOcrRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Formulario
  const [formFecha, setFormFecha] = useState("");
  const [formHora, setFormHora] = useState("");
  const [formImporte, setFormImporte] = useState("");
  const [formNumOp, setFormNumOp] = useState("");
  const [formConcepto, setFormConcepto] = useState<string>("FARMACIA");
  const [formNotas, setFormNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);

  /* ── Carga de datos ── */

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [ingRes, statsRes] = await Promise.all([
        fetch(`/api/ingresos?filtro=${filtro}`),
        fetch("/api/ingresos?stats=1"),
      ]);
      if (ingRes.ok) setIngresos(await ingRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) {
      console.error("Error cargando ingresos:", e);
    }
    setLoading(false);
  }, [filtro]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  /* ── Subida de foto ── */

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFotoFile(file);

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setFotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Comprimir para guardar
    const compressed = await compressImage(file, 1200, 0.7);
    setFotoBase64(compressed);

    setPaso("foto");
  };

  /* ── OCR ── */

  const ejecutarOCR = async () => {
    if (!fotoPreview) return;
    setOcrRunning(true);
    setOcrProgress(0);

    try {
      // Cargar Tesseract.js dinámicamente desde CDN
      // @ts-expect-error — Tesseract se carga desde CDN
      if (!window.Tesseract) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("No se pudo cargar Tesseract.js"));
          document.head.appendChild(script);
        });
      }

      // @ts-expect-error — Tesseract global
      const Tesseract = window.Tesseract;
      const worker = await Tesseract.createWorker("spa", 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data } = await worker.recognize(fotoPreview);
      setOcrTexto(data.text);

      // Parsear campos
      const parsed = parsearTextoOCR(data.text);
      if (parsed.fecha) setFormFecha(parsed.fecha);
      if (parsed.hora) setFormHora(parsed.hora);
      if (parsed.importe) setFormImporte(parsed.importe);
      if (parsed.num_operacion) setFormNumOp(parsed.num_operacion);

      await worker.terminate();
      setPaso("formulario");
    } catch (err) {
      console.error("Error OCR:", err);
      alert("Error en el OCR. Puedes rellenar los datos manualmente.");
      setPaso("formulario");
    }
    setOcrRunning(false);
  };

  const saltarOCR = () => {
    setPaso("formulario");
  };

  /* ── Guardar ── */

  const guardar = async () => {
    if (!formFecha || !formConcepto || !formImporte) {
      alert("Fecha, concepto e importe son obligatorios.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/ingresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: formFecha,
          hora: formHora || null,
          concepto: formConcepto,
          importe: parseFloat(formImporte),
          num_operacion: formNumOp || null,
          origen: fotoBase64 ? "foto" : "manual",
          foto_base64: fotoBase64 || null,
          notas: formNotas || null,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSavedId(data.id);
        setPaso("guardado");
        cargarDatos();
      } else {
        alert("Error: " + (data.error || "desconocido"));
      }
    } catch (e) {
      alert("Error de red: " + e);
    }
    setSaving(false);
  };

  /* ── Reset ── */

  const resetForm = () => {
    setPaso("listado");
    setFotoFile(null);
    setFotoPreview("");
    setFotoBase64("");
    setOcrTexto("");
    setOcrProgress(0);
    setFormFecha("");
    setFormHora("");
    setFormImporte("");
    setFormNumOp("");
    setFormConcepto("FARMACIA");
    setFormNotas("");
    setSavedId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  const card: React.CSSProperties = {
    background: "var(--color-reig-bg-surface)",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    marginBottom: 16,
  };

  const btnPrimary: React.CSSProperties = {
    background: COLORS.green,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  };

  const btnSecondary: React.CSSProperties = {
    background: "var(--color-reig-bg)",
    color: "var(--color-reig-text)",
    border: "1px solid var(--color-reig-border)",
    borderRadius: 8,
    padding: "10px 20px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  };

  /* ── PASO: LISTADO ── */
  if (paso === "listado") {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-reig-text)" }}>Ingresos Banco</h2>
          <button
            onClick={() => {
              resetForm();
              fileInputRef.current?.click();
            }}
            style={btnPrimary}
          >
            + Subir resguardo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Total mes", value: eur(stats.total), color: "var(--color-reig-text)" },
              { label: "Farmacia", value: eur(stats.farmacia), color: COLORS.green },
              { label: "Optica", value: eur(stats.optica), color: COLORS.blue },
              { label: "Pendientes", value: String(stats.pendientes), color: COLORS.yellow },
            ].map((s) => (
              <div key={s.label} style={{ ...card, textAlign: "center", marginBottom: 0 }}>
                <div style={{ fontSize: 11, color: COLORS.gray, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, marginTop: 4 }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: "flex", gap: 0, marginBottom: 16, borderRadius: 8, overflow: "hidden", border: "1px solid var(--color-reig-border)" }}>
          {[
            { key: "hoy", label: "Hoy" },
            { key: "semana", label: "Semana" },
            { key: "mes", label: "Mes" },
            { key: "todo", label: "Todo" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              style={{
                flex: 1,
                padding: "8px 0",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 12,
                background: filtro === f.key ? COLORS.green : "var(--color-reig-bg)",
                color: filtro === f.key ? "#fff" : "var(--color-reig-text-secondary)",
                transition: "all 0.2s",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ ...card, textAlign: "center", color: COLORS.gray }}>Cargando...</div>
        ) : ingresos.length === 0 ? (
          <div style={{ ...card, textAlign: "center", color: COLORS.gray }}>
            No hay ingresos en este periodo.
            <br />
            <span style={{ fontSize: 12 }}>Los ingresos confirmados por email aparecen aqui automaticamente.</span>
          </div>
        ) : (
          <div style={card}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-reig-border-light)" }}>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: COLORS.gray, fontWeight: 600 }}>Fecha</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: COLORS.gray, fontWeight: 600 }}>Concepto</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", color: COLORS.gray, fontWeight: 600 }}>Importe</th>
                  <th style={{ textAlign: "center", padding: "8px 6px", color: COLORS.gray, fontWeight: 600 }}>Origen</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: COLORS.gray, fontWeight: 600 }}>N.Op</th>
                </tr>
              </thead>
              <tbody>
                {ingresos.map((ing) => {
                  const cc = conceptoColor(ing.concepto);
                  const ob = origenBadge(ing.origen);
                  return (
                    <tr key={ing.id} style={{ borderBottom: "1px solid var(--color-reig-border-light)" }}>
                      <td style={{ padding: "10px 6px" }}>
                        <div style={{ fontWeight: 600 }}>{ing.fecha}</div>
                        {ing.hora && <div style={{ fontSize: 11, color: COLORS.gray }}>{ing.hora}</div>}
                      </td>
                      <td style={{ padding: "10px 6px" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 700,
                          background: cc.bg,
                          color: cc.fg,
                        }}>
                          {ing.concepto}
                        </span>
                      </td>
                      <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 700, fontSize: 14 }}>
                        {eur(ing.importe)}
                      </td>
                      <td style={{ padding: "10px 6px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontSize: 10,
                          fontWeight: 700,
                          background: ob.bg,
                          color: ob.fg,
                        }}>
                          {ob.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 6px", fontSize: 11, color: COLORS.gray }} className="font-mono-metric">
                        {ing.num_operacion ? ing.num_operacion.slice(-10) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Botón manual sin foto */}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button
            onClick={() => { resetForm(); setPaso("formulario"); }}
            style={{ ...btnSecondary, fontSize: 12 }}
          >
            Registrar ingreso sin foto
          </button>
        </div>
      </div>
    );
  }

  /* ── PASO: FOTO (preview) ── */
  if (paso === "foto") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Resguardo subido</h2>
        <div style={card}>
          {fotoPreview && (
            <img
              src={fotoPreview}
              alt="Resguardo"
              style={{ width: "100%", borderRadius: 8, marginBottom: 16 }}
            />
          )}
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={ejecutarOCR} style={btnPrimary} disabled={ocrRunning}>
              {ocrRunning ? `Leyendo... ${ocrProgress}%` : "Leer con OCR"}
            </button>
            <button onClick={saltarOCR} style={btnSecondary}>
              Rellenar manualmente
            </button>
          </div>
          {ocrRunning && (
            <div style={{ marginTop: 12, background: "var(--color-reig-bg)", borderRadius: 6, overflow: "hidden", height: 6 }}>
              <div style={{ height: "100%", background: COLORS.green, width: `${ocrProgress}%`, transition: "width 0.3s" }} />
            </div>
          )}
        </div>
        <button onClick={resetForm} style={{ ...btnSecondary, marginTop: 8 }}>
          Cancelar
        </button>
      </div>
    );
  }

  /* ── PASO: FORMULARIO ── */
  if (paso === "formulario") {
    const inputStyle: React.CSSProperties = {
      width: "100%",
      padding: "10px 12px",
      border: "1px solid var(--color-reig-border)",
      borderRadius: 8,
      fontSize: 14,
      boxSizing: "border-box",
    };

    const labelStyle: React.CSSProperties = {
      display: "block",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.gray,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    };

    return (
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
          Datos del ingreso
        </h2>

        {/* Vista previa de la foto (si hay) */}
        {fotoPreview && (
          <div style={{ ...card, padding: 12 }}>
            <img src={fotoPreview} alt="Resguardo" style={{ width: "100%", borderRadius: 8, maxHeight: 200, objectFit: "contain" }} />
            {ocrTexto && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 11, color: COLORS.gray, cursor: "pointer" }}>Ver texto OCR</summary>
                <pre style={{ fontSize: 10, color: "var(--color-reig-text-secondary)", whiteSpace: "pre-wrap", marginTop: 4, maxHeight: 120, overflow: "auto" }}>{ocrTexto}</pre>
              </details>
            )}
          </div>
        )}

        <div style={card}>
          {/* Concepto */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Concepto *</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {CONCEPTOS.map((c) => {
                const isActive = formConcepto === c;
                const cc = conceptoColor(c);
                return (
                  <button
                    key={c}
                    onClick={() => setFormConcepto(c)}
                    style={{
                      padding: "10px 8px",
                      border: isActive ? `2px solid ${cc.fg}` : "1px solid var(--color-reig-border)",
                      borderRadius: 8,
                      background: isActive ? cc.bg : "var(--color-reig-bg)",
                      color: isActive ? cc.fg : "var(--color-reig-text-muted)",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fecha + Hora */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Fecha *</label>
              <input
                type="date"
                value={formFecha}
                onChange={(e) => setFormFecha(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Hora</label>
              <input
                type="time"
                step="1"
                value={formHora}
                onChange={(e) => setFormHora(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Importe */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Importe (EUR) *</label>
            <input
              type="number"
              step="0.01"
              value={formImporte}
              onChange={(e) => setFormImporte(e.target.value)}
              placeholder="0.00"
              style={{ ...inputStyle, fontSize: 20, fontWeight: 700, textAlign: "right" }}
            />
          </div>

          {/* Nº Operación */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>N. Operacion</label>
            <input
              type="text"
              value={formNumOp}
              onChange={(e) => setFormNumOp(e.target.value)}
              placeholder="0049 5082 ..."
              style={inputStyle}
            />
          </div>

          {/* Notas */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Notas</label>
            <input
              type="text"
              value={formNotas}
              onChange={(e) => setFormNotas(e.target.value)}
              placeholder="Opcional..."
              style={inputStyle}
            />
          </div>

          {/* Botones */}
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={guardar} style={btnPrimary} disabled={saving}>
              {saving ? "Guardando..." : "Confirmar ingreso"}
            </button>
            <button onClick={resetForm} style={btnSecondary}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── PASO: GUARDADO ── */
  if (paso === "guardado") {
    return (
      <div style={{ maxWidth: 500, margin: "0 auto", textAlign: "center" }}>
        <div style={card}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>&#10003;</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: COLORS.green, marginBottom: 8 }}>
            Ingreso registrado
          </h2>
          <p style={{ color: "var(--color-reig-text-secondary)", fontSize: 14, marginBottom: 4 }}>
            {formConcepto} — {eur(parseFloat(formImporte || "0"))}
          </p>
          <p style={{ color: "var(--color-reig-text-secondary)", fontSize: 12, marginBottom: 20 }}>
            ID: {savedId} | Fecha: {formFecha}
          </p>
          <button onClick={resetForm} style={btnPrimary}>
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  return null;
}
