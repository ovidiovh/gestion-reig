# Interfaz de Usuario

> Volver a [[README]] · Relacionado: [[05-api-endpoints]], [[07-reglas-negocio]]

---

## Layout General (`AppShell.tsx` + `Sidebar.tsx`)

### Desktop (≥768px / md)
- Sidebar fija a la izquierda (w-64, fondo `reig-green`)
- Contenido principal a la derecha con padding `p-8`

### Móvil (<768px)
- Header sticky con botón hamburguesa (☰) y título "Farmacia Reig"
- Sidebar oculta por defecto, se abre como overlay con animación slide-in
- Overlay oscuro (bg-black/40) para cerrar al tocar fuera
- Botón ✕ para cerrar el sidebar
- Todos los links del sidebar cierran el menú al navegar

### Sidebar — Módulos por departamento

| Departamento | Módulo | Ruta | Estado |
|-------------|--------|------|--------|
| **GENERAL** | Inicio | `/` | Activo |
| | Horarios / Guardias | `/horarios` | Próximamente |
| **FINANCIERO** | Nueva retirada | `/retiradas` | Activo |
| | Historial | `/retiradas/historial` | Activo |
| | Ingresos banco | `/ingresos` | Activo |
| | Ventas | `/ventas` | Próximamente |
| **MARKETING** | CRM | `/crm` | Activo |
| | Fichas producto | `/fichas` | Próximamente |
| **RRHH** | Horarios | — | Próximamente |
| | Equipo | — | Próximamente |
| **ADMINISTRACIÓN** | Usuarios | — | Próximamente |

Secciones con chevron (▶) desplegable. Títulos: `text-sm font-bold tracking-wide` con `pt-3`.
Los módulos no activos muestran badge "próx." y cursor `not-allowed`.

### Tema por zona

| Zona | Color principal | Uso |
|------|----------------|-----|
| Farmacia | `#0C6D32` (verde) | Sidebar, botones, acentos, barra resumen |
| Óptica | `#0C4D6D` (azul) | Sidebar, botones, acentos, barra resumen |

El color se aplica dinámicamente con `useZona()` → `const color = zona === "optica" ? "#0C4D6D" : "#0C6D32"`.

Pie del sidebar: dirección y teléfono de la farmacia.

---

## Login (`/login`)

Formulario centrado en pantalla con:
- Input email + password
- Botón "Entrar" (verde corporativo)
- Mensaje de error inline si falla
- Referencia "gestion.vidalreig.com" debajo
- No muestra sidebar ni header

---

## Dashboard (`/`)

Organizado en 4 secciones departamentales que reflejan la estructura del sidebar:

- **Financiero:** Nueva retirada, Historial, Ventas
- **Marketing:** CRM, Fichas producto
- **RRHH:** Horarios, Equipo
- **Administración:** Usuarios

Los módulos activos son enlaces clicables (Link). Los inactivos muestran badge "Próximamente" con `opacity-60`.

---

## CRM (`/crm`)

Server component con `export const dynamic = "force-dynamic"` (evita conexión Turso en build).

Muestra datos en vivo de Turso: banner conexión BD, KPIs principales, desglose crédito/contado, top vendedores, ventas por día/hora, top productos, últimas ventas, y explorador de tablas.

---

## Nueva Retirada (`/retiradas`)

### Zona-aware (layout.tsx)

El layout exporta `useZona()` hook via ZonaContext. Selector de pestaña FARMACIA / ÓPTICA en la parte superior.

| Zona | Cajas disponibles | Color UI |
|------|------------------|----------|
| Farmacia | 1–10 | Verde `#0C6D32` |
| Óptica | Solo 11 | Azul `#0C4D6D` |

`CAJAS_DISPONIBLES` es dinámico: `zona === "optica" ? [11] : [1,2,...,10]`.

### Flujo en 3 pasos

**Paso 1 — Selecciona cajas y cuenta billetes:**
- Grid de botones con las cajas de la zona activa
- Al seleccionar caja: fondo con color de zona + formulario de billetes (200€, 100€, 50€, 20€, 10€, 5€)
- Total por caja en tiempo real
- Barra resumen inferior: "N cajas seleccionadas / Total €"
- Botón "Finalizar" (habilitado cuando hay al menos 1 caja con importe)

**Paso 2 — Conteo total (verificación):**
- Formulario de conteo global de billetes (incluye 500€)
- Validación cruzada: conteo total vs suma de cajas individuales
- Si descuadra: modal de ajuste (sacar más / ingresar)
- Botón "Confirmar y guardar"

**Paso 3 — Guardado:**
- Pantalla de éxito con total
- Botones: "Nueva retirada" y "Ver historial"
- Datos guardados en Turso con audit trail completo

---

## Historial (`/retiradas/historial`)

También zona-aware: importa `useZona` de `../layout`. Muestra título dinámico ("Historial — Farmacia" o "Historial — Óptica") y filtra sesiones por zona.

### Dos pestañas

**Pestaña "Retiradas":**
- Filtros: Hoy / Semana / Mes / Todo (botón activo con color de zona)
- Total del periodo en tarjeta
- Dashboard caja fuerte con umbral configurable
- Barra de selección múltiple (solo sesiones en `caja_fuerte` sin remesa)
  - "Seleccionar / Deseleccionar" + "N sel. · XXX€" + botón "Crear remesa"
- Lista de sesiones con accordion de detalle por caja
- Botón "A Bea" (solo desktop, oculto en móvil) para entrega directa

**Pestaña "Remesas banco":**
- Badge con contador de pendientes en la pestaña
- Sección "Pendientes de confirmación" (fondo ámbar)
- Sección "Confirmadas" (fondo verde/azul según zona)

---

## Ingresos Banco (`/ingresos`)

Módulo unificado para visualizar y registrar ingresos bancarios. Recibe datos de dos fuentes: emails automáticos del Santander (vía Apps Script + webhook) y fotos de resguardos subidas manualmente (OCR).

### Dashboard superior

4 tarjetas con estadísticas del mes en curso: total mes (€), farmacia (€), óptica (€) y número de ingresos. Se cargan desde `GET /api/ingresos?stats=1`.

### Listado con filtros

Pestañas de filtro: Hoy / Semana / Mes / Todo. Tabla con columnas: Fecha, Concepto, Importe, Nº Operación, Origen.

Badges de concepto con color: verde (FARMACIA), azul (OPTICA), amarillo (REMESA/pendiente). Badges de origen: `email` / `foto` / `manual`.

### Subida de foto (OCR)

Flujo en pasos:

1. **Subir foto:** Botón con `capture="environment"` (abre cámara en móvil). Acepta imagen JPEG/PNG.
2. **OCR:** Tesseract.js cargado desde CDN (`tesseract.min.js@5`). Extrae automáticamente fecha, hora, importe y nº operación del resguardo.
3. **Formulario editable:** Campos pre-rellenados con datos OCR. El usuario puede corregir cualquier campo. Selector de concepto con 4 botones: FARMACIA, OPTICA, REMESA FARMACIA, REMESA OPTICA.
4. **Guardar:** `POST /api/ingresos` con `origen=foto` + imagen comprimida en base64 (max 1200px ancho, JPEG quality 0.7).

Opción "Registrar sin foto" para entrada manual sin imagen.

---

## Responsive — Detalles técnicos

| Elemento | Móvil | Desktop |
|----------|-------|---------|
| Sidebar | Overlay slide-in | Fija estática |
| Header | Sticky con hamburguesa | No se muestra |
| Main padding | `p-4` | `p-8` |
| Conteo billetes gap | `gap-2` | `gap-4` |
| Denominación width | `w-12` | `w-16` |
| Input width | `w-16` | `w-20` |
| Font sizes | `text-base` / `text-sm` | `text-lg` / `text-base` |
| Hint "cajas:" en audit | `hidden` | `sm:inline` |
| Botón "A Bea" | `hidden` | `sm:inline-block` |
| Viewport | `maximum-scale=1` | — |
