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
| `num_caja` | INTEGER NOT NULL | 1-10, CHECK constraint |
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

## Migración (Retiradas)

Endpoint `POST /api/migrate` crea las 4 tablas con `CREATE TABLE IF NOT EXISTS` (idempotente). Incluye migración incremental:

```sql
ALTER TABLE retiradas_sesion ADD COLUMN remesa_id INTEGER;
-- Si ya existe, el try/catch ignora el error
```

La migración ya se ejecutó en producción.

---

## Módulo RRHH — 7 tablas

Creadas/seeded mediante `POST /api/rrhh/migrate` (idempotente, usa `INSERT OR IGNORE`).

### Diagrama de relaciones RRHH

```
rrhh_empleados ──┬──── rrhh_guardia_slots  (1:N via guardia_id)
                 ├──── rrhh_guardia_defaults (1:1)
                 ├──── rrhh_vacaciones      (1:N)
                 └──── rrhh_ausencias       (1:N)

rrhh_guardias ───┬──── rrhh_guardia_slots  (1:N)
                 └── (fecha calculada cada 19 días desde 04-abr-2026)
```

### Tabla: `rrhh_empleados`

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | TEXT PK | — | Clave legible (ej: `"ovidio"`, `"bea"`) |
| `nombre` | TEXT NOT NULL | — | Nombre visible |
| `categoria` | TEXT NOT NULL | `'auxiliar'` | `farmaceutico` \| `auxiliar` \| `mantenimiento` \| `limpieza` \| `otro` |
| `empresa` | TEXT NOT NULL | `'reig'` | `reig` \| `mirelus` |
| `farmaceutico` | INTEGER NOT NULL | `0` | 1 = farmacéutico titulado |
| `hace_guardia` | INTEGER NOT NULL | `0` | 1 = participa en guardias |
| `complemento_eur` | INTEGER NOT NULL | `0` | Euros extra por guardia |
| `h_lab_complemento` | INTEGER NOT NULL | `0` | Horas extra en guardia laborable |
| `activo` | INTEGER NOT NULL | `1` | 1 = activo |
| `orden` | INTEGER NOT NULL | `99` | Orden de presentación |

**Seed (14 empleados):**

| id | nombre | categoria | empresa | farm. | guardia | compl.€ | h/lab |
|----|--------|-----------|---------|-------|---------|---------|-------|
| ovidio | Ovidio | farmaceutico | reig | 1 | 1 | 0 | 0 |
| bea | Bea | farmaceutico | reig | 1 | 0 | 0 | 0 |
| maria | María N. | farmaceutico | reig | 1 | 1 | 180 | 0 |
| julio | Julio | farmaceutico | reig | 1 | 1 | 280 | 19 |
| celia | Celia | farmaceutico | reig | 1 | 1 | 280 | 19 |
| ani | Ani | auxiliar | reig | 0 | 1 | 30 | 9 |
| noelia | Noelia | auxiliar | reig | 0 | 1 | 30 | 9 |
| dulce | Dulce | auxiliar | reig | 0 | 1 | 30 | 9 |
| leti | Leti | auxiliar | reig | 0 | 1 | 30 | 9 |
| yoli | Yoli | auxiliar | reig | 0 | 0 | 0 | 0 |
| zuleica | Zuleica | auxiliar | reig | 0 | 0 | 0 | 0 |
| javier | Javier M. | mantenimiento | mirelus | 0 | 1 | 60 | 9 |
| teresa | M. Teresa | limpieza | mirelus | 0 | 0 | 0 | 0 |
| luisa | Luisa | otro | mirelus | 0 | 0 | 0 | 0 |

### Tabla: `rrhh_festivos`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK AUTOINCREMENT | — |
| `fecha` | TEXT NOT NULL UNIQUE | YYYY-MM-DD |
| `nombre` | TEXT NOT NULL | Nombre del festivo |
| `tipo` | TEXT NOT NULL | `nacional` \| `autonomico` \| `local` \| `insular` |
| `override` | INTEGER NOT NULL DEFAULT 0 | 1 = forzado manualmente |

**Seed 2026 (14 festivos Gran Canaria / Vecindario):** Año Nuevo, Epifanía, Martes de Carnaval, Jueves Santo, Viernes Santo, Día del Trabajo, Día de Canarias, Asunción, Ntra. Sra. del Pino, Fiesta Nacional, San Rafael, Todos los Santos, Inmaculada, Navidad.

### Tabla: `rrhh_guardias`

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | INTEGER PK AUTOINCREMENT | — | — |
| `fecha` | TEXT NOT NULL UNIQUE | — | YYYY-MM-DD |
| `tipo` | TEXT NOT NULL | `'lab'` | `lab` = laborable \| `fest` = festivo |
| `publicada` | INTEGER NOT NULL | `0` | 1 = publicada al equipo |
| `notas` | TEXT | NULL | Notas opcionales |
| `created_at` | TEXT NOT NULL | `datetime('now')` | — |

Las fechas se calculan cada 19 días desde el 4 de abril de 2026 (en ambas direcciones, cubriendo todo 2026). Las guardias se crean en BD al abrirse desde el calendario.

### Tabla: `rrhh_guardia_slots`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK AUTOINCREMENT | — |
| `guardia_id` | INTEGER NOT NULL FK | → `rrhh_guardias.id` ON DELETE CASCADE |
| `empleado_id` | TEXT NOT NULL FK | → `rrhh_empleados.id` |
| `hora_inicio` | INTEGER NOT NULL DEFAULT 9 | Hora de inicio (0-23) |
| `hora_fin` | INTEGER NOT NULL DEFAULT 14 | Hora de fin (0-33; >23 = día siguiente) |

**Constraint:** `UNIQUE(guardia_id, empleado_id)` — un slot por empleado por guardia.

### Tabla: `rrhh_guardia_defaults`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK AUTOINCREMENT | — |
| `empleado_id` | TEXT NOT NULL UNIQUE FK | → `rrhh_empleados.id` |
| `hora_inicio` | INTEGER NOT NULL DEFAULT 9 | Hora inicio por defecto |
| `hora_fin` | INTEGER NOT NULL DEFAULT 14 | Hora fin por defecto |

**Seed de defaults:** ani(9→14), dulce(10→14), ovidio(9→16), noelia(14→18), leti(16→21), celia(16→20), julio(19→21), javier(18→23), maria(21→33 = 09:00+1día).

### Tabla: `rrhh_vacaciones`

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | INTEGER PK AUTOINCREMENT | — | — |
| `empleado_id` | TEXT NOT NULL FK | — | → `rrhh_empleados.id` |
| `fecha_inicio` | TEXT NOT NULL | — | YYYY-MM-DD |
| `fecha_fin` | TEXT NOT NULL | — | YYYY-MM-DD |
| `estado` | TEXT NOT NULL | `'pend'` | `pend` \| `conf` \| `done` |
| `tipo` | TEXT NOT NULL | `'vac'` | `vac` = vacaciones ordinarias · `comp` = descanso compensatorio por guardia |
| `created_at` | TEXT NOT NULL | `datetime('now')` | — |

**Nota:** la columna `tipo` se añade vía `ALTER TABLE` idempotente en `POST /api/rrhh/migrate`.

### Tabla: `rrhh_ausencias`

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | INTEGER PK AUTOINCREMENT | — | — |
| `empleado_id` | TEXT NOT NULL FK | — | → `rrhh_empleados.id` |
| `fecha` | TEXT NOT NULL | — | YYYY-MM-DD |
| `tipo` | TEXT NOT NULL | `'med'` | `med` = médica \| `other` |
| `nota` | TEXT | NULL | Descripción opcional |
| `created_at` | TEXT NOT NULL | `datetime('now')` | — |
