-- CreateTable
CREATE TABLE "cadastro_recorrencia" (
    "id" TEXT NOT NULL,
    "pessoaCodigo" INTEGER NOT NULL,
    "pessoaNome" TEXT NOT NULL,
    "pessoaCpf" TEXT NOT NULL,
    "matricula" TEXT,
    "celularAluno" TEXT,
    "etapa" TEXT NOT NULL DEFAULT 'PENDENTE',
    "origem" TEXT NOT NULL,
    "metodo" TEXT,
    "acordoId" TEXT,
    "contaReceberCodigo" INTEGER,
    "parcelaPaga" BOOLEAN NOT NULL DEFAULT false,
    "recorrenciaAtivada" BOOLEAN NOT NULL DEFAULT false,
    "cartaoDetectadoCodigo" INTEGER,
    "dataLimite" TIMESTAMP(3),
    "criadoPor" INTEGER NOT NULL,
    "criadoPorNome" TEXT NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "concluidoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),

    CONSTRAINT "cadastro_recorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cadastro_recorrencia_etapa_idx" ON "cadastro_recorrencia"("etapa");

-- CreateIndex
CREATE INDEX "cadastro_recorrencia_pessoaCodigo_idx" ON "cadastro_recorrencia"("pessoaCodigo");
