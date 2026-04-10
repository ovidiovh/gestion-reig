"use client";

/**
 * Marketing → Paciente crónico — Árbol de decisión
 *
 * Visualización del recorrido del paciente crónico en Farmacia Reig.
 * Basado en el análisis de 9.797 pacientes crónicos (feb 2024 – mar 2026).
 *
 * Los datos están embebidos en el componente (no hay JSON externo) porque
 * son conclusiones de un estudio puntual, no datos que se regeneran.
 */

import React from "react";

/* ── Colores Reig ── */
const VERDE_OSC = "#1B5E20";
const VERDE = "#2E7D32";
const VERDE_MED = "#4CAF50";
const VERDE_CL = "#E8F5E9";
const VERDE_G4 = "#66bb6a";
const TXT = "#111827";
const TXT2 = "#4B5563";

const fmt = (n: number) => n.toLocaleString("es-ES");

/* ── Componentes reutilizables ── */

function NodeBox({
  children, bg, border, borderStyle, color, textCenter, maxWidth, style,
}: {
  children: React.ReactNode; bg: string; border?: string; borderStyle?: string;
  color?: string; textCenter?: boolean; maxWidth?: number; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      borderRadius: 10, padding: "14px 18px", background: bg,
      border: border ? `2px ${borderStyle || "solid"} ${border}` : undefined,
      color: color || TXT, textAlign: textCenter ? "center" : undefined,
      maxWidth, margin: maxWidth ? "0 auto" : undefined, ...style,
    }}>
      {children}
    </div>
  );
}

function Dato({ children, color, size }: { children: React.ReactNode; color?: string; size?: number }) {
  return <div style={{ fontSize: size || 26, fontWeight: 700, color: color || "inherit", lineHeight: 1.2 }}>{children}</div>;
}

function Sub({ children, color, style }: { children: React.ReactNode; color?: string; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 13, color: color || TXT2, marginTop: 2, lineHeight: 1.5, ...style }}>{children}</div>;
}

function Tag({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.5, marginTop: 6, background: bg, color,
    }}>
      {children}
    </span>
  );
}

function Connector() {
  return <div style={{ width: 2, height: 14, background: VERDE, margin: "0 auto" }} />;
}

function SplitLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      textAlign: "center", fontSize: 12, fontWeight: 600, color: VERDE,
      textTransform: "uppercase", letterSpacing: 1, margin: "12px 0 4px",
    }}>
      {children}
    </div>
  );
}

function ArrowLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: "center", fontSize: 11, color: VERDE, fontWeight: 500, padding: "2px 0" }}>{children}</div>;
}

function Insight({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: VERDE_CL, borderLeft: `4px solid ${VERDE}`,
      padding: "12px 16px", borderRadius: "0 8px 8px 0",
      fontSize: 13, lineHeight: 1.6, marginTop: 8,
    }}>
      {children}
    </div>
  );
}

/* ── Pagina principal ── */

export default function CronicoPage() {
  return (
    <div className="max-w-6xl space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="section-title" style={{ fontSize: 22, marginBottom: 2 }}>
          Arbol de decision del paciente cronico
        </h1>
        <p className="text-sm" style={{ color: TXT2 }}>
          Datos feb 2024 - mar 2026 (26 meses) - {fmt(9797)} pacientes - 14 familias cronicas evaluadas
        </p>
      </div>

      {/* CONTEXTO */}
      <div style={{
        background: VERDE_CL, borderLeft: `4px solid ${VERDE}`,
        padding: "16px 20px", borderRadius: "0 8px 8px 0", fontSize: 14, lineHeight: 1.7,
      }}>
        <strong style={{ color: VERDE_OSC }}>Contexto:</strong> Farmacia frente al Centro de Salud
        y al CAE (Centro de Atencion de Especialidades) de Vecindario, referencia del sur de Gran Canaria.
        Pueblo horizontal, todo el mundo en coche, parking en la puerta. 19 farmacias en la zona farmaceutica.
        El paciente sale de consulta, cruza la calle, y lo que pasa despues depende de quien es ese paciente.
      </div>

      {/* ROOT NODE */}
      <NodeBox bg={VERDE_OSC} color="#fff" textCenter maxWidth={520}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Un paciente cronico entra por la puerta</h3>
        <Dato color="#fff">{fmt(9797)} pacientes</Dato>
        <Sub color="rgba(255,255,255,0.8)">
          {fmt(16324)} pares (paciente x familia terapeutica) - 14 familias cronicas evaluadas
        </Sub>
      </NodeBox>

      <SplitLabel>primera pregunta</SplitLabel>
      <Connector />

      {/* PREGUNTA */}
      <NodeBox bg={VERDE_CL} border={VERDE} maxWidth={600}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: VERDE_OSC, marginBottom: 4 }}>
          Tiene historial cronico evaluable en nuestra farmacia?
        </h3>
        <Sub>Evaluable = tiene mas de 1 dispensacion en al menos 1 familia terapeutica, con fecha de proxima dispensacion</Sub>
      </NodeBox>

      {/* TWO BRANCHES */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6" style={{ alignItems: "start" }}>

        {/* LEFT: SIN EVALUAR */}
        <div className="space-y-3">
          <ArrowLabel>NO - 46,9%</ArrowLabel>
          <NodeBox bg="#f1f8e9" border={VERDE_G4} borderStyle="dashed">
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Sin evaluar</h3>
            <Dato>{fmt(4595)} pacientes</Dato>
            <Sub>{fmt(5743)} pares - Solo 1 dispensacion por familia - No hay historial para juzgar fidelidad</Sub>
          </NodeBox>

          <SplitLabel>Vuelve otro dia?</SplitLabel>

          <div className="grid grid-cols-2 gap-3">
            {/* No vuelve */}
            <div className="space-y-2">
              <ArrowLabel>NO - 51,4%</ArrowLabel>
              <NodeBox bg="#c8e6c9" color={VERDE_OSC}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Cruza la calle y desaparece</h3>
                <Dato>{fmt(2361)}</Dato>
                <Sub color={`${VERDE}cc`}>
                  Viene 1 solo dia a la farmacia en 26 meses. Mediana 3 lineas dispensadas ese dia.
                </Sub>
              </NodeBox>

              <div className="grid grid-cols-2 gap-2">
                <NodeBox bg="#c8e6c9" color={VERDE_OSC} style={{ padding: "10px 14px" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Solo la cronica</h3>
                  <Dato size={20}>754 (31,9%)</Dato>
                  <Sub color={`${VERDE}cc`}>Saca 1 receta y se va. Interaccion minima.</Sub>
                </NodeBox>
                <NodeBox bg={`linear-gradient(135deg, ${VERDE_CL}, #f1f8e9)`} border={VERDE} color={VERDE_OSC} style={{ padding: "10px 14px" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Cronica + otras</h3>
                  <Dato size={20}>{fmt(1607)} (68,1%)</Dato>
                  <Sub color={`${VERDE_OSC}cc`}>
                    Saca la cronica + 1,8 lineas mas. <strong>Son los de flor en flor de otra farmacia.</strong>
                  </Sub>
                </NodeBox>
              </div>

              <Insight>
                <strong style={{ color: VERDE_OSC }}>Valor influencer:</strong> ~175 pacientes/mes - ~221 cajas
                cronicas/mes de primera dispensacion. El 68% interactua 3+ minutos en mostrador.
                Primer contacto con el tratamiento. De las 19 farmacias de la zona, esta es la que
                canaliza el flujo de primeras dispensaciones.
              </Insight>
            </div>

            {/* Si vuelve */}
            <div className="space-y-2">
              <ArrowLabel>SI - 48,6%</ArrowLabel>
              <NodeBox bg="#f1f8e9" border={VERDE_G4} borderStyle="dashed">
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Vuelve a la farmacia</h3>
                <Dato>{fmt(2234)}</Dato>
                <Sub>
                  Pacientes propios (2+ visitas) pero aun sin historial de renovacion cronica evaluable.
                  Media 2,6 visitas.
                </Sub>
              </NodeBox>

              <Insight>
                <strong style={{ color: VERDE_OSC }}>Oportunidad:</strong> Estos vuelven a la farmacia
                pero no renuevan la cronica aqui. Captacion en mostrador? Los datos dicen que si en los
                primeros 90 dias viene 8+ veces, hay alta probabilidad de fidelizarse.
              </Insight>
            </div>
          </div>
        </div>

        {/* RIGHT: EVALUABLES */}
        <div className="space-y-3">
          <ArrowLabel>SI - 53,1%</ArrowLabel>
          <NodeBox bg={VERDE_CL} border={VERDE}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: VERDE_OSC, marginBottom: 4 }}>
              Evaluables: como es la relacion?
            </h3>
            <Dato>{fmt(5202)} pacientes</Dato>
            <Sub>{fmt(10581)} pares - Tienen historial de renovacion</Sub>
          </NodeBox>

          <SplitLabel>clasificacion</SplitLabel>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {/* Amigos */}
            <div className="space-y-2">
              <ArrowLabel>9,7%</ArrowLabel>
              <NodeBox bg={VERDE_OSC} color="#fff">
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Amigos</h3>
                <Dato color="#fff">505</Dato>
                <Sub color="rgba(255,255,255,0.73)">
                  Renuevan TODO. 91,6% de tasa. Mediana 52 visitas. 100% propios.
                </Sub>
                <Tag bg="rgba(255,255,255,0.2)" color="#fff">RELACION SOLIDA</Tag>
              </NodeBox>
              <Insight>
                Fueron buenos <strong style={{ color: VERDE_OSC }}>desde el dia 1</strong>.
                Media 11,9 visitas en primeros 90 dias. No se hicieron — vinieron hechos.
              </Insight>
            </div>

            {/* Casi amigos */}
            <div className="space-y-2">
              <ArrowLabel>19,8%</ArrowLabel>
              <NodeBox bg={VERDE} color="#fff">
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Casi amigos</h3>
                <Dato color="#fff">{fmt(1030)}</Dato>
                <Sub color="rgba(255,255,255,0.73)">
                  Renuevan la mayoria. Algun farmaco falla. Mediana 16 visitas.
                </Sub>
                <Tag bg="rgba(255,255,255,0.2)" color="#fff">BUENA, CON ATENCION</Tag>
              </NodeBox>
            </div>

            {/* De flor en flor */}
            <div className="space-y-2">
              <ArrowLabel>47,8%</ArrowLabel>
              <NodeBox bg={VERDE_G4} color={VERDE_OSC}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>De flor en flor</h3>
                <Dato>{fmt(2487)}</Dato>
                <Sub color={`${VERDE_OSC}cc`}>
                  Vienen pero fallan renovaciones. Mediana 8 visitas. Van a varias farmacias.
                </Sub>
                <Tag bg="rgba(27,94,32,0.2)" color={VERDE_OSC}>INESTABLE</Tag>
              </NodeBox>
            </div>

            {/* Perdidos */}
            <div className="space-y-2">
              <ArrowLabel>22,7%</ArrowLabel>
              <NodeBox bg="#dcedc8" color={VERDE_OSC}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No nos quieren ver</h3>
                <Dato>{fmt(1180)}</Dato>
                <Sub color="#33691Ecc">
                  Dejaron de venir. Mediana 3 visitas. Incluye fallecidos y mudanzas.
                </Sub>
                <Tag bg="#81c784" color={VERDE_OSC}>PERDIDOS</Tag>
              </NodeBox>
              <Insight>
                45,9% vino solo 1 vez en sus primeros 90 dias.
                <strong style={{ color: VERDE_OSC }}> Nunca llegaron a conocernos.</strong>
              </Insight>
            </div>
          </div>

          {/* Conclusion evaluables */}
          <NodeBox
            bg={`linear-gradient(135deg, ${VERDE_CL}, #f1f8e9)`}
            border={VERDE}
            style={{ marginTop: 16, textAlign: "center" }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: VERDE_OSC, marginBottom: 4 }}>
              Cuando nos conocen: ganamos en las distancias cortas
            </h3>
            <Sub color={TXT2} style={{ maxWidth: 600, margin: "4px auto 0" }}>
              Amigos + Casi amigos = <strong>{fmt(1535)} pacientes (29,5% de evaluables)</strong> con relacion buena.
              Los amigos mantienen 91% de fidelidad desde la primera visita — no se construye con el tiempo,
              se detecta en el primer trimestre.
            </Sub>
          </NodeBox>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{
        marginTop: 40, textAlign: "center", fontSize: 12, color: TXT2,
        paddingTop: 16, borderTop: "1px solid var(--color-reig-border-light, #ddd)",
      }}>
        <strong>Farmacia Reig</strong> - Analisis interno - Datos feb 2024 - mar 2026 - Generado 2026-04-10 - Confidencial
      </div>
    </div>
  );
}
