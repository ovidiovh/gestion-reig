<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:reig-navigation-rule -->
# Regla obligatoria — TRES puntos de entrada por cada módulo

Cuando se añade una pestaña/módulo nuevo bajo Financiero, Marketing, RRHH o
Administración, hay que registrarlo SIEMPRE en los **tres** sitios siguientes.
Si solo se hace en uno o dos, el usuario verá agujeros raros (item en sidebar
sin card en home, o card en home que el menú lateral no enseña).

1. **Sidebar** — `src/components/Sidebar.tsx`
   Añadir el `NavItem` en la sección que corresponda.
   Si el acceso está restringido, usar `visibleSi: ({ email }) => ...`.

2. **Home / Panel de gestión** — `src/app/(app)/page.tsx`
   Añadir un `ModuleCard` en la `DashboardSection` correspondiente, espejo
   exacto del Sidebar (misma sección, mismo título, mismo `href`).
   Si el módulo está restringido, usar el mismo predicado `visibleSi` que en
   el Sidebar (importarlo de `@/lib/marketing/permisos` o equivalente).
   Si el módulo aún no existe, marcar `activo: false` para que salga como
   "Próximamente" en lugar de no aparecer.

3. **Middleware** — `src/middleware.ts`
   Si el módulo tiene whitelist, añadir el bloque de protección por ruta.
   Además, el `layout.tsx` del segmento debe re-chequear con `requireUser()`
   como segunda línea de defensa (defensa en profundidad).

Resumen mental: **Sidebar + Home + Middleware/Layout**. Las tres, siempre.
Esta regla aplica a CUALQUIER módulo nuevo, no solo a los restringidos.
<!-- END:reig-navigation-rule -->
