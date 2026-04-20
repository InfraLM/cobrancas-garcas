-- CreateTable
CREATE TABLE "ficou_facil" (
    "id" TEXT NOT NULL,
    "pessoaCodigo" INTEGER NOT NULL,
    "pessoaNome" TEXT NOT NULL,
    "pessoaCpf" TEXT NOT NULL,
    "matricula" TEXT,
    "turma" TEXT,
    "celularAluno" TEXT,
    "etapa" TEXT NOT NULL DEFAULT 'AGUARDANDO_DOCUMENTACAO',
    "valorPos" DECIMAL(12,2) NOT NULL,
    "valorRecebido" DECIMAL(12,2) NOT NULL,
    "valorInadimplente" DECIMAL(12,2) NOT NULL,
    "valorInadimplenteMJ" DECIMAL(12,2) NOT NULL,
    "contaSantander" BOOLEAN NOT NULL DEFAULT false,
    "checkboxes" JSONB NOT NULL DEFAULT '{}',
    "creditoAprovado" BOOLEAN,
    "creditoObservacao" TEXT,
    "criadoPor" INTEGER NOT NULL,
    "criadoPorNome" TEXT NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "concluidoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),

    CONSTRAINT "ficou_facil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_ficou_facil" (
    "id" TEXT NOT NULL,
    "ficouFacilId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "arquivo" BYTEA NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_ficou_facil_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ficou_facil_etapa_idx" ON "ficou_facil"("etapa");

-- CreateIndex
CREATE INDEX "ficou_facil_pessoaCodigo_idx" ON "ficou_facil"("pessoaCodigo");

-- CreateIndex
CREATE INDEX "documento_ficou_facil_ficouFacilId_idx" ON "documento_ficou_facil"("ficouFacilId");

-- AddForeignKey
ALTER TABLE "documento_ficou_facil" ADD CONSTRAINT "documento_ficou_facil_ficouFacilId_fkey" FOREIGN KEY ("ficouFacilId") REFERENCES "ficou_facil"("id") ON DELETE CASCADE ON UPDATE CASCADE;
