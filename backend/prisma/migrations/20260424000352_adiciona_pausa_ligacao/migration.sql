-- CreateTable
CREATE TABLE "pausa_ligacao" (
    "id" TEXT NOT NULL,
    "pessoaCodigo" INTEGER NOT NULL,
    "pessoaNome" TEXT,
    "motivo" TEXT NOT NULL,
    "observacao" TEXT,
    "origem" TEXT NOT NULL,
    "acordoId" TEXT,
    "pausadoPor" INTEGER NOT NULL,
    "pausadoPorNome" TEXT,
    "pausadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausaAte" TIMESTAMP(3),
    "removidoEm" TIMESTAMP(3),
    "removidoPor" INTEGER,
    "removidoPorNome" TEXT,
    "motivoRemocao" TEXT,

    CONSTRAINT "pausa_ligacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pausa_ligacao_pessoaCodigo_removidoEm_idx" ON "pausa_ligacao"("pessoaCodigo", "removidoEm");

-- CreateIndex
CREATE INDEX "pausa_ligacao_acordoId_idx" ON "pausa_ligacao"("acordoId");

-- CreateIndex
CREATE INDEX "pausa_ligacao_pausaAte_idx" ON "pausa_ligacao"("pausaAte");
