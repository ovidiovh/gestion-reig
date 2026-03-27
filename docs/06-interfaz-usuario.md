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

### Sidebar — Módulos

| Módulo | Ruta | Estado |
|--------|------|--------|
| Inicio | `/` | Activo |
| Nueva retirada | `/retiradas` | Activo |
| Historial | `/retiradas/historial` | Activo |
| Ventas | `/ventas` | Próximamente |
| CRM | `/crm` | Próximamente |

Los módulos no activos muestran badge "próx." y cursor `not-allowed`.

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

Grid de tarjetas (1 col móvil, 2 col tablet, 3 col desktop) con los módulos disponibles. Cada tarjeta muestra icono, nombre y descripción. Los módulos en desarrollo tienen `opacity-60` y badge "En desarrollo".

---

## Nueva Retirada (`/retiradas`)

Flujo en 5 pasos:

### Paso 1: Selección de cajas
- Grid 5×2 con botones del 1 al 10
- Al seleccionar: fondo verde + sombra
- Fecha: siempre hoy, no editable (se muestra formateada: "jueves, 27 de marzo")
- Botón "Empezar conteo (N cajas)"

### Paso 2: Conteo por caja
- Encabezado: "Caja X (2/5)" con total en tiempo real
- 6 filas de denominaciones: 200€, 100€, 50€, 20€, 10€, 5€
- Cada fila: denominación × input numérico = subtotal
- Input con `inputMode="numeric"` para teclado numérico en móvil
- Botón: "Siguiente caja" o "Finalizar conteo"
- Responsive: gaps y tamaños reducidos en móvil

### Paso 3: Resumen
- Lista de cajas con total individual
- Total general en tarjeta verde claro
- Botones: "Verificar (auditoría)" o "Repetir"

### Paso 4: Auditoría
- Misma estructura de 6 denominaciones
- El usuario cuenta TODOS los billetes juntos y pone el total por tipo
- En desktop: muestra hint "cajas: N" al lado de cada denominación
- Botón "Comprobar"

### Paso 5: Resultado
- Tarjeta grande: ✓ CUADRA (verde) o ✗ DESCUADRE (rojo)
- Detalle por denominación: cajas vs conteo, con indicador ✓/✗
- Si descuadra: muestra diferencia por denominación
- Botones: "Guardar retirada" + "Nueva"

---

## Historial (`/retiradas/historial`)

### Dos pestañas

**Pestaña "Retiradas":**
- Filtros: Hoy / Semana / Mes / Todo
- Total del periodo en tarjeta verde
- Barra de selección múltiple (solo sesiones en `caja_fuerte` sin remesa)
  - "Seleccionar / Deseleccionar" + "N sel. · XXX€" + botón "Crear remesa"
- Lista de sesiones, cada una muestra:
  - Checkbox (si editable) / 🔒 (si bloqueada) / ⏳ (remesa pendiente) / ✓ (remesa confirmada)
  - Fecha formateada + Ncj (número de cajas)
  - Badge destino con color: ámbar (caja_fuerte), púrpura (entrega_bea), azul (banco)
  - Total en monospace negrita
  - Indicador auditoría: ✓ (cuadra) / ✗ (descuadre) / — (sin auditar)
- Botón "A Bea" (solo desktop, oculto en móvil) para entrega directa

**Pestaña "Remesas banco":**
- Badge con contador de pendientes en la pestaña
- Sección "Pendientes de confirmación" (fondo ámbar)
  - Remesa #N, fecha, N retiradas, total, icono ⏳
  - Mensaje: "Esperando email de confirmación del Santander"
- Sección "Confirmadas" (fondo verde)
  - Remesa #N, N retiradas, fecha confirmación, total, icono ✓

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
