-- AlterTable
ALTER TABLE "regra_segmentacao" ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'ALUNO',
ADD COLUMN     "totalTitulos" INTEGER;

-- AlterTable
ALTER TABLE "template_blip" ADD COLUMN     "escopo" TEXT NOT NULL DEFAULT 'AMBOS';

