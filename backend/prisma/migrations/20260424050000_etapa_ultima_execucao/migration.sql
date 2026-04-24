-- AlterTable
ALTER TABLE "etapa_regua" ADD COLUMN     "ultimaExecucaoEm" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "etapa_regua_ultimaExecucaoEm_idx" ON "etapa_regua"("ultimaExecucaoEm");

