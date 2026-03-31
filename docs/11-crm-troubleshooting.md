# 11 — CRM: Troubleshooting

> [[README|← Índice]] · [[10-crm-operativa|← Operativa]] · [[08-crm-arquitectura|Arquitectura →]]

#crm #troubleshooting #bugs

---

## Checklist rápido

Cuando algo no cuadra, seguir este orden:

1. ¿La página carga? → Si no, ver **Problema 2**
2. ¿Los importes son ~37% de la realidad? → **Problema 1**
3. ¿Cross-sell = 0%? → **Problema 3**
4. ¿% Receta vendedor = 0%? → **Problema 4**
5. ¿Timeout al precalcular? → **Problema 5**
6. ¿Números raros/duplicados? → **Problema 6**
7. ¿Peticiones colgadas? → **Problema 7**

---

## Problema 1: Facturación muestra ~37% del valor real

**Síntoma:** Importes del CRM ≈ un tercio de los datos reales.

**Causa:** Código usaba `SUM(ABS(imp_neto))` sobre cabeceras. El `imp_neto` en cabeceras no es el total facturado.

**Solución:** Usar `SUM(pvp * unidades)` sobre líneas detalle (`es_cabecera=0`). Ver [[08-crm-arquitectura#Fórmula de facturación]].

---

## Problema 2: Página CRM en blanco (crash React)

**Síntoma:** Página en blanco o error JS al seleccionar un período.

**Causa:** `null.toLocaleString()` — cuando un vendedor tiene 0 tickets, la división SQL devuelve NULL y el formatter de React explota.

**Solución:** Conversión null→0 en formatters:
```javascript
(value ?? 0).toLocaleString()
```

**Detectar:** Consola del navegador → `Cannot read properties of null (reading 'toLocaleString')`.

---

## Problema 3: Cross-sell siempre 0%

**Síntoma:** % cross-sell = 0% en todos los períodos.

**Causa:** Query de cross-sell no implementada en el precálculo.

**Solución:** Verificar que existe el step 6 (cross-sell) en `runMonth` dentro de `precalcular/route.ts`. Relanzar precálculos de todos los meses.

**Valor esperado:** ~8%.

---

## Problema 4: % Receta por vendedor siempre 0%

**Síntoma:** Columna "% Receta" = 0% para todos los vendedores.

**Causa:** `pct_receta` no se calculaba a nivel vendedor.

**Solución:** Verificar que la query de vendedores incluye `SUM(CASE WHEN es_receta=1 THEN 1 ELSE 0 END)`. Relanzar precálculos.

**Valores esperados:** 50-85% según vendedor.

---

## Problema 5: Timeout en precálculo

**Síntoma:** Precálculo no devuelve respuesta.

**Causas y soluciones:**

| Causa | Solución |
|-------|----------|
| Plan Hobby Vercel (10s) | Upgrade a Pro (300s) |
| Falta de índices | `GET /api/crm/precalcular?step=index` |
| Muchos meses a la vez | Precalcular mes a mes |

**Verificar índices:**
```javascript
fetch('/api/crm/precalcular?debug=indexes').then(r=>r.json()).then(console.log);
```
Deben existir: `idx_ventas_ame` e `idx_ventas_amet`.

---

## Problema 6: Datos duplicados o mezclados

**Síntoma:** Facturación duplicada o mezcla de datos.

**Causa:** Se usó `?source=json` que inyecta datos hardcodeados sin borrar los de Turso.

**Solución:** Relanzar precálculo mes a mes con `?year=X&month=Y` para todos los meses. ⚠️ NUNCA usar `?source=json` si ya hay datos de Turso.

---

## Problema 7: Requests pending bloquean conexiones

**Síntoma:** Peticiones al CRM colgadas indefinidamente.

**Causa:** Peticiones previas con timeout siguen "pending", agotan pool HTTP/2.

**Solución:** Cerrar TODAS las pestañas de `gestion.vidalreig.com` y abrir una nueva.
