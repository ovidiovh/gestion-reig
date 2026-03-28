# Reglas de Negocio — Retiradas

> Volver a [[README]] · Relacionado: [[04-base-de-datos]], [[05-api-endpoints]]

---

## Regla 1: Solo fecha de hoy

**No se pueden crear retiradas con fecha pasada.** La fecha es siempre `new Date().toISOString().slice(0, 10)`.

- **Frontend:** No hay selector de fecha. Se muestra la fecha formateada como texto, no editable.
- **Backend:** POST /api/retiradas valida `fecha === hoy`. Si no coincide → 400.

**Contexto:** El historial (fechas pasadas) se importó una vez desde Excel. A partir de ahí, solo se crea hoy.

---

## Regla 2: Destino siempre empieza como `caja_fuerte`

Al crear una retirada, el destino se establece automáticamente como `caja_fuerte`. No hay selector de destino en el formulario de creación.

El destino se cambia después, desde el historial, cuando se decide qué hacer con el efectivo.

---

## Regla 3: Bloqueo de destinos finales

| Destino | ¿Editable? | Significado |
|---------|-----------|-------------|
| `caja_fuerte` | ✅ Sí | Efectivo almacenado temporalmente |
| `entrega_bea` | ❌ Bloqueado | Entregado directamente a Bea |
| `banco` | ❌ Bloqueado | Incluido en una remesa bancaria |

Una vez que una sesión pasa a `banco` o `entrega_bea`, **no se puede cambiar más**. El backend devuelve 403.

**Icono visual:** 🔒 en las sesiones bloqueadas en el historial.

---

## Regla 4: Remesas agrupan sesiones

Una remesa = un grupo de retiradas que van juntas al banco como un único ingreso.

**Requisitos para crear remesa:**
- Todas las sesiones deben tener `destino = "caja_fuerte"`
- Ninguna puede tener ya un `remesa_id`
- Se pueden agrupar sesiones de días diferentes

**Al crear la remesa:**
- Se calcula el total (suma de `total_cajas` de todas las sesiones)
- Se cambia el destino de todas a `"banco"`
- Se asigna el `remesa_id` a todas
- Estado inicial: `"pendiente"`

---

## Regla 5: Confirmación de remesas

Estado `"pendiente"` → `"confirmada"` cuando llega el email de confirmación del Santander.

**Pendiente de implementar:** matching automático con emails desde `ingresos@farmaciareig.net`.

**Flujo previsto:**
1. Se hace el ingreso físico en el banco
2. El Santander envía email de confirmación a ingresos@farmaciareig.net
3. Google Apps Script lee el email y extrae importe + asunto
4. Si importe = total remesa → confirmación automática
5. Si no cuadra → aviso para revisión manual
6. El usuario NO necesita marcar nada manualmente si el importe cuadra

---

## Regla 6: Auditoría billete a billete

La auditoría no solo compara totales — compara cantidad de billetes por denominación:

```
✓ Cuadra:   b200_cajas == b200_audit AND b100_cajas == b100_audit AND ... (todas)
✗ Descuadre: cualquier denominación no coincide
```

Esto detecta errores de conteo incluso si los totales cuadran por casualidad (ej: un billete de 50 cambiado por uno de 20 + uno de 20 + uno de 10).

---

## Decisiones pendientes (Retiradas)

| Tema | Estado | Notas |
|------|--------|-------|
| Botón "A Bea" | Pendiente | Ovidio consultará con Bea si se mantiene, se mueve a menú secundario o se elimina |
| Email Santander | Pendiente | Necesitamos ver formato exacto de los emails (remitente, asunto, importe) |
| DNS gestion.vidalreig.com | Pendiente | Configurar en Enom → Vercel |

---

# Reglas de Negocio — Módulo RRHH

> Relacionado: [[04-base-de-datos]], [[05-api-endpoints]]

## Regla RRHH-1: Ciclo de guardias cada 19 días

Las guardias de la farmacia se producen **cada 19 días**, empezando desde el ancla del **4 de abril de 2026** (sábado).

El cálculo se realiza en cliente (`calcGuardDates()` en `types.ts`) proyectando hacia atrás y hacia adelante cubriendo todo 2026. Las fechas resultantes son un `Set<string>` que se compara contra cada día del calendario.

**Consecuencia:** No hay un ciclo mensual fijo — las guardias pueden caer cualquier día de la semana. El tipo se detecta automáticamente:
- Domingo → `fest` (guardia festiva, tarifa más alta)
- Resto → `lab` (guardia laborable)

## Regla RRHH-2: Creación lazy de guardias en BD

Las fechas de guardia se calculan en el cliente pero **no se crean en base de datos hasta que alguien las abre**. Al hacer clic en un día de guardia:

1. Si no existe en BD → se hace `POST /api/rrhh/guardias` con esa fecha
2. Se crean automáticamente los slots desde `rrhh_guardia_defaults`
3. Se carga el `GuardiaPanel` con esos slots

## Regla RRHH-3: Validación farmacéutico en guardia

Una guardia **no se puede publicar** si ningún farmacéutico tiene slot activo (es decir, no está de vacaciones y su hora_inicio/hora_fin cubre algún tramo).

- `hasFarma = slots.some(s => s.farmaceutico === 1 && !vacIds.has(s.empleado_id))`
- Botón "Publicar" deshabilitado si `!hasFarma`
- Badge rojo: "✗ ¡FALTA FARMACÉUTICO!"

## Regla RRHH-4: Horas >23 = día siguiente

Para guardias nocturnas que cruzan medianoche, `hora_fin` puede ir de 24 a 33:
- `hora_fin = 33` equivale a las **09:00 del día siguiente**
- Display: `fmtHora(33)` → `"09:00+1"`
- La barra visual solo muestra hasta las 23:59 (hora_fin se limita a 24 para el gráfico)

## Regla RRHH-5: Vacaciones — pool de 30 días

Cada empleado tiene un pool de **30 días de vacaciones** por año. El cómputo es:
- `done` = días ya disfrutados
- `conf` = días confirmados pendientes de disfrutar
- `pend` = días pedidos pendientes de confirmación
- `avail = 30 - done - conf - pend`

Los días se calculan como `Math.round((fechaFin - fechaInicio) / 86400000) + 1` (inclusivo en ambos extremos).

## Regla RRHH-6: Empleados Mirelus — servicios externos

Los empleados con `empresa = "mirelus"` son personal de **Mirelus** (empresa de servicios): mantenimiento (Javier M.), limpieza (M. Teresa), otros (Luisa). Se muestran separados en la vista equipo y se marcan con badge `M` en el panel de guardias.

## Decisiones pendientes (RRHH)

| Tema | Estado | Notas |
|------|--------|-------|
| Añadir empleada Jenny | Pendiente | No está en la lista actual — confirmar quién es y sus datos |
| Tabla `rrhh_turnos` | Pendiente | Horario regular (quién trabaja qué días) para mostrar en calendario |
| Ausencias (`rrhh_ausencias`) | Pendiente | Tabla creada, sin UI todavía |
| Jornada exacta por empleado | Pendiente | Actualmente se muestra estimada por categoría (convenio Las Palmas) |
