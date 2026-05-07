-- AlterTable: instanciaTipo em mensagem_whatsapp para distinguir whatsapp-3c vs waba na UI
ALTER TABLE "cobranca"."mensagem_whatsapp" ADD COLUMN "instanciaTipo" TEXT;

-- Backfill: derivar de conversa_cobranca via chatId (mais preciso) ou marcar como whatsapp-3c
UPDATE "cobranca"."mensagem_whatsapp" m
SET "instanciaTipo" = COALESCE(
  (SELECT c."instanciaTipo" FROM "cobranca"."conversa_cobranca" c
   WHERE c."chatId" = m."chatId"::text LIMIT 1),
  'whatsapp-3c'
)
WHERE m."instanciaTipo" IS NULL;
