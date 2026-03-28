# API Endpoints

> Volver a [[README]] · Relacionado: [[03-autenticacion]], [[04-base-de-datos]], [[07-reglas-negocio]]

---

Todas las APIs están en `src/app/api/` usando Route Handlers de Next.js (App Router).

---

## Autenticación

### `POST /api/auth` — Login

```
Request:  { email: string, password: string }
Response: { ok: true } + Set-Cookie reig-auth
Error:    { ok: false, error: "Email o contraseña incorrectos" } (401)
```

### `DELETE /api/auth` — Logout

```
Response: { ok: true } + Set-Cookie reig-auth="" (Max-Age=0)
```

---

## Retiradas

### `GET /api/retiradas?desde=YYYY-MM-DD` — Listar sesiones

```
Response: {
  ok: true,
  data: [{
    id, fecha, created_at, usuario, destino,
    total_cajas, total_audit, auditada, num_cajas,
    remesa_id, remesa_estado, remesa_confirmada_at
  }]
}
```

Incluye LEFT JOIN con `retiradas_remesa` para traer estado y fecha de confirmación. Límite 200 registros. Ordenado por fecha DESC.

### `POST /api/retiradas` — Crear sesión

```
Request: {
  fecha: "YYYY-MM-DD",    // DEBE ser hoy
  destino?: string,        // default "caja_fuerte"
  cajas: [{
    num_caja: number,      // 1-10
    b200, b100, b50, b20, b10, b5: number
  }],
  audit?: {                // opcional
    b200, b100, b50, b20, b10, b5: number
  }
}

Response: { ok: true, sesion_id: number, total_cajas: number, auditada: number }
Error:    { ok: false, error: "Solo se pueden crear retiradas con fecha de hoy" } (400)
```

**Validaciones:**
- `fecha` DEBE ser igual a `new Date().toISOString().slice(0, 10)` (hoy)
- `cajas` no puede estar vacío
- Si incluye `audit`, compara billete a billete (no solo totales)

**Lógica de auditoría:**
- `auditada = 1` → cuadra (todos los billetes coinciden)
- `auditada = -1` → descuadre (algún billete no coincide)
- `auditada = 0` → sin auditoría

### `PATCH /api/retiradas` — Cambiar destino

```
Request:  { id: number, destino: "caja_fuerte" | "entrega_bea" | "banco" }
Response: { ok: true, id, destino }
Error:    { ok: false, error: "Sesión bloqueada — destino final: banco" } (403)
```

**Regla de bloqueo:** Si el destino actual es `banco` o `entrega_bea`, la sesión está bloqueada y devuelve 403. Ver [[07-reglas-negocio]].

---

## Remesas

### `GET /api/remesas?estado=pendiente|confirmada` — Listar remesas

```
Response: {
  ok: true,
  data: [{
    id, created_at, total, estado,
    confirmada_at, num_sesiones
  }]
}
```

Filtro `estado` opcional. Límite 100. Ordenado por created_at DESC.

### `POST /api/remesas` — Crear remesa

```
Request:  { sesion_ids: number[] }
Response: { ok: true, remesa_id: number, total: number, sesiones: number }
```

**Validaciones:**
- Todas las sesiones deben existir
- Todas deben tener `destino = "caja_fuerte"`
- Ninguna debe tener `remesa_id` previo

**Efecto:** Cambia destino de todas las sesiones a `"banco"` y les asigna el `remesa_id`.

### `PATCH /api/remesas` — Confirmar remesa

```
Request:  { id: number, email_subject?: string }
Response: { ok: true, id, estado: "confirmada" }
Error:    { ok: false, error: "Remesa ya confirmada" } (400)
```

Marca `estado = "confirmada"`, guarda `confirmada_at` y opcionalmente el asunto del email del Santander.

---

## Migración (Retiradas)

### `POST /api/migrate` — Crear/actualizar esquema retiradas

```
Response: { ok: true, message: "Tablas creadas/actualizadas correctamente" }
```

Idempotente. Crea las 4 tablas con `CREATE TABLE IF NOT EXISTS`. Incluye `ALTER TABLE ADD COLUMN remesa_id` con try/catch para ignorar si ya existe.

---

## RRHH

### `POST /api/rrhh/migrate` — Crear tablas RRHH y seed inicial

```
Response: {
  ok: true,
  message: string,
  tablas: string[],   // 7 tablas creadas
  empleados: 14,
  festivos: 14
}
```

Idempotente. Crea 7 tablas (`CREATE TABLE IF NOT EXISTS`), seed 14 empleados, 14 festivos 2026 y defaults de guardia (todos con `INSERT OR IGNORE`).

---

### `GET /api/rrhh/empleados` — Listar empleados activos

```
Response: { ok: true, empleados: Empleado[] }
```

Devuelve empleados con `activo = 1`, ordenados por `orden ASC`.

---

### `GET /api/rrhh/festivos?year=2026` — Festivos del año

```
Response: { ok: true, festivos: Festivo[] }
```

Filtra por `fecha LIKE '2026%'`.

---

### `GET /api/rrhh/guardias?year=2026` — Guardias del año

```
Response: { ok: true, guardias: Guardia[] }
```

Devuelve guardias creadas en BD (no las calculadas). Filtrado por año.

### `POST /api/rrhh/guardias` — Crear guardia con slots por defecto

```
Request:  { fecha: "YYYY-MM-DD", tipo?: "lab" | "fest" }
Response: { ok: true, guardiaId: number, rowsAffected: number }
Error:    { ok: false, error: "fecha requerida" } (400)
```

Si no se pasa `tipo`, lo infiere del día de la semana (domingo → `fest`, resto → `lab`). Crea los slots desde `rrhh_guardia_defaults` para todos los empleados activos con `hace_guardia = 1`.

### `GET /api/rrhh/guardias/[id]` — Detalle guardia con slots

```
Response: {
  ok: true,
  guardia: Guardia,
  slots: GuardiaSlot[]   // incluye nombre y farmaceutico del empleado
}
```

### `PUT /api/rrhh/guardias/[id]` — Actualizar guardia y slots

```
Request: {
  tipo?: "lab" | "fest",
  publicada?: number,
  notas?: string,
  slots?: [{ empleado_id, hora_inicio, hora_fin }]
}
Response: { ok: true }
```

Actualiza la guardia y reemplaza todos sus slots (DELETE + INSERT).

---

### `GET /api/rrhh/vacaciones?year=2026` — Vacaciones del año

```
Response: {
  ok: true,
  vacaciones: [{
    id, empleado_id, fecha_inicio, fecha_fin, estado, created_at,
    nombre,        // JOIN con empleados
    farmaceutico   // JOIN con empleados
  }]
}
```

### `POST /api/rrhh/vacaciones` — Crear período de vacaciones

```
Request:  { empleado_id, fecha_inicio, fecha_fin, estado?: "pend" | "conf" | "done" }
Response: { ok: true, id: number }
```

### `PUT /api/rrhh/vacaciones/[id]` — Actualizar estado

```
Request:  { estado: "pend" | "conf" | "done" }
Response: { ok: true }
```

### `DELETE /api/rrhh/vacaciones/[id]` — Eliminar período

```
Response: { ok: true }
```
