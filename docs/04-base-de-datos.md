# Base de Datos — Esquema

> Volver a [[README]] · Relacionado: [[05-api-endpoints]], [[07-reglas-negocio]]

---

## Motor

**Turso** (libSQL cloud) en `libsql://reigbi-ovidiov.aws-eu-west-1.turso.io`

Cliente: `@libsql/client` → archivo `src/lib/db.ts`:

```typescript
import { createClient } from "@libsql/client";

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
```

## Diagrama de relaciones

```
retiradas_sesion ─────┬──── retiradas_caja (1:N)
       │              └──── retiradas_audit (1:1)
       │
       └── remesa_id FK ──── retiradas_remesa (N:1)
```

---

## Tabla: `retiradas_sesion`

Una sesión = una operación de retirada de efectivo en un día.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | INTEGER PK | AUTOINCREMENT | — |
| `fecha` | TEXT NOT NULL | — | YYYY-MM-DD (siempre fecha de hoy) |
| `created_at` | TEXT NOT NULL | `datetime('now')` | Timestamp creación |
| `usuario` | TEXT NOT NULL | `'ovidio'` | Quién registra |
| `total_cajas` | REAL NOT NULL | `0` | Suma automática de todas las cajas |
| `total_audit` | REAL | NULL | Suma del conteo de auditoría |
| `destino` | TEXT NOT NULL | `'caja_fuerte'` | `caja_fuerte` \| `entrega_bea` \| `banco` |
| `remesa_id` | INTEGER | NULL | FK → `retiradas_remesa.id` |
| `auditada` | INTEGER NOT NULL | `0` | 0=pendiente, 1=cuadra, -1=descuadre |
| `notas` | TEXT | NULL | Notas opcionales |

---

## Tabla: `retiradas_caja`

Detalle de billetes por caja física dentro de una sesión.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK | AUTOINCREMENT |
| `sesion_id` | INTEGER NOT NULL FK | → `retiradas_sesion.id` |
| `num_caja` | INTEGER NOT NULL | 1-11 (1-10 farmacia, 11 óptica) |
| `b200` | INTEGER NOT NULL | Cantidad billetes de 200€ |
| `b100` | INTEGER NOT NULL | Cantidad billetes de 100€ |
| `b50` | INTEGER NOT NULL | Cantidad billetes de 50€ |
| `b20` | INTEGER NOT NULL | Cantidad billetes de 20€ |
| `b10` | INTEGER NOT NULL | Cantidad billetes de 10€ |
| `b5` | INTEGER NOT NULL | Cantidad billetes de 5€ |
| `total` | REAL NOT NULL | Calculado: `200*b200 + 100*b100 + ...` |
| `created_at` | TEXT NOT NULL | `datetime('now')` |

**Constraint:** `UNIQUE(sesion_id, num_caja)` — una caja por sesión.

---

## Tabla: `retiradas_remesa`

Agrupación de sesiones para un único ingreso bancario.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | INTEGER PK | AUTOINCREMENT | — |
| `created_at` | TEXT NOT NULL | `datetime('now')` | — |
| `total` | REAL NOT NULL | `0` | Suma de las sesiones agrupadas |
| `estado` | TEXT NOT NULL | `'pendiente'` | `pendiente` \| `confirmada` |
| `confirmada_at` | TEXT | NULL | Fecha confirmación por email banco |
| `email_subject` | TEXT | NULL | Asunto del email del Santander |
| `notas` | TEXT | NULL | — |

---

## Tabla: `retiradas_audit`

Conteo global de billetes para verificación cruzada con las cajas.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK | AUTOINCREMENT |
| `sesion_id` | INTEGER NOT NULL FK | UNIQUE → una auditoría por sesión |
| `b200..b5` | INTEGER NOT NULL | Billetes contados en auditoría |
| `total` | REAL NOT NULL | Total calculado |
| `cuadra` | INTEGER NOT NULL | 1=sí (billete a billete), 0=no |
| `created_at` | TEXT NOT NULL | `datetime('now')` |

---

## Migración

Endpoint `POST /api/migrate` crea las 4 tablas con `CREATE TABLE IF NOT EXISTS` (idempotente). Incluye migración incremental:

```sql
ALTER TABLE retiradas_sesion ADD COLUMN remesa_id INTEGER;
-- Si ya existe, el try/catch ignora el error
```

La migración ya se ejecutó en producción.

---

## Tabla 5: `ingresos_banco`

Registro unificado de todos los ingresos bancarios: tanto los detectados automáticamente por email del Santander (vía Apps Script + webhook) como los subidos manualmente con foto del resguardo (OCR).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK | AUTOINCREMENT |
| `fecha` | TEXT NOT NULL | Fecha del ingreso (YYYY-MM-DD) |
| `hora` | TEXT | Hora del ingreso (HH:MM) |
| `concepto` | TEXT NOT NULL | FARMACIA / OPTICA / REMESA FARMACIA / REMESA OPTICA |
| `importe` | REAL NOT NULL | Importe en EUR |
| `num_operacion` | TEXT | Nº operación del banco |
| `origen` | TEXT NOT NULL | `email` (automático) / `foto` (OCR) / `manual` |
| `foto_base64` | TEXT | Imagen del resguardo comprimida (solo origen=foto) |
| `email_id` | TEXT | ID del mensaje Gmail (solo origen=email, UNIQUE) |
| `usuario_email` | TEXT | Email del usuario que registró |
| `usuario_nombre` | TEXT | Nombre del usuario |
| `notas` | TEXT | Notas opcionales |
| `created_at` | TEXT NOT NULL | `datetime('now')` |

**Índices:**

| Índice | Columnas | Notas |
|--------|----------|-------|
| `idx_ingresos_fecha` | `fecha` | Filtros por periodo |
| `idx_ingresos_concepto` | `concepto` | Filtros por tipo |
| `idx_ingresos_email_id` | `email_id` (UNIQUE) | WHERE email_id IS NOT NULL — evita duplicados de webhook |

**Módulo:** `src/lib/ingresos.ts` — funciones `initIngresos()`, `guardarIngreso()`, `listarIngresos()`, `existeEmailId()`, `estadisticasMes()`.
