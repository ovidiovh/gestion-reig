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

<!-- BEGIN:reig-style-guide -->
# Guía de estilo obligatoria — Diseño visual de Gestión Reig

Cada página, módulo o componente nuevo DEBE seguir estas reglas de estilo.
El sistema de diseño está definido en `src/app/globals.css` mediante
custom properties (`--color-reig-*`) y clases compartidas. NO inventar
estilos ad-hoc ni usar inline styles para cosas que ya tienen clase.

## Principio general

El estilo de referencia es la página de **Descuadres de Caja**
(`/descuadres`): cards blancas con borde sutil, tablas con cabecera verde,
KPIs con borde izquierdo de color, tipografía limpia. Todo módulo nuevo
debe parecer "de la misma familia" que esa página.

## Clases CSS obligatorias (definidas en globals.css)

| Elemento          | Clase / patrón                        | Notas                                                  |
|-------------------|---------------------------------------|--------------------------------------------------------|
| Contenedores      | `.card`, `.card-tight`, `.card-flush`  | Fondo blanco, border sutil, border-radius 12px         |
| KPI / métrica     | `.kpi-card` + `.kpi-value` + `.kpi-label` | Borde izquierdo 4px color. Número en JetBrains Mono |
| Tablas de datos   | `.table-reig`                         | Cabecera verde (#2E7D32), filas alternas, hover verde   |
| Botones           | `.btn` + `.btn-primary/secondary/ghost/danger` + `.btn-sm/lg` | Siempre con clase, nunca <button> sin estilo |
| Badges / pills    | `.badge` + `.badge-green/blue/red/yellow/gray/orange` | Para estados, etiquetas, porcentajes          |
| Inputs            | `.input-reig` + `.label-reig`          | Focus con ring verde                                   |
| Títulos sección   | `.section-title`                       | DM Serif Display, con línea inferior verde              |
| Tabs / pestañas   | `.tab-nav` + `.tab-active`             | Indicador verde activo                                  |

## Colores — SOLO usar variables

NUNCA poner colores hex hardcodeados. Usar siempre las variables de `@theme`:

- **Verde farmacia:** `var(--color-reig-green)`, `-dark`, `-mid`, `-light`, `-pale`
- **Azul óptica:** `var(--color-reig-optica)`, `-dark`, `-mid`, `-light`, `-pale`
- **Naranja ortopedia:** `var(--color-reig-orto)`, `-mid`, `-light`
- **Neutros:** `var(--color-reig-bg)`, `-surface`, `-border`, `-border-light`
- **Texto:** `var(--color-reig-text)`, `-secondary`, `-muted`
- **Semánticos:** `var(--color-reig-danger)`, `-warn`, `-success`, `-info` (cada uno con `-light`)

## Tipografía

- **Headings / títulos:** `DM Serif Display` (serif) — clase `.font-display` o directamente h1/h2/h3
- **Body / texto general:** `DM Sans` (sans-serif) — es el font-family base del body
- **Números / datos / moneda:** `JetBrains Mono` (monospace) — clase `.font-mono-metric`

## Layout del Dashboard (Home)

El home (`src/app/(app)/Dashboard.tsx`) tiene esta estructura:

1. **Header** — Saludo + nombre + fecha. Simple, sin fondo especial.
2. **Fila KPIs** — 4 `.kpi-card` en grid de 4 columnas:
   - Ventas (borde verde), Descuadre (verde o amarillo si alerta),
     Tarjetas (borde azul óptica), Guardia (verde o rojo si inminente)
3. **Contenido 2 columnas** (grid 5 cols: 3 izq + 2 der):
   - **Izquierda (3/5):** Ventas por vendedor (`.table-reig`), Descuadres
     por caja (`.table-reig`), Calendario mensual (`.card` con grid 7 cols)
   - **Derecha (2/5):** Equipo hoy (badges de turno coloreados),
     Próximas guardias, Accesos rápidos (grid 2 cols de botones)
4. **Calendario** — Hoy = fondo verde sólido. Guardia = verde claro + "G".
   Festivo = rojo claro. Fin de semana = gris. Turnos como mini-badge.

## Reglas de hover / interacción

- Cards KPI: `hover:shadow-md transition-shadow`
- Botones: ya tienen hover en `.btn` (opacity 0.9, scale 0.99)
- Links de sección ("Ver CRM", "Ver todo"): usar `.btn .btn-secondary .btn-sm`
- Filas de tabla: hover verde pálido (ya definido en `.table-reig`)

## Lo que NO hacer

- ❌ Inventar bordes, sombras o border-radius distintos a los de `.card`
- ❌ Usar colores hex directos en lugar de variables CSS
- ❌ Crear estilos inline complejos cuando existe una clase en globals.css
- ❌ Usar fuentes distintas a DM Serif Display, DM Sans o JetBrains Mono
- ❌ Poner iconos decorativos en cuadraditos de color pastel (estilo "Claude")
- ❌ Gradientes en fondos de cards (mantener blanco plano + borde)
- ❌ Layouts perfectamente simétricos sin jerarquía visual
<!-- END:reig-style-guide -->
