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

| Sección | Módulo | Ruta | Estado |
|---------|--------|------|--------|
| GENERAL | Inicio | `/` | Activo |
| GENERAL | Horarios / Guardias | `/rrhh/horarios` | Activo |
| FINANCIERO | Nueva retirada | `/retiradas` | Activo |
| FINANCIERO | Historial | `/retiradas/historial` | Activo |
| FINANCIERO | Ventas | `/ventas` | Próximamente |
| MARKETING | CRM | `/crm` | Activo |
| MARKETING | Fichas producto | `/fichas` | Próximamente |
| RRHH | Guardias y Vacaciones | `/rrhh` | Activo |
| RRHH | Equipo | `/rrhh/equipo` | Activo |
| ADMINISTRACIÓN | Usuarios | `/admin/usuarios` | Próximamente (solo admin) |

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

---

## Módulo RRHH (`/rrhh`, `/rrhh/horarios`, `/rrhh/equipo`)

### `/rrhh` y `/rrhh/horarios` — Calendario, guardias y vacaciones

Página con 3 pestañas (tabs) en barra verde oscuro:

**Pestaña Calendario (📅)**
- Navegación mes a mes (◀ / ▶), año fijo 2026
- Grid 7 columnas (L-D), una celda por día
- Colores por tipo de día:
  - Guardia publicada: fondo `#e8f5ec`, borde verde sólido, badge `GUARDIA ✓` verde
  - Guardia pendiente: mismo fondo, badge `GUARDIA` verde claro
  - Festivo: fondo `#fff0f0`, número en rojo, nombre del festivo (2 palabras)
  - Fin de semana: fondo `#f8f8f8`
  - Hoy: borde azul `#3b82f6`
- Vacaciones del día: chips por empleado (rojo = farmacéutico, azul = auxiliar)
- Clic en día de guardia → abre `GuardiaPanel`
- Leyenda de colores al pie

**Pestaña Guardia (🏥)**
- Sin guardia seleccionada: lista de próximas 6 guardias con estado (publicada / borrador / sin crear)
- Con guardia seleccionada: `GuardiaPanel` (ver más abajo)

**Pestaña Vacaciones (🌴)** — `VacacionesTab`
- Vista general: tarjetas por empleado con contadores (disfrutados/confirmados/pendientes/disponibles de 30)
- Vista detalle por empleado:
  - Contador 5 KPIs + barra de progreso coloreada
  - Lista de períodos con estado, duración y botones confirmar/borrar
  - Formulario añadir: fecha inicio + fecha fin + estado

### GuardiaPanel (modal overlay)

Abre sobre la página principal al clic en guardia.

- Cabecera: fecha formateada + toggle LABORABLE/FESTIVO
- Tabla de slots: una fila por empleado con guardia
  - Nombre (negrita si farmacéutico, tachado si vacaciones ese día)
  - Badge `M` (Mirelus), `VAC` si de vacaciones
  - Selectores hora inicio (0-23) y hora fin (8-33, donde >23 = hora del día siguiente)
  - Barra visual de cobertura por hora (8-23)
  - Total de horas
- Validación: badge verde ✓ / rojo ✗ según haya farmacéutico disponible
- Gráfico barras de cobertura por hora (rojo <2 personas, ámbar 2, verde ≥3, verde oscuro ≥22h)
- Botones: "Guardar cambios" + "Publicar" (deshabilitado sin farmacéutico) + "Cerrar"

### `/rrhh/equipo` — Directorio del equipo

- Header: "Equipo — Farmacia Reig"
- KPIs: 4 tarjetas (Total personal, Farmacéuticos, Auxiliares, Hacen guardia)
- Dos secciones separadas: Farmacia Reig y Mirelus
- Tabla por sección con cabecera verde:
  - Nombre (avatar inicial + badge Farm.), Categoría, Jornada (según convenio), Guardia, Complemento €, h/Guardia
  - Filas alternas blanco/#f9fafb
- Leyenda al pie explicando Compl.€ y h/Guardia

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
