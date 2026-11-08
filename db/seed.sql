-- ============================================================
-- seed.sql — Datos iniciales del Sistema de Gas (idempotente)
-- Uso: pegar en el SQL Editor de Neon (junto con schema.sql)
-- Contraseñas iniciales:
--   admin        → Admin123!      (cambiar en el primer inicio)
--   colaborador  → Colabora123!   (cambiar en el primer inicio)
-- ============================================================

-- 1) Roles (tabla dinámica de permisos)
INSERT INTO "roles" ("nombre", "requiere_2fa", "puede_login", "permisos", "es_sistema", "activo", "updated_at")
VALUES
  ('ADMIN',         true,  true,  '["ventas","pagos","clientes","inventario","cajas","gastos","reportes","configuracion","usuarios","roles"]'::jsonb, true, true, NOW()),
  ('DESARROLLADOR', true,  true,  '["ventas","pagos","inventario","cajas","gastos","reportes","configuracion","usuarios","roles"]'::jsonb,        true, true, NOW()),
  ('COLABORADOR',   false, true,  '["ventas","pagos","inventario","gastos"]'::jsonb,                                                               true, true, NOW()),
  ('CLIENTE',       false, false, '[]'::jsonb,                                                                                                    true, true, NOW())
ON CONFLICT ("nombre") DO NOTHING;

-- 2) Usuarios iniciales (hash scrypt "salt:hash")
INSERT INTO "usuarios" ("nombre", "email", "password_hash", "must_change_password", "rol_id", "two_factor_enabled", "activo", "updated_at")
VALUES
  ('admin',       'admin@sistema.local',       'a98390c2e44602fddf5133ccd16efafc:e959ddc4f97d60ae3a30ef4f413f63b437918a44c7058e8cc90f1741ad49749e', true, (SELECT "id" FROM "roles" WHERE "nombre" = 'ADMIN'),       false, true, NOW()),
  ('colaborador', 'colaborador@sistema.local', 'eb56355ebdf4d79672ae173fed703cb3:8b3aad7ae02cb7657b1370ec640330d38ca5a6b690242912c2ec2ed977d23665', true, (SELECT "id" FROM "roles" WHERE "nombre" = 'COLABORADOR'), false, true, NOW())
ON CONFLICT ("nombre") DO NOTHING;

-- 3) Marcas (precio por defecto en S/.)
INSERT INTO "marcas" ("nombre", "precioDefecto", "activo")
VALUES
  ('Solgas',   45.00, true),
  ('Lima Gas', 45.00, true),
  ('Repsol',   48.00, true),
  ('Zeta Gas', 44.00, true),
  ('Primax',   46.00, true)
ON CONFLICT ("nombre") DO NOTHING;

-- 4) Repartidores
INSERT INTO "repartidores" ("nombre", "activo")
VALUES
  ('Adolfo', true),
  ('David', true),
  ('Michael', true),
  ('Jose', true)
ON CONFLICT ("nombre") DO NOTHING;

-- 5) Configuración por defecto
INSERT INTO "config" ("clave", "valor", "updated_at")
VALUES
  ('nombre_negocio', 'Distribuidora de Gas', NOW()),
  ('telefono_negocio', '', NOW()),
  ('direccion_negocio', '', NOW()),
  ('yape_numero', '', NOW()),
  ('yape_titular', '', NOW()),
  ('telegram_bot_token', '', NOW()),
  ('telegram_chat_id', '', NOW()),
  ('sonido_yape', '1', NOW()),
  ('imap_enabled', '0', NOW()),
  ('imap_host', '', NOW()),
  ('imap_port', '993', NOW()),
  ('imap_user', '', NOW()),
  ('imap_pass', '', NOW()),
  ('imap_folder', 'INBOX', NOW())
ON CONFLICT ("clave") DO NOTHING;
