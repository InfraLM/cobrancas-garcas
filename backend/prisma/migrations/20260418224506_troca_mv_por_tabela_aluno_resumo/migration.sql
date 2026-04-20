-- CreateTable
CREATE TABLE "aluno_resumo" (
    "codigo" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "celular" TEXT,
    "matricula" TEXT,
    "matSituacao" TEXT,
    "naoEnviarMsg" BOOLEAN NOT NULL DEFAULT false,
    "situacao" TEXT NOT NULL,
    "valorDevedor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "parcelasAtraso" INTEGER NOT NULL DEFAULT 0,
    "valorPago" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "situacaoFinanceira" TEXT NOT NULL,
    "turma" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aluno_resumo_pkey" PRIMARY KEY ("codigo")
);

-- CreateIndex
CREATE INDEX "aluno_resumo_situacao_idx" ON "aluno_resumo"("situacao");

-- CreateIndex
CREATE INDEX "aluno_resumo_situacaoFinanceira_idx" ON "aluno_resumo"("situacaoFinanceira");

-- CreateIndex
CREATE INDEX "aluno_resumo_nome_idx" ON "aluno_resumo"("nome");
