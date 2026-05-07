-- AlterTable: nome do template Meta denormalizado em mensagem_whatsapp para UI
ALTER TABLE "cobranca"."mensagem_whatsapp" ADD COLUMN "templateMetaNome" TEXT;

-- Backfill: para mensagens existentes com templateMetaId, copiar o name do template_meta
UPDATE "cobranca"."mensagem_whatsapp" m
SET "templateMetaNome" = t."name"
FROM "cobranca"."template_meta" t
WHERE m."templateMetaId" = t."id" AND m."templateMetaNome" IS NULL;
