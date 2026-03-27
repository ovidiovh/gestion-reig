# Fichas de Producto SEO — farmaciareig.net

> Volver a [[README]]

---

## Resumen

Fichas de producto optimizadas para SEO local (Vecindario → Gran Canaria → Canarias) y para IA Overviews (Google SGE, ChatGPT Search, Gemini). Se publican en farmaciareig.net a través del CMS We Make It.

## Pipeline de elaboración

```
Producto (Farmatic/proveedor)
    ↓
Investigación web (ficha técnica, fabricante, búsquedas)
    ↓
Optimización del nombre para SEO
    ↓
Generación HTML (9 secciones, solo spans)
    ↓
Auditoría V3 (37 puntos + 15 checks anti-basura)
    ↓
Copia-pega en modo código fuente del editor We Make It
```

## Formato técnico (CMS We Make It)

El CMS aplica CSS propio a `<p>` con márgenes enormes no sobreescribibles. Por eso:

**USAR SIEMPRE:** `<span style="display:block">`

**PROHIBIDO:** `<p>`, `<div>`, `<h1>/<h2>/<h3>`, `<br>`, `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`

### Jerarquía visual

| Nivel | Tag | Ejemplo |
|-------|-----|---------|
| H1 | `<span style="font-size:1.4em">` + `<strong>` + MAYÚSCULAS | Título producto |
| H2 | `<span style="font-size:1.25em">` + `<strong>` | Secciones principales |
| Subtítulo | `<strong>` solo | Subsecciones |
| Párrafo | `<span style="display:block">` | Texto normal |
| Negritas | `<strong>` inline | Dentro de párrafos |
| Énfasis | `<strong><em>` | "frente al Centro de Salud" |

## Estructura — 9 secciones exactas

| # | Sección | Requisitos clave |
|---|---------|-----------------|
| 1 | **Título H1** | MAYÚSCULAS + diferenciador + marca |
| 2 | **Introducción** | Abre con pregunta sobre dolor/problema. Min 300 chars. Marca+producto negrita 2x |
| 3 | **¿Por Qué Elegir?** | "Elegir" OBLIGATORIO en el título. Datos técnicos reales. Min 200 chars |
| 4 | **¿Cómo Usar?** | Subsecciones: Aplicación + Mantenimiento/Precauciones según proceda |
| 5 | **Beneficios** | Exactamente 3. Del PRODUCTO, no de la farmacia. Con datos técnicos |
| 6 | **FAQs** | Exactamente 3. Conversacionales (no sí/no). Cross-sell en al menos 1 |
| 7 | **Contacto** | Párrafo estándar: tel, WhatsApp, "frente al Centro de Salud", horario |
| 8 | **Compra + Envíos** | Cierre con envíos a todas las islas. Tenerife en negrita |
| 9 | **Nota** | "Las imágenes en nuestra web son ilustrativas..." |

## Metadatos (texto plano, fuera del HTML)

```
NOMBRE CMS: NOMBRE PRODUCTO EN MAYÚSCULAS (sin claim, sin marca farmacia)
METADESCRIPCIÓN: ≤155 chars con nombre + Farmacia Reig + Vecindario + Envíos Canarias
URL: /es-es/product/[slug-del-nombre-cms]
ALT IMAGEN: texto descriptivo keyword + marca + ubicación
```

**IMPORTANTE:** Los metadatos van FUERA de cualquier tag HTML. Texto plano.

## Regla de marca

| Tipo de producto | Marca a usar |
|------------------|-------------|
| Ortopedia | **Farmacia Ortopedia Reig** |
| Todo lo demás | **Farmacia Reig** |

Se aplica automáticamente, no se pregunta.

## Rotación de islas en envíos

Los envíos mencionan siempre islas + Tenerife. Las islas se rotan:

| Turno | Islas |
|-------|-------|
| 1 | La Palma / Fuerteventura |
| 2 | El Hierro / Lanzarote |
| 3 | La Gomera / La Graciosa |

## Auditoría V3

Script automático que verifica 37 puntos estructurales + 15 checks anti-basura (Bloque Q). Detecta errores comunes: metadata en HTML, 4 FAQs en vez de 3, títulos incorrectos, contacto reformulado, tags prohibidos, etc.

## Automatización n8n (en desarrollo)

Pipeline n8n para producción de fichas en lote:
- Entrada: lista de productos
- Investigación web automática
- Generación con Claude API + skill fichas-producto-web
- Auditoría V3 automática
- Output listo para publicar

Objetivo: pasar de generación manual (producto por producto) a sistema de producción en lote.

## Estrategia SEO

- **Hiperlocalismo canario:** Vecindario → Gran Canaria → Canarias. Solo envíos Canarias.
- **Tono funcional:** El cliente online busca producto, disponibilidad y precio.
- **Preparadas para IA Overviews:** Estructura FAQ, datos verificados, formato óptimo.
- **Google Ads activos:** Campaña Search Nicho Canarias (5€/día, solo Canarias). Productos sanitarios/ortopédicos nicho (CN primer dígito <6, PVP >19€).
- **Cuenta Google Ads:** 838-969-8798 · GA4: G-EQMSSX611L · GTM: GTM-KDXT3VLH
