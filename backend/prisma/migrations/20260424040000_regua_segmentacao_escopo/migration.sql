-- AlterTable
ALTER TABLE "regra_segmentacao" ADD COLUMN     "escopoUso" TEXT NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN     "reguaOwnerId" TEXT;

-- CreateIndex
CREATE INDEX "regra_segmentacao_escopoUso_reguaOwnerId_idx" ON "regra_segmentacao"("escopoUso", "reguaOwnerId");

-- AddForeignKey
ALTER TABLE "regra_segmentacao" ADD CONSTRAINT "regra_segmentacao_reguaOwnerId_fkey" FOREIGN KEY ("reguaOwnerId") REFERENCES "regua_cobranca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

