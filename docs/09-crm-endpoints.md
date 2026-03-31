# 09 — CRM: Endpoints API

> [[README|← Índice]] · [[08-crm-arquitectura|← Arquitectura]] · [[10-crm-operativa|Operativa →]]

#crm #api #endpoints

---

Base URL: `https://gestion.vidalreig.com`

## Precálculo (escritura)

### `POST /api/crm/precalcular?year=YYYY&month=M`

Precalcula un mes desde datos reales de Turso. Borra los datos previos de ese mes y los recalcula.

```json
// Respuesta exitosa
{
  "ok": true,
  "step": "data",
  "counts": {
    "resumen": 27,
    "vendedores": 274,
    "productos": 122295,
    "segmentacion": 190
  },
  "log": ["[0.4s] Tablas resumen OK", "[0.5s] 2026-03: 7353 cabeceras", "..."]
}
```

Tiempo típico: 10-20 segundos por mes.

### `POST /api/crm/precalcular?source=json`

Importa datos desde JSON hardcodeado (solo 2024-2025). ⚠️ Borra TODOS los datos de las 4 tablas antes de insertar. No usar si hay datos precalculados desde Turso.

## Diagnóstico

### `GET /api/crm/precalcular?debug=tables`

Devuelve conteo de filas y facturación por año en las tablas resumen.

### `GET /api/crm/precalcular?debug=indexes`

Devuelve los índices existentes en la tabla `ventas`.

### `GET /api/crm/precalcular?step=index`

Crea los índices optimizados en `ventas` si no existen.

## Lectura (consulta)

### `GET /api/crm/resumen?desde=YYYY-MM&hasta=YYYY-MM`

KPIs globales del período.

```json
{
  "facturacion": 991500.15,
  "tickets": 24154,
  "ticket_medio": 41.05,
  "unidades": 68501,
  "pct_receta": 72.1,
  "tickets_receta": 50033,
  "tickets_cross": 4214,
  "pct_cross": 8.4
}
```

### `GET /api/crm/tendencia?desde=YYYY-MM&hasta=YYYY-MM`

Facturación mes a mes (para gráficos de tendencia).

### `GET /api/crm/vendedores?desde=YYYY-MM&hasta=YYYY-MM`

Ranking de vendedores.

```json
[
  {
    "vendedor": "A LORENZO",
    "tickets": 3951,
    "facturacion": 186379.33,
    "ticket_medio": 47.17,
    "unidades": 12121,
    "pct_receta": 74.6
  }
]
```

### `GET /api/crm/segmentacion?desde=YYYY-MM&hasta=YYYY-MM`

Segmentación por tipo de pago y receta/venta libre.

```json
{
  "byTipo": [{"tipo": "Efectivo", "tickets": 14674, "facturacion": 597078.79}, "..."],
  "byPago": ["..."],
  "byReceta": [
    {"tipo": "Receta", "tickets": 50033, "facturacion": 715226.3},
    {"tipo": "Venta libre", "tickets": 19334, "facturacion": 276273.85}
  ]
}
```

### `GET /api/crm/productos?desde=YYYY-MM&hasta=YYYY-MM&orderBy=facturacion&limit=20`

Top productos. `orderBy`: `facturacion` o `unidades`.

## Códigos de respuesta

| Código | Significado |
|--------|------------|
| 200 | OK |
| 200 + `ok:true` | Precálculo completado |
| 500 | Error en servidor (ver `message`) |
| Timeout | Vercel cortó la función (>300s Pro, >10s Hobby) |
