# Sistema de Autenticación

> Volver a [[README]] · Relacionado: [[05-api-endpoints]]

---

## Resumen

Autenticación simple basada en cookies httpOnly. Sin librería externa (no NextAuth, no Auth.js). Suficiente para uso interno con 1-2 usuarios.

## Flujo

```
Usuario → POST /api/auth {email, password}
  → Valida contra AUTH_USERS (env var)
  → Genera token: email|hash_base36~timestamp
  → Set-Cookie: reig-auth (httpOnly, Secure, SameSite=Lax, 30 días)
  → Redirect a /

Cada request → middleware.ts
  → Lee cookie reig-auth
  → Valida formato (split por ~, debe dar 2 partes)
  → Valida expiración (30 días)
  → Si falla → redirect a /login
```

## Token

**Formato:** `email|hash~timestamp`

- `email`: email del usuario en minúsculas
- `hash`: hash simple del email + AUTH_SECRET + timestamp, en base36
- `~`: separador (NO se usa `.` porque colisiona con los puntos del email)
- `timestamp`: Date.now() en milisegundos

**Bug histórico resuelto:** El separador original era `.`, que causaba que `ovidiov@gmail.com|hash.timestamp` al hacer `split(".")` diera 3+ partes en vez de 2. Se cambió a `~`.

## Middleware (`middleware.ts`)

Rutas públicas (no requieren auth):
- `/login`
- `/api/auth`
- Archivos estáticos (`/_next`, `/favicon`, cualquier ruta con `.`)

Todas las demás rutas requieren cookie `reig-auth` válida.

## Variables de entorno

| Variable | Formato | Ejemplo |
|----------|---------|---------|
| `AUTH_USERS` | `email:pass,email2:pass2` | `ovidiov@gmail.com:password123` |
| `AUTH_SECRET` | string libre | `reig-gestion-2026-x7k9m2p4q8` |
| `TURSO_DATABASE_URL` | URL libSQL | `libsql://reigbi-ovidiov.aws-eu-west-1.turso.io` |
| `TURSO_AUTH_TOKEN` | JWT Turso | (token largo) |

Todas configuradas en Vercel → Settings → Environment Variables.

## Logout

`DELETE /api/auth` → borra la cookie `reig-auth` poniendo Max-Age=0.
