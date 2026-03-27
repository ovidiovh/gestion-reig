# Documentación Técnica — gestion.vidalreig.com

> Plataforma de gestión interna de Farmacia Reig
> Next.js 16 · Turso · Vercel

---

## Documentación de la App

- [[02-stack-tecnologico]] — Next.js 16, Turso, Vercel, Tailwind v4, identidad corporativa
- [[03-autenticacion]] — Login, cookies httpOnly, middleware, variables de entorno
- [[04-base-de-datos]] — Esquema completo (4 tablas), relaciones, constraints
- [[05-api-endpoints]] — Todas las rutas API con request/response
- [[06-interfaz-usuario]] — Pantallas, flujos, diseño responsive
- [[07-reglas-negocio]] — Bloqueos, destinos, fechas, remesas

## Diagramas

- [[diagramas/arquitectura.drawio]] — Arquitectura general del sistema (abrir con draw.io)

## Documentación de Proyecto (fuera del repo)

La documentación transversal del proyecto IA Reig (visión general, fichas SEO, infraestructura de datos, automatizaciones, roadmap) vive en la carpeta de proyecto compartida, no en este repositorio, porque abarca más que la app web.

---

## Mapa del código

```
src/
├── app/
│   ├── layout.tsx              ← Root layout (fuentes, AppShell)
│   ├── globals.css             ← Tailwind v4 + variables CSS corporativas
│   ├── page.tsx                ← Dashboard inicio (módulos)
│   ├── login/page.tsx          ← Pantalla de login
│   ├── retiradas/
│   │   ├── page.tsx            ← Formulario nueva retirada
│   │   └── historial/page.tsx  ← Historial + remesas
│   └── api/
│       ├── auth/route.ts       ← Login/logout (POST/DELETE)
│       ├── retiradas/route.ts  ← CRUD retiradas (GET/POST/PATCH)
│       ├── remesas/route.ts    ← CRUD remesas (GET/POST/PATCH)
│       └── migrate/route.ts    ← Migración de esquema
├── components/
│   ├── AppShell.tsx            ← Layout responsive (hamburguesa móvil)
│   └── Sidebar.tsx             ← Navegación lateral
├── lib/
│   ├── db.ts                   ← Conexión Turso (@libsql/client)
│   └── schema.sql              ← Esquema SQL de referencia
└── middleware.ts               ← Protección de rutas (cookie auth)
```
