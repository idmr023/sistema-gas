-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "email" TEXT;

-- Backfill: los usuarios existentes reciben un correo derivado de su nombre
-- (nombre es UNIQUE, así que el correo resultante también lo es)
UPDATE "usuarios" SET "email" = "nombre" || '@sistema.local';

-- Columna obligatoria + única
ALTER TABLE "usuarios" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
