-- CreateTable
CREATE TABLE "cobranca"."template_meta" (
    "id" TEXT NOT NULL,
    "metaTemplateId" TEXT,
    "metaWabaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'pt_BR',
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rejectReason" TEXT,
    "qualityRating" TEXT,
    "components" JSONB NOT NULL,
    "variaveisMap" JSONB,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPor" INTEGER NOT NULL DEFAULT 0,
    "criadoPorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "submetidoEm" TIMESTAMP(3),
    "aprovadoEm" TIMESTAMP(3),

    CONSTRAINT "template_meta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "template_meta_metaTemplateId_key" ON "cobranca"."template_meta"("metaTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "template_meta_metaWabaId_name_language_key" ON "cobranca"."template_meta"("metaWabaId", "name", "language");

-- CreateIndex
CREATE INDEX "template_meta_status_ativo_idx" ON "cobranca"."template_meta"("status", "ativo");

-- CreateIndex
CREATE INDEX "template_meta_category_status_idx" ON "cobranca"."template_meta"("category", "status");

-- CreateTable
CREATE TABLE "cobranca"."meta_webhook_event" (
    "id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processado" BOOLEAN NOT NULL DEFAULT false,
    "erro" TEXT,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_webhook_event_field_recebidoEm_idx" ON "cobranca"."meta_webhook_event"("field", "recebidoEm");

-- CreateIndex
CREATE INDEX "meta_webhook_event_processado_recebidoEm_idx" ON "cobranca"."meta_webhook_event"("processado", "recebidoEm");

-- AlterTable: tracking de template Meta em mensagem_whatsapp
ALTER TABLE "cobranca"."mensagem_whatsapp" ADD COLUMN "templateMetaId" TEXT;

-- CreateIndex
CREATE INDEX "mensagem_whatsapp_templateMetaId_timestamp_idx" ON "cobranca"."mensagem_whatsapp"("templateMetaId", "timestamp");
