-- Timestamps separados para PAYMENT_CONFIRMED (competencia) vs PAYMENT_RECEIVED (caixa)
-- e flag de captura de cartao parcelado.
--
-- Hoje os 2 eventos do Asaas caem no mesmo case do webhook handler e ambos
-- viram situacao='CONFIRMADO'. Sem distincao, o toggle "Competencia vs Caixa"
-- do card "Recuperado por Forma" mostra a mesma coisa em ambos.
--
-- Para cartao parcelado, Asaas captura o limite todo na 1a parcela mas envia
-- webhook PAYMENT_CONFIRMED de cada parcela ao longo dos meses. A flag
-- creditCardCaptured indica que o limite ja foi autorizado e que todas as
-- parcelas devem ser tratadas como pagas (do ponto de vista de competencia).

ALTER TABLE "cobranca"."pagamento_acordo"
  ADD COLUMN "confirmadoEm" TIMESTAMP(3),
  ADD COLUMN "recebidoEm" TIMESTAMP(3),
  ADD COLUMN "creditCardCaptured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "creditCardCapturedAt" TIMESTAMP(3);

CREATE INDEX "pagamento_acordo_confirmadoEm_idx" ON "cobranca"."pagamento_acordo"("confirmadoEm");
CREATE INDEX "pagamento_acordo_recebidoEm_idx" ON "cobranca"."pagamento_acordo"("recebidoEm");
CREATE INDEX "pagamento_acordo_creditCardCaptured_idx" ON "cobranca"."pagamento_acordo"("creditCardCaptured");

-- Backfill: tudo que esta CONFIRMADO hoje vira confirmado E recebido
-- (no historico nao temos como distinguir a defasagem real entre os 2 eventos).
UPDATE "cobranca"."pagamento_acordo"
SET "confirmadoEm" = COALESCE("dataPagamento", NOW()),
    "recebidoEm" = COALESCE("dataPagamento", NOW())
WHERE situacao = 'CONFIRMADO';

-- Backfill: cartao parcelado com pelo menos 1 confirmado ja era capturado
UPDATE "cobranca"."pagamento_acordo" pa
SET "creditCardCaptured" = true,
    "creditCardCapturedAt" = COALESCE(pa."dataPagamento", NOW())
WHERE pa."formaPagamento" = 'CREDIT_CARD'
  AND pa.parcelas > 1
  AND EXISTS (
    SELECT 1 FROM "cobranca"."pagamento_acordo" pa2
    WHERE pa2."acordoId" = pa."acordoId" AND pa2.situacao = 'CONFIRMADO'
  );
