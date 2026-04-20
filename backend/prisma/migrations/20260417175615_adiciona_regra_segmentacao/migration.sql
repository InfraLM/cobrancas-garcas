-- DropIndex
DROP INDEX "idx_contareceber_matriculaaluno";

-- DropIndex
DROP INDEX "idx_contareceber_pessoa_sit";

-- DropIndex
DROP INDEX "idx_contareceber_turma";

-- DropIndex
DROP INDEX "idx_matricula_aluno_curso";

-- CreateTable
CREATE TABLE "regra_segmentacao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "condicoes" JSONB NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoPor" INTEGER NOT NULL,
    "criadoPorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "ultimaExecucao" TIMESTAMP(3),
    "totalAlunos" INTEGER,
    "valorInadimplente" DECIMAL(12,2),

    CONSTRAINT "regra_segmentacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "regra_segmentacao_ativa_idx" ON "regra_segmentacao"("ativa");
