# Roadmap y Pendientes

> Volver a [[README]]

---

## Corto Plazo (próximas semanas)

| Tarea | Módulo | Estado |
|-------|--------|--------|
| Integración email Santander con remesas | Retiradas | Diseñado, pendiente formato emails |
| Decisión botón "A Bea" | Retiradas | Ovidio consultará con Bea |
| DNS gestion.vidalreig.com → Vercel | Infra | Pendiente config en Enom |
| Pipeline n8n fichas SEO | SEO | En desarrollo |
| Completar migración reig.db → Turso | Datos | En proceso (BD grande: 904MB) |

## Medio Plazo (1-3 meses)

| Tarea | Módulo | Dependencias |
|-------|--------|-------------|
| Módulo Ventas: dashboard KPIs | Web gestión | Migración Turso completa |
| Módulo CRM: segmentación clientes | Web gestión | Migración Turso completa |
| Computer Use Windows | Automatización | Disponibilidad de Anthropic |
| Plan transición Julio Auyanet | Operaciones | Jubila mayo 2026 |
| OCR facturas proveedores end-to-end | Automatización | Pipeline Python |
| Transición óptica (Miriam jubilándose) | Operaciones | Contratación en curso |

## Largo Plazo (3-12 meses)

| Tarea | Módulo | Impacto |
|-------|--------|---------|
| Claude API integrado en web | Web gestión | Chat inteligente sobre datos farmacia |
| Alertas automáticas de anomalías | BI | Detección ventas/inventario/dispensaciones |
| Automatización completa pipeline datos | BI | Farmatic → dashboards sin intervención |
| Árboles decisión: Alergia (~10K€) | Clínico | Nueva categoría OTC |
| Árboles decisión: Circulatorio (~9K€) | Clínico | Incluye hemorroides |
| Análisis ISDIN VMI impacto 3 años | Compras | Requiere datos granulares por producto |

## Roadmap ReigBI (orden de implementación)

```
1. Sales explorer MVP ──────────── (próximo módulo web)
2. Módulo compras ──────────────── (análisis proveedores)
3. Analítica pacientes ─────────── (dispensaciones anonimizadas)
4. Inventario ──────────────────── (stock, rotación, alertas)
5. Claude API chat ─────────────── (consultas en lenguaje natural)
6. Alertas automáticas ─────────── (detección anomalías)
7. Automatización Computer Use ─── (eliminación export manual)
```

---

## Riesgos identificados

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| Julio jubila mayo 2026 | 10% revenue, segundo mejor CS | Plan cobertura pendiente |
| Miriam (óptica) jubilándose | Transición departamento | Contratación en curso |
| Davinia FCT hasta 15/5/2026 | Podría irse | Objetivo: autonomía completa en mostrador |
| Migración Turso grande (904MB) | Tiempo y timeouts | Scripts con reanudación (migrar_resume.mjs) |
