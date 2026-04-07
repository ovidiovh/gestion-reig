// Constantes visuales para los PDFs de nómina.
//
// Se centralizan aquí para que los dos templates (Reig y Mirelus) compartan
// tipografías y para que el verde corporativo de Reig se pueda ajustar en un
// solo sitio si Ovidio cambia de opinión.
//
// pdfkit acepta colores como strings hex ('#RRGGBB') o como arrays [R,G,B].

// Mismos verdes que ya usa la página /rrhh/nominas (constantes GREEN/GREEN_DARK
// en src/app/(app)/rrhh/nominas/page.tsx). Centralizadas aquí para que el PDF
// y la pantalla compartan paleta.
export const REIG_VERDE = "#1f6b4a";
export const REIG_VERDE_OSCURO = "#164d36";
export const REIG_VERDE_CLARO = "#e7f3ec";
export const GRIS_TABLA = "#666666";
export const GRIS_LINEA = "#CCCCCC";
export const NEGRO = "#000000";
export const BLANCO = "#FFFFFF";

// Tipografías estándar de pdfkit (no requieren cargar TTF externo).
export const FONT_REGULAR = "Helvetica";
export const FONT_BOLD = "Helvetica-Bold";

// Márgenes A4 en puntos (1 pt = 1/72 in). A4 = 595 × 842 pt.
export const MARGEN = 50;
