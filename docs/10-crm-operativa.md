# 10 — CRM: Guía operativa de precálculos

> [[README|← Índice]] · [[09-crm-endpoints|← Endpoints]] · [[11-crm-troubleshooting|Troubleshooting →]]

#crm #operativa #precalculos #howto

---

## Cuándo relanzar precálculos

- Al subir nuevos datos de ventas a Turso
- Al corregir un bug en la lógica de precálculo (recalcular meses afectados)
- Cuando los números del CRM no cuadran con los datos reales
- Al importar datos de un nuevo mes

## Precalcular un solo mes

Abrir consola del navegador (F12) en `gestion.vidalreig.com`:

```javascript
// 1. Lanzar
window._m = null;
fetch('/api/crm/precalcular?year=2026&month=3', {method:'POST'})
  .then(r=>r.json())
  .then(d=>{ window._m = d; })
  .catch(e=>{ window._m = {error: e.message}; });

// 2. Comprobar (repetir hasta que no diga "running")
window._m ? JSON.stringify(window._m).substring(0,300) : 'running';
```

## Precalcular un año completo

```javascript
async function precalcularMes(year, month) {
  const r = await fetch(`/api/crm/precalcular?year=${year}&month=${month}`, {method:'POST'});
  const d = await r.json();
  console.log(`${year}-${String(month).padStart(2,'0')}: ${d.ok ? '✅' : '❌ ' + JSON.stringify(d)}`);
  return d;
}

async function precalcularAnio(year, mesesHasta = 12) {
  for (let m = 1; m <= mesesHasta; m++) {
    await precalcularMes(year, m);
  }
  console.log(`✅ ${year} completo`);
}

// Uso:
await precalcularAnio(2024);
await precalcularAnio(2025);
await precalcularAnio(2026, 3);  // ajustar último mes
```

## Precalcular los 3 años de golpe

```javascript
async function precalcularTodo() {
  await precalcularAnio(2024);
  await precalcularAnio(2025);
  await precalcularAnio(2026, 3);  // ajustar según mes actual
  console.log('🎉 Todos los años precalculados');
}
precalcularTodo();
```

⏱️ Tiempo estimado: ~7-10 minutos para 27 meses.

## Verificar resultados

```javascript
fetch('/api/crm/resumen?desde=2026-01&hasta=2026-03')
  .then(r=>r.json())
  .then(d=>console.table(d));
```

### Valores de referencia (verificados 2026-03-31)

| Métrica | 2024 | 2025 | 2026 Q1 |
|---------|------|------|---------|
| Facturación | 3.688.214€ | 4.107.111€ | 991.500€ |
| Tickets | 96.684 | 101.994 | 24.154 |
| Cross-sell | 8,1% | 8,4% | 8,4% |
| % Receta | 74,8% | 72,5% | 72,1% |

Si cross-sell = 0% o % receta por vendedor = 0%, ver [[11-crm-troubleshooting]].

## Diagnóstico rápido

```javascript
// Filas en tablas resumen
fetch('/api/crm/precalcular?debug=tables').then(r=>r.json()).then(console.log);

// Índices en tabla ventas
fetch('/api/crm/precalcular?debug=indexes').then(r=>r.json()).then(console.log);
```
