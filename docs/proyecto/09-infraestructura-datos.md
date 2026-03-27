# Infraestructura de Datos — ReigBI

> Volver a [[README]] · Relacionado: [[02-stack-tecnologico]]

---

## Arquitectura de datos

```
Farmatic v16 (SQL Server)
    ↓ export manual (→ automático con Computer Use)
Excel / CSV raw
    ↓ scripts Python
SQLite local (reig.db, OneDrive)  ←── fuente de verdad para análisis
    ↓ migración Node.js
Turso cloud (libSQL)  ←── fuente para web de gestión
    ↓
gestion.vidalreig.com (Next.js + Vercel)
```

## Base de datos local: `reig.db`

Fichero SQLite en OneDrive (`IA REIG/`). 904 MB.

| Tabla | Contenido | Filas |
|-------|-----------|-------|
| `ventas` | Diario de ventas Farmatic | 1.283.338 |
| `compras` | Histórico de compras a proveedores | — |
| `dispensaciones` | Control H (seguimiento farmacoterapéutico) | — |
| `inventario` | Estado de inventario actual | — |
| `inventario_snapshot` | Snapshots periódicos | — |
| `maestro_aportaciones` | Tipos aportación farmacéutica SCS | — |
| `ficheros_procesados` | Registro ficheros ya cargados (evita duplicados) | — |

## Anonimización (dispensaciones)

Los datos de Control H contienen paciente identificado. Proceso de anonimización local:

1. CIP se hashea con SHA-256 + salt local (la sal NUNCA sale del equipo)
2. Se extraen sexo, edad, fecha como campos separados
3. Nombre y apellidos se eliminan
4. Script: `anonimizar_ctrl_h.py`

## Scripts de carga (Python)

| Script | Función |
|--------|---------|
| `cargar_ventas.py` | Diario ventas → SQLite |
| `cargar_dispensaciones.py` | Control H → SQLite (previa anonimización) |
| `anonimizar_ctrl_h.py` | Hasheo CIP + eliminación datos personales |

**Regla crítica de ventas:** cargar entero → `ffill()` en Fecha y Número Doc → luego dividir por mes. NUNCA dividir antes de propagar fechas.

## Migración a Turso Cloud

Scripts Node.js para replicar datos locales a Turso:

- `migrar.mjs` — migración completa (lotes de 500 filas)
- `migrar_resume.mjs` — reanudación desde punto de corte

Usa `@libsql/client` + `sql.js` (lectura de SQLite local sin servidor).

**Estado (27/03/2026):** Migración iniciada. La BD es grande (904MB) así que tarda.

## KPIs: fuente autoritativa

Archivo `Kpis_updated_270226.json` — fuente de verdad para KPIs. Datos desde enero 2023.

**Regla:** El JSON KPIs es siempre el punto de partida. Nunca recalcular desde Excel si el JSON ya tiene el dato.

Para rankings de producto por categoría: usar `diario_ventas_enerodiciembre_2025.xlsx` directamente (el JSON solo guarda top 20 mensuales).

## Carpeta LANDING (estructura ficheros raw)

```
LANDING/
├── VENTAS/          ← Diarios de venta Excel
├── COMPRAS/         ← Históricos de compras Excel
├── DISPENSACIONES/  ← Exports Control H
└── INVENTARIO/      ← Snapshots inventario
```

## Reglas de interpretación de datos

Ver documento completo: 25 reglas confirmadas por Ovidio (25/03/2026).

Las más críticas:

| Regla | Impacto |
|-------|---------|
| Ticketeo con usuario ajeno | Distorsiona métricas por vendedor |
| Docs W no son venta | Pagos de créditos, suman a caja pero no a facturación |
| "A Cuenta" no es venta | Movimientos contra créditos. Excluir SIEMPRE |
| Vistabel es venta real | Incluir SIEMPRE. Solo excluir si Ovidio lo pide |
| ISDIN VMI distorsiona compras | Transfers automáticos nocturnos, no pedidos manuales |
| Sábados no laborables | Farmacia cerrada salvo guardias |
| IGIC, no IVA | Régimen fiscal Canarias |
| ffill obligatorio en ventas | Propagar Fecha y NumDoc antes de dividir por mes |
