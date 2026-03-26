import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestión — Farmacia Reig",
  description: "Panel de gestión interna de Farmacia Reig",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex font-sans bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
