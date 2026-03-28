# Documentación Técnica — gestion.vidalreig.com

> Plataforma de gestión interna de Farmacia Reig
> Next.js 16 · Turso · Vercel

---

## Documentación de la App

- [[02-stack-tecnologico]] — Next.js 16, Turso, Vercel, Tailwind v4, identidad corporativa
- [[03-autenticacion]] — Login, cookies httpOnly, middleware, variables de entorno
- [[04-base-de-datos]] — Esquema completo (4 tablas Retiradas + 7 tablas RRHH), relaciones, constraints
- [[05-api-endpoints]] — Todas las rutas API con request/response
- [[06-interfaz-usuario]] — Pantallas, flujos, diseño responsive
- [[07-reglas-negocio]] — Bloqueos, destinos, fechas, remesas

## Diagramas

- [[diagramas/arquitectura.drawio]] — Arquitectura general del sistema (abrir con draw.io)

## Documentación de Proyecto

La documentación transversal del proyecto IA Reig vive en su propio repo:

→ **[ovidiovh/reig-docs](https://github.com/ovidiovh/reig-docs)** — Visión general, fichas SEO, datos, automatizaciones, roadmap

---

## Mapa del código

```
src/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx              ← Layout autenticado con Sidebar
│   │   ├── page.tsx                ← Dashboard inicio (tarjetas módulos)
│   │   ├── retiradas/
│   │   │   ├── page.tsx            ← Formulario nueva retirada
│   │   │   └── historial/page.tsx  ← Historial + remesas
│   │   ├── crm/page.tsx            ← CRM (análisis ventas)
│   │   └── rrhh/
│   │       ├── page.tsx            ← Hub RRHH (calendar + guardia + vacaciones)
│   │       ├── types.ts            ← Tipos TS + calcGuardDates() + constantes
│   │       ├── GuardiaPanel.tsx    ← Modal edición de guardia con slots
│   │       ├── VacacionesTab.tsx   ← Gestión vacaciones por empleado
│   │       ├── horarios/page.tsx   ← /rrhh/horarios → re-exporta page.tsx
│   │       └── equipo/page.tsx     ← /rrhh/equipo → directorio del equipo
│   ├── login/page.tsx              ← Pantalla de login
│   └── api/
│       ├── auth/[...nextauth]/route.ts ← NextAuth (Google OAuth)
│       ├── retiradas/route.ts          ← CRUD retiradas (GET/POST/PATCH)
│       ├── remesas/route.ts            ← CRUD remesas (GET/POST/PATCH)
│       ├── migrate/route.ts            ← Migración esquema retiradas
│       └── rrhh/
│           ├── migrate/route.ts        ← Crear tablas RRHH + seed (POST)
│           ├── empleados/route.ts      ← GET empleados activos
│           ├── festivos/route.ts       ← GET festivos por año
│           ├── guardias/
│           │   ├── route.ts            ← GET/POST guardias
│           │   ├── [id]/route.ts       ← GET/PUT guardia con slots
│           │   └── stats/route.ts      ← GET guardias hechas por farmacéutico (descansos comp.)
│           └── vacaciones/
│               ├── route.ts            ← GET/POST vacaciones (campo tipo: vac|comp)
│               └── [id]/route.ts       ← PUT/DELETE vacación
├── components/
│   ├── AppShell.tsx            ← Layout responsive (hamburguesa móvil)
│   └── Sidebar.tsx             ← Navegación lateral (secciones colapsables)
├── lib/
│   ├── db.ts                   ← Conexión Turso (@libsql/client)
│   ├── auth.ts                 ← Configuración NextAuth
│   └── schema.sql              ← Esquema SQL de referencia (retiradas)
└── middleware.ts               ← Protección de rutas auth
```
