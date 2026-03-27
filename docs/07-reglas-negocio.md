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

## Decisiones pendientes

| Tema | Estado | Notas |
|------|--------|-------|
| Botón "A Bea" | Pendiente | Ovidio consultará con Bea si se mantiene, se mueve a menú secundario o se elimina |
| Email Santander | Pendiente | Necesitamos ver formato exacto de los emails (remitente, asunto, importe) |
| DNS gestion.vidalreig.com | Pendiente | Configurar en Enom → Vercel |
