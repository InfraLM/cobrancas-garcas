-- Soft-delete para InstanciaWhatsappUser
-- Motivacao: mensagens em mensagem_whatsapp e conversa_cobranca usam instanciaId
-- como FK logica (sem constraint). Hard-delete cria orfas que ficam invisiveis na
-- whitelist mas continuam no banco — pode subestimar tentativas/contatos no funil.

ALTER TABLE "cobranca"."instancia_whatsapp_user" ADD COLUMN "removidoEm" TIMESTAMP(3);

CREATE INDEX "instancia_whatsapp_user_removidoEm_idx" ON "cobranca"."instancia_whatsapp_user"("removidoEm");
