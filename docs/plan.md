# Plan: Neon + esquema de roles dinámicos + auth con contraseña y 2FA

> Fecha: 2026-11-05 · Estado: **completado** (verificación Fase 7 en verde, 2026-11-06)

## Objetivo

1. Conectar la base de datos a **Neon** (proyecto `lucky-violet-45235119`, org `org-silent-flower-89199288`, branch `production`).
2. Reemplazar el enum de roles por una **tabla `roles` editable** con permisos por módulo.
3. Auth por **contraseña** (reemplaza PIN): ADMIN y DESARROLLADOR con **2FA TOTP** (Google Authenticator); COLABORADOR solo contraseña; CLIENTE es etiqueta sin login.
4. Crear **`db/schema.sql`** (DDL inicial) y **`db/seed.sql`** (datos iniciales).
5. Dejar instrucciones para desplegar el backend en la cuenta Render del usuario (sin acceder a su cuenta).

## Decisiones confirmadas con el usuario

| Decisión | Respuesta |
|---|---|
| Gestión de roles | Tabla dinámica editable con los 4 roles sembrados |
| OPERADOR / REPARTIDOR | Son colaboradores → rol `COLABORADOR` |
| Rol CLIENTE | Solo etiqueta, **sin login** |
| "Contactos" | Es el módulo **Clientes** actual (solo ADMIN) |
| Backend Render | Yo preparo config; el usuario crea el servicio |
| DB `sistema-gas-db` en Greenline | Dejarla ahí (no tocar) |

## Permisos sembrados por defecto (editables desde la UI)

Claves: `ventas`, `pagos`, `clientes`, `inventario`, `cajas`, `gastos`, `reportes`, `configuracion`, `usuarios`, `roles`.
Dashboard y notificaciones siempre visibles con sesión válida.

| Rol | 2FA | Login | Permisos |
|---|---|---|---|
| ADMIN | sí | sí | todos (incl. `clientes` = contactos) |
| DESARROLLADOR | sí | sí | todos **excepto** `clientes` |
| COLABORADOR | no | sí | `ventas`, `pagos`, `inventario`, `gastos` |
| CLIENTE | no | **no** | `[]` |

---

## Fase 1 — Neon

1. `npm i -g neon@latest` (fallback: `npx neon@latest`).
2. `neon login` → navegador; pedir al usuario que complete. Reintentar si expira.
3. En la raíz del proyecto:
   ```
   neon init -y --org-id org-silent-flower-89199288 --project-id lucky-violet-45235119 --branch production --services postgres
   ```
   Crea `neon.ts`, contexto `.neon/` e instala skills de Neon para el agente.
4. `neon deploy` → provisiona y escribe variables en `.env.local`.
5. Leer las skills de Neon instaladas (`neon-postgres`) y seguir sus mejores prácticas (pooler vs directo).

### Cableado en el código
- `lib/prisma.ts` ya usa `DATABASE_URL` + `@prisma/adapter-pg` → correcto para Neon (confirmar nombre de variable que escribe `neon deploy`; si es `POSTGRES_URL`, mapear).
- `prisma7.config.ts` y `prisma/seed.ts` cargan solo `.env` → cambiar a `dotenv.config({ path: [".env.local", ".env"] })`.
- Agregar `tsx` como devDependency (lo invoca `db:seed` y falta).

## Fase 2 — Esquema

### Modelo `Rol` (nuevo, reemplaza al enum)

| Campo | Descripción |
|---|---|
| `nombre` (unique) | ADMIN, DESARROLLADOR, COLABORADOR, CLIENTE |
| `requiere2fa` | true en ADMIN y DESARROLLADOR |
| `puedeLogin` | false en CLIENTE |
| `permisos` (Json) | array de claves de módulo |
| `activo`, `esSistema` | protección de roles sembrados |

### Modelo `Usuario` (cambia)

- `pinHash` → `passwordHash` (scrypt, mínimo 8 caracteres)
- `mustChangePassword` (true al crearse)
- `rolId` → FK a `roles`
- `twoFactorSecret` (cifrado AES-256-GCM con clave derivada de `AUTH_SECRET`) + `twoFactorEnabled`

Se conserva el historial de migraciones; se agrega una migración nueva. Sobre Neon corre desde cero.

## Fase 3 — Archivos SQL

- **`db/schema.sql`**: DDL consolidado del esquema final vía
  `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.
- **`db/seed.sql`**: INSERTs idempotentes (`ON CONFLICT DO NOTHING`) de roles, marcas, repartidores, config y usuarios con hash scrypt precalculado.

**Usuarios sembrados:**
- `admin` / `Admin123!` → ADMIN
- `colaborador` / `Colabora123!` → COLABORADOR
- Ambos con `mustChangePassword=true`.

Se mantiene `db:deploy` + `db:seed` (Prisma) como vía principal.

## Fase 4 — Autenticación

### Flujo por pasos (cookie temporal `gas_pend`, 15 min, HMAC)

```
1. /login → nombre + contraseña
   ├─ rol no puedeLogin (CLIENTE) → error
   ├─ mustChangePassword → /login/cambiar-password
   │     └─ (si requiere2fa) → /login/2fa/setup   ← QR Google Authenticator
   ├─ requiere2fa && !enabled → /login/2fa/setup
   ├─ requiere2fa && enabled → /login/2fa (código 6 dígitos)
   └─ listo → cookie sesión completa → /dashboard
```

- **2FA**: TOTP con `otpauth` + QR con `qrcode`; verificación ±1 ventana.
- `/login/2fa/setup`: genera secreto, muestra QR, exige verificar un código antes de activar.
- Sesión: cookie `gas_session` con `rolId`; permisos cargados del rol con `cache()` por request.
- Guardas: `exigirPermiso(permiso)` (páginas) y `exigirPermisoApi(permiso)` (server actions).
- Se elimina el PIN: borrar `PinForm` de Configuración; en `/usuarios` el ADMIN/DEV puede resetear contraseñas (`mustChangePassword=true`).

## Fase 5 — UI de roles y usuarios

- **`/roles`** (nueva): CRUD de roles con checkboxes de permisos; guard con `exigirPermiso("roles")`; no borrar último rol con permiso `usuarios`.
- **`/usuarios`** (rework): creación por ADMIN/DEV → nombre, teléfono, rol, contraseña inicial → `mustChangePassword=true`. Reset de contraseña, desactivar. Sin auto-eliminación.
- **Sidebar**: filtrado por permisos + ítem "Roles"; `/clientes` solo con permiso `clientes`.
- Guards de páginas existentes (ventas, inventario, cajas, gastos, reportes, pagos, configuración).

## Fase 6 — Render (el usuario crea el servicio)

1. Render → **New Web Service** → repo `idmr023/sistema-gas`, rama `main`, Runtime Node.
2. Build: `npm install && npx prisma generate && npm run build` · Start: `npm start` · Node 22.
3. Env vars: `DATABASE_URL` (cadena **pooled** de Neon), `AUTH_SECRET`.
4. Pre-Deploy Command (opcional): `npx prisma migrate deploy && npx prisma db seed`.
5. No se toca nada en Render/Greenline.

## Fase 7 — Verificación

1. `npm run typecheck` + `npm run lint` → sin errores (incluye resolver el error preexistente `LayoutProps` de Next 16, leyendo `node_modules/next/dist/docs/`).
2. `npm run build` → debe pasar (capturar salida).
3. `npm start` con `.env.local` + pruebas end-to-end:
   - Login `admin` → cambio forzado → setup 2FA (TOTP generado con `otpauth`) → dashboard lee Neon ✓
   - Login `colaborador` → solo contraseña ✓
   - Login rol CLIENTE → rechazado ✓
   - Colaborador en `/clientes` o `/usuarios` → bloqueado ✓
   - Crear/editar rol desde UI ✓
   - `scripts/e2e.mjs` actualizado (hoy asume PIN) y en verde
4. **Reporte final**: qué cambió, salida de comandos que prueban la fase 7, fallos si los hay.

---

## Notas

- No se hacen commits salvo petición explícita.
- El trabajo previo sin commitear (Cajas/Gastos/Usuarios) se integra con los nuevos guards.
- Dependencias a agregar: `otpauth`, `qrcode`, `tsx`.

---

## Resultado de la Fase 7 (2026-11-06)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✓ sin errores |
| `npm run lint` | ✓ sin errores ni warnings |
| `npm run build` | ✓ build completo (24 páginas) |
| `npm run db:deploy` | ✓ 3 migraciones aplicadas en Neon (la de roles se reescribió para ser segura con datos existentes: backfill de `password_hash`/`updated_at`, mapeo del enum `rol` → `rol_id`, roles sembrados antes de la FK) |
| `npm run db:seed` | ✓ 4 roles, usuarios admin/colaborador garantizados (también si el hash previo no era válido) |
| `node scripts/e2e.mjs` | ✓ **TODO OK** (login admin con cambio forzado + 2FA, colaborador sin 2FA, CLIENTE rechazado, guards de módulo, ventas/pagos/CSV) |

### Ajustes hechos al plan

- **Bug 2FA**: tras verificar el código, `_verificar2fa` llamaba a `avanzar()` que volvía a redirigir a `/login/2fa` → ahora crea la sesión directamente (`app/login/actions.ts`).
- **Guards con PPR (Next 16)**: al estar envueltos en `Suspense`, un redirect de `exigirPermiso` llega como `<meta http-equiv="refresh" content="1;url=/dashboard">` dentro de un 200 (sin filtrar contenido) en vez de un 3xx. El e2e acepta ambos formatos.
- **`prisma migrate resolve --rolled-back`** necesario tras reescribir la migración fallida.
- Añadido **`render.yaml`** (blueprint de Render) con build/start/pre-deploy y env vars sin secretos.
- `.env.example` actualizado (ya no menciona PIN).
