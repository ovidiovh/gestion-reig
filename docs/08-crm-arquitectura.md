# 08 — CRM: Arquitectura y flujo de datos

> [[README|← Índice]] · [[09-crm-endpoints|Endpoints →]] · [[10-crm-operativa|Operativa →]] · [[11-crm-troubleshooting|Troubleshooting →]]

#crm #arquitectura #turso #vercel

---

## Stack

| Componente | Tecnología | Detalle |
|-----------|-----------|---------|
| Frontend | Next.js (React) | `gestion.vidalreig.com/crm` |
| Hosting | Vercel Pro | maxDuration=300s para serverless |
| Base de datos | Turso (LibSQL) | SQLite compatible, cloud-hosted |
| Precálculo | `src/app/api/crm/precalcular/route.ts` | Archivo central de toda la lógica |

## Flujo de datos

```
Programa de gestión farmacia
        ↓ (exportación .xlsx)
  Tabla `ventas` en Turso
    (~1.28M filas, cabeceras + líneas detalle)
        ↓ (precálculo mes a mes via API)
  4 tablas resumen:
    ├── crm_resumen_mensual      (1 fila/mes — KPIs globales)
    ├── crm_vendedores_mensual   (1 fila/vendedor/mes)
    ├── crm_productos_mensual    (1 fila/producto/mes)
    └── crm_segmentacion_mensual (tipos de pago, receta, etc.)
        ↓ (API endpoints JSON)
  Frontend CRM (dashboards, gráficos, rankings)
```

Ver diagrama visual: [[diagramas/crm-arquitectura.drawio]]

## Tabla `ventas` — Campos relevantes

Contiene **cabeceras** (resumen del ticket) y **líneas de detalle** (cada producto). Se distinguen por `es_cabecera`:

| Campo | Tipo | Uso |
|-------|------|-----|
| `anio` | INTEGER | Año de la venta |
| `mes` | INTEGER | Mes de la venta |
| `es_cabecera` | INTEGER | 1=cabecera, 0=línea detalle |
| `tipo` | TEXT | "Venta", "Devolución", etc. |
| `pvp` | REAL | Precio de venta al público |
| `unidades` | REAL | Unidades vendidas |
| `imp_neto` | REAL | Importe neto (⚠️ NO usar para facturación) |
| `vendedor` | TEXT | Nombre del vendedor |
| `es_receta` | INTEGER | 1=producto con receta, 0=venta libre |
| `num_ticket` | TEXT | Número de ticket (agrupa líneas) |

### Índices críticos

```sql
CREATE INDEX idx_ventas_ame ON ventas(anio, mes, es_cabecera);
CREATE INDEX idx_ventas_amet ON ventas(anio, mes, es_cabecera, tipo);
```

Sin estos índices las queries de precálculo pasan de ~15s a >60s (timeout).

## Fórmula de facturación

> ⚠️ **LECCIÓN CRÍTICA**: La facturación se calcula desde las **líneas de detalle**, NUNCA desde las cabeceras.

```sql
-- ✅ CORRECTO: detalle (es_cabecera=0)
SELECT SUM(pvp * unidades) FROM ventas
WHERE anio=? AND mes=? AND es_cabecera=0;

-- ❌ INCORRECTO: cabeceras con imp_neto (~37% del valor real)
SELECT SUM(ABS(imp_neto)) FROM ventas
WHERE anio=? AND mes=? AND es_cabecera=1;
```

## Cross-sell

Tickets que contienen TANTO productos de receta como de venta libre:

```sql
SELECT COUNT(DISTINCT num_ticket) FROM ventas
WHERE anio=? AND mes=? AND es_cabecera=0
  AND num_ticket IN (
    SELECT num_ticket FROM ventas
    WHERE anio=? AND mes=? AND es_cabecera=0 AND es_receta=1
  )
  AND num_ticket IN (
    SELECT num_ticket FROM ventas
    WHERE anio=? AND mes=? AND es_cabecera=0 AND es_receta=0
  );
```

Porcentaje: `pct_cross = tickets_cross / tickets_receta * 100` — valor esperado ~8%.

## % Receta por vendedor

```sql
SELECT vendedor,
  ROUND(SUM(CASE WHEN es_receta=1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as pct_receta
FROM ventas
WHERE anio=? AND mes=? AND es_cabecera=0
GROUP BY vendedor;
```

## Configuración Vercel

```typescript
// src/app/api/crm/precalcular/route.ts, línea 4
export const maxDuration = 300; // Vercel Pro permite hasta 300s
```

Plan Hobby = 10s (insuficiente). Plan Pro = 300s (necesario).
