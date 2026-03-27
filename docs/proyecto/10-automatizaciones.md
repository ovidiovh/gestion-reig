# Automatizaciones en Marcha

> Volver a [[README]] · Relacionado: [[07-reglas-negocio]], [[08-fichas-seo]]

---

## 1. Emails Santander → Google Sheets

**Estado:** Activo

Google Apps Script que:
1. Lee emails de ingreso bancario del Santander desde `ingresos@farmaciareig.net`
2. Extrae importe y datos del ingreso
3. Registra en Google Sheets

**Pendiente:** Integración con módulo de remesas de gestion.vidalreig.com para matching automático (ver [[07-reglas-negocio#Regla 5 Confirmación de remesas]]).

---

## 2. OCR Facturas de Proveedores

**Estado:** En desarrollo

Pipeline Python:
1. Lee facturas por IMAP (email)
2. OCR con Claude API (Haiku para bajo coste)
3. Extrae datos estructurados (proveedor, importe, fecha, líneas)

**Pendiente:** Implementación completa del pipeline end-to-end.

---

## 3. Fichas SEO con n8n

**Estado:** En desarrollo

Workflow n8n para producción de fichas en lote:
1. Input: lista de productos (nombre Farmatic/proveedor)
2. Investigación web automática
3. Generación contenido con Claude API + skill fichas-producto-web
4. Auditoría V3 automática (37 + 15 checks)
5. Output: ficheros HTML listos para We Make It

**Objetivo:** Escalar de ~5 fichas/día (manual) a ~50 fichas/día (automatizado con revisión humana).

---

## 4. Capturas Rowa

**Estado:** Manual recurrente

El robot Rowa (8 salidas, S1-S8) no tiene histórico nativo de dispensaciones por salida. Ovidio toma captura diaria (última hora) para acumular datos.

Notas:
- S1 prácticamente inactiva
- S8 = salida guardia nocturna
- El objetivo es tener datos suficientes para analizar patrones de dispensación por salida

---

## 5. Pipeline de datos (futuro)

**Estado:** Diseñado, pendiente Computer Use Windows

```
Farmatic (Windows)
    ↓ Computer Use (automático)
Excel exports
    ↓ Scripts Python (automático)
SQLite local (OneDrive)
    ↓ Sync (automático)
Turso cloud
    ↓
Web gestión + dashboards + alertas
```

Hoy Ovidio exporta manualmente de Farmatic. Cuando Computer Use esté disponible en Windows, el mismo pipeline funciona sin intervención humana — solo cambia el operador (de Ovidio a Claude).
