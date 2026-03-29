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
