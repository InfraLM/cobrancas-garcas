-- AlterTable: adiciona instanciaTipo em conversa_cobranca para distinguir whatsapp-3c vs waba
ALTER TABLE "cobranca"."conversa_cobranca" ADD COLUMN "instanciaTipo" TEXT;

-- Backfill: para conversas existentes, marcar como whatsapp-3c (canal antigo).
-- Quando entrar mensagem WABA nova, handler atualiza para 'waba'.
UPDATE "cobranca"."conversa_cobranca" SET "instanciaTipo" = 'whatsapp-3c' WHERE "instanciaTipo" IS NULL;
