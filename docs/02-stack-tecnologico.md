# Stack Tecnológico

> Volver a [[README]]

---

## Componentes

| Componente | Tecnología | Versión |
|------------|-----------|---------|
| Framework | Next.js (App Router, TypeScript) | 16.2.1 |
| UI | React | 19.2.4 |
| Estilos | Tailwind CSS | v4 |
| Base de datos | Turso (libSQL cloud) | AWS EU West 1 |
| DB Client | @libsql/client | 0.17.2 |
| Hosting | Vercel | Auto-deploy desde GitHub |
| Repositorio | github.com/ovidiovh/gestion-reig | Privado |
| Dominio | gestion.vidalreig.com | Enom / Google Workspace |

## Por qué Vercel y no Cloudflare

Cloudflare descartado: bloqueos en España por piratería fútbol/Liga afectan servicios detrás de Cloudflare. Vercel tiene conexión nativa con Turso (ambos usan libSQL) y es gratuito para el uso previsto.

## Identidad Corporativa

| Elemento | Valor | Uso |
|----------|-------|-----|
| Verde principal | `#1A8C3A` | Botones, sidebar, acentos |
| Verde oscuro | `#14702E` | Hover states |
| Verde claro | `#E8F5EC` | Fondos, highlights, tarjetas KPI |
| Fondo | `#FFFFFF` | — |
| Texto | `#2A2E2B` | — |
| Fuente títulos | DM Serif Display | Headings, branding |
| Fuente cuerpo | DM Sans | Texto general |
| Fuente métricas | JetBrains Mono | Números, código, importes |

Las fuentes se cargan desde Google Fonts en `layout.tsx`.

## CSS Global (`globals.css`)

```css
@import "tailwindcss";

:root {
  --reig-green: #1a8c3a;
  --reig-green-dark: #146b2d;
  --reig-green-light: #e8f5ec;
}

@theme inline {
  --color-reig-green: var(--reig-green);
  --color-reig-green-dark: var(--reig-green-dark);
  --color-reig-green-light: var(--reig-green-light);
  --font-sans: "DM Sans", system-ui, sans-serif;
  --font-serif: "DM Serif Display", serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

Esto permite usar `bg-reig-green`, `text-reig-green-dark`, `font-serif`, etc. directamente en las clases de Tailwind.

## Dependencias (`package.json`)

```json
{
  "dependencies": {
    "@libsql/client": "^0.17.2",
    "next": "16.2.1",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

Cero dependencias innecesarias. Solo lo esencial.
