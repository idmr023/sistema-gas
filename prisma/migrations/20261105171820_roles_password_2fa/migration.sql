/*
  Migración a roles dinámicos + contraseña + 2FA.

  Precauciones con datos existentes:
  - Se crea y siembra `roles` ANTES de tocar `usuarios` (la FK lo exige).
  - `password_hash` / `updated_at` se añaden con backfill y luego NOT NULL
    (no se puede añadir NOT NULL sin default sobre tabla con filas).
  - El enum antiguo `rol` (ADMIN/OPERADOR/REPARTIDOR) se mapea a `rol_id`
    antes de dropear la columna: OPERADOR/REPARTIDOR/otros → COLABORADOR.
  - Los hashes de PIN no equivalen a contraseñas: se rellena con un valor
    aleatorio y `must_change_password = true`; `db:seed` reasigna las
    credenciales de admin/colaborador.
*/

-- 1) Roles (necesario antes de la FK y del mapeo de rol)
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "requiere_2fa" BOOLEAN NOT NULL DEFAULT false,
    "puede_login" BOOLEAN NOT NULL DEFAULT true,
    "permisos" JSONB NOT NULL DEFAULT '[]',
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

INSERT INTO "roles" ("nombre", "requiere_2fa", "puede_login", "permisos", "es_sistema", "activo", "updated_at") VALUES
  ('ADMIN',         true,  true,  '["ventas","pagos","clientes","inventario","cajas","gastos","reportes","configuracion","usuarios","roles"]'::jsonb, true, true, NOW()),
  ('DESARROLLADOR', true,  true,  '["ventas","pagos","inventario","cajas","gastos","reportes","configuracion","usuarios","roles"]'::jsonb,        true, true, NOW()),
  ('COLABORADOR',   false, true,  '["ventas","pagos","inventario","gastos"]'::jsonb,                                                               true, true, NOW()),
  ('CLIENTE',       false, false, '[]'::jsonb,                                                                                                    true, true, NOW());

-- 2) Columnas nuevas de usuarios (backfill → NOT NULL)
ALTER TABLE "usuarios" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "usuarios" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "usuarios" ADD COLUMN "two_factor_secret" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "updated_at" TIMESTAMP(3);

UPDATE "usuarios" SET "password_hash" = md5(random()::text || "nombre") WHERE "password_hash" IS NULL;
UPDATE "usuarios" SET "updated_at" = NOW() WHERE "updated_at" IS NULL;

ALTER TABLE "usuarios" ALTER COLUMN "password_hash" SET NOT NULL;
ALTER TABLE "usuarios" ALTER COLUMN "updated_at" SET NOT NULL;

-- 3) Mapeo del enum antiguo `rol` → `rol_id`
ALTER TABLE "usuarios" ADD COLUMN "rol_id" INTEGER;

UPDATE "usuarios" SET "rol_id" = CASE "rol"::text
  WHEN 'ADMIN'         THEN (SELECT "id" FROM "roles" WHERE "nombre" = 'ADMIN')
  WHEN 'DESARROLLADOR' THEN (SELECT "id" FROM "roles" WHERE "nombre" = 'DESARROLLADOR')
  WHEN 'CLIENTE'       THEN (SELECT "id" FROM "roles" WHERE "nombre" = 'CLIENTE')
  ELSE (SELECT "id" FROM "roles" WHERE "nombre" = 'COLABORADOR')
END;
-- Seguridad: si quedó NULL (tabla vacía / rol inesperado), ADMIN
UPDATE "usuarios" SET "rol_id" = (SELECT "id" FROM "roles" WHERE "nombre" = 'ADMIN') WHERE "rol_id" IS NULL;

ALTER TABLE "usuarios" ALTER COLUMN "rol_id" SET NOT NULL;
ALTER TABLE "usuarios" ALTER COLUMN "rol_id" SET DEFAULT 1;

-- 4) Eliminar columnas / tipo antiguo
ALTER TABLE "usuarios" DROP COLUMN "pin_hash",
                        DROP COLUMN "rol";

DROP TYPE "Rol";

-- 5) Índice y FK
CREATE INDEX "usuarios_rol_id_idx" ON "usuarios"("rol_id");

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
