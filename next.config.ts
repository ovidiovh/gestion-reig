import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js necesita 'unsafe-inline' para estilos en desarrollo; en prod se puede
      // restringir más, pero mantener 'unsafe-inline' evita romper Tailwind JIT
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Scripts: solo mismo origen + nonce/hash gestionados por Next.js
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      // Imágenes: mismo origen + data URIs
      "img-src 'self' data: blob:",
      // Conexiones: mismo origen + Turso (libsql over HTTPS)
      "connect-src 'self' https://*.turso.io https://litestream.io",
      // Frames: ninguno
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // pdfkit es CommonJS y lee sus .afm en runtime desde node_modules/pdfkit/js/data/
  // usando __dirname interno. Si Next lo bundlea, __dirname cambia y los .afm
  // no se encuentran (ENOENT '/ROOT/node_modules/pdfkit/js/data/Helvetica.afm').
  // Solución: marcar pdfkit como external para que se cargue como require() en
  // runtime desde node_modules y la traza de Vercel incluya su carpeta entera.
  //
  // googleapis (sesión 9, Paso 2.1): librería oficial de Google con módulos
  // dinámicos pesados. Marcarla external evita que Next la bundlee y deja que
  // Vercel la cargue por require() desde node_modules. Lo usa el storage adapter
  // de Drive para subir los PDFs históricos de nóminas.
  serverExternalPackages: ["pdfkit", "googleapis"],
  // Cinturón y tirantes: además forzamos los .afm en la traza del endpoint
  // de PDFs por si Vercel no detecta el require dinámico de los datos.
  outputFileTracingIncludes: {
    "/api/rrhh/nominas/pdf": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/rrhh/nominas/cerrar-mes": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/rrhh/nominas/historial/**/verificar": [
      "./node_modules/pdfkit/js/data/**/*",
    ],
  },
  async headers() {
    return [
      {
        // Aplica a todas las rutas
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
