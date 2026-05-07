-- AlterTable: tipo da instancia (whatsapp-3c | waba) para o seletor de canal na conversa
ALTER TABLE "cobranca"."instancia_whatsapp_user" ADD COLUMN "tipo" TEXT;

-- Backfill heuristico: instancia com tipo conhecido em conversa_cobranca herda dali.
-- Se não houver, deixar NULL (frontend trata como 'whatsapp-3c' por compatibilidade).
UPDATE "cobranca"."instancia_whatsapp_user" iwu
SET "tipo" = sub."instanciaTipo"
FROM (
  SELECT DISTINCT ON ("instanciaId") "instanciaId", "instanciaTipo"
  FROM "cobranca"."conversa_cobranca"
  WHERE "instanciaTipo" IS NOT NULL
  ORDER BY "instanciaId", "ultimaAtividadeEm" DESC NULLS LAST
) sub
WHERE iwu."instanciaId" = sub."instanciaId" AND iwu."tipo" IS NULL;
