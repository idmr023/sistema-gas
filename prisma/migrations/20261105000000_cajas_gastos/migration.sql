-- CreateEnum
CREATE TYPE "EstadoCaja" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoGasto" AS ENUM ('ALMUERZO', 'TRANSPORTE', 'MANTENIMIENTO', 'OTRO');

-- CreateTable
CREATE TABLE "cajas" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "monto_apertura" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monto_cierre" DECIMAL(10,2),
    "notas" TEXT,
    "estado" "EstadoCaja" NOT NULL DEFAULT 'ABIERTA',
    "usuario_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cajas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "caja_id" INTEGER NOT NULL,
    "tipo" "TipoGasto" NOT NULL DEFAULT 'ALMUERZO',
    "monto" DECIMAL(10,2) NOT NULL,
    "colaboradores" TEXT,
    "descripcion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cajas_fecha_idx" ON "cajas"("fecha");
CREATE UNIQUE INDEX "cajas_fecha_key" ON "cajas"("fecha");

-- CreateIndex
CREATE INDEX "gastos_fecha_idx" ON "gastos"("fecha");
CREATE INDEX "gastos_caja_id_idx" ON "gastos"("caja_id");
CREATE INDEX "gastos_tipo_idx" ON "gastos"("tipo");

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "cajas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
