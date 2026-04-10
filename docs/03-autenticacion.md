# Sistema de Autenticación

> Volver a [[README]] · Relacionado: [[05-api-endpoints]]

---

## Resumen

Dos mecanismos de autenticación coexisten:

1. **Auth.js v5 + Google OAuth** — para usuarios humanos (navegador)
2. **JWT HS256 service-to-service** — para scripts del pipeline (sin navegador)

---

## 1. Auth.js v5 + Google OAuth (usuarios humanos)

### Flujo

```
Usuario → Click "Iniciar sesión con Google"
  → Redirect a Google OAuth (scope: email, profile)
  → Google devuelve token con email @farmaciareig.net
  → Auth.js verifica dominio + busca en tabla usuarios de Turso
  → Crea sesión con cookie httpOnly
  → Redirect a /
```

### Autorización por módulo

Cada endpoint protegido llama a `requirePermiso(modulo)` que:
1. Lee la sesión Auth.js (cookie)
2. Obtiene el usuario de la tabla `usuarios` de Turso
3. Verifica que el usuario tiene permiso para el módulo en `permisos_modulo`
4. Devuelve `{ user }` o `{ error: 401/403 }`

11 módulos restringibles en 4 categorías (Finanzas/Marketing/RRHH/Admin).
38 endpoints blindados. Defensa en profundidad: middleware + layout + API + client.

### Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `AUTH_SECRET` | Secret de Auth.js para firmar sesiones |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret |
| `TURSO_DATABASE_URL` | URL libSQL de Turso |
| `TURSO_AUTH_TOKEN` | Token auth de Turso |

---

## 2. JWT HS256 service-to-service (pipeline scripts)

> Añadido 2026-04-09 para resolver HTTP 401 en fase 10 (precálculos CRM).
> Los scripts Python del pipeline no tienen sesión Auth.js (no hay navegador).

### Flujo

```
Script Python (disparar_precalculos.py)
  → Lee REIG_SERVICE_SECRET de env var o .env.local
  → Genera JWT HS256 con stdlib (hmac + hashlib + base64, sin PyJWT):
      header: {"alg": "HS256", "typ": "JWT"}
      payload: {"sub": "reig-pipeline", "iat": now, "exp": now + 300}
  → Envía POST con header: Authorization: Bearer <jwt>

Endpoint Next.js (route.ts)
  → requirePermiso("admin_panel", req)  // nota: pasa req
  → requirePermiso detecta req, llama a verificarServiceToken(req)
  → src/lib/service-auth.ts:
      - Extrae Bearer token del header Authorization
      - Verifica firma HS256 con jose/jwtVerify contra REIG_SERVICE_SECRET
      - Verifica sub === "reig-pipeline"
      - Devuelve usuario virtual PIPELINE_USER (role=admin)
  → Si JWT válido: acceso concedido (bypass Auth.js)
  → Si JWT inválido/ausente: fallthrough a Auth.js normal
```

### Ficheros clave

| Fichero | Rol |
|---------|-----|
| `src/lib/service-auth.ts` | Verificador JWT (jose library) |
| `src/lib/auth.ts` | `requirePermiso(modulo, req?)` — intenta JWT si req presente |
| `src/app/api/crm/precalcular/route.ts` | Pasa `req` a requirePermiso |
| `scripts/disparar_precalculos.py` (en IA REIG) | Generador JWT + caller HTTP |

### Usuario virtual del pipeline

```typescript
const PIPELINE_USER: UserSession = {
  email: "pipeline@farmacia-reig.local",
  nombre: "Pipeline Automático",
  role: "admin",
  departamento: "ambos",
  activo: 1,
};
```

### Variables de entorno

| Variable | Dónde | Descripción |
|----------|-------|-------------|
| `REIG_SERVICE_SECRET` | Vercel (Prod + Preview) | Secret compartido para firmar/verificar JWT |
| `REIG_SERVICE_SECRET` | `.env.local` o env var local | Mismo secret para que los scripts Python lo lean |

### Seguridad

- Token expira en 5 minutos (suficiente para un batch de precálculos)
- Solo acepta `sub: "reig-pipeline"` — cualquier otro subject es rechazado
- Si `REIG_SERVICE_SECRET` no está configurado, el verificador devuelve null (no rompe nada, simplemente no autentica por JWT)
- El fallthrough a Auth.js garantiza que los usuarios humanos siguen funcionando igual

---

## Histórico

- **v1 (2026-03)**: Cookies httpOnly manuales con token `email|hash~timestamp`
- **v2 (2026-04-09 sesión 11)**: Migración a Auth.js v5 + Google OAuth + `requirePermiso()` con 11 módulos
- **v3 (2026-04-09 sesión 13)**: JWT HS256 service-to-service para pipeline automático
