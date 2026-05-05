-- CreateTable
CREATE TABLE "cobranca"."tag" (
    "id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "descricao" TEXT,
    "cor" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tag_categoria_codigo_key" ON "cobranca"."tag"("categoria", "codigo");

-- CreateIndex
CREATE INDEX "tag_ativo_ordem_idx" ON "cobranca"."tag"("ativo", "ordem");

-- CreateTable
CREATE TABLE "cobranca"."aluno_tag" (
    "id" TEXT NOT NULL,
    "pessoaCodigo" INTEGER NOT NULL,
    "tagId" TEXT NOT NULL,
    "observacao" TEXT,
    "origemConversaId" TEXT,
    "origemAcordoId" TEXT,
    "criadoPor" INTEGER NOT NULL,
    "criadoPorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removidoEm" TIMESTAMP(3),
    "removidoPor" INTEGER,
    "removidoPorNome" TEXT,

    CONSTRAINT "aluno_tag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aluno_tag_pessoaCodigo_removidoEm_idx" ON "cobranca"."aluno_tag"("pessoaCodigo", "removidoEm");

-- CreateIndex
CREATE INDEX "aluno_tag_tagId_criadoEm_idx" ON "cobranca"."aluno_tag"("tagId", "criadoEm");

-- AddForeignKey
ALTER TABLE "cobranca"."aluno_tag" ADD CONSTRAINT "aluno_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "cobranca"."tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: tracking de template em mensagem_whatsapp
ALTER TABLE "cobranca"."mensagem_whatsapp" ADD COLUMN "templateWhatsappId" INTEGER;

-- CreateIndex
CREATE INDEX "mensagem_whatsapp_templateWhatsappId_timestamp_idx" ON "cobranca"."mensagem_whatsapp"("templateWhatsappId", "timestamp");
