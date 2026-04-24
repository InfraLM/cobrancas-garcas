-- CreateTable
CREATE TABLE "template_blip" (
    "id" TEXT NOT NULL,
    "nomeBlip" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "conteudoPreview" TEXT NOT NULL,
    "variaveis" JSONB NOT NULL,
    "categoria" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPor" INTEGER NOT NULL,
    "criadoPorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_blip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regua_cobranca" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "horarioPadrao" TEXT NOT NULL DEFAULT '09:00',
    "intervaloDisparoSeg" INTEGER NOT NULL DEFAULT 2,
    "criadoPor" INTEGER NOT NULL,
    "criadoPorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "ultimaExecucao" TIMESTAMP(3),

    CONSTRAINT "regua_cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapa_regua" (
    "id" TEXT NOT NULL,
    "reguaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "diasRelativoVenc" INTEGER NOT NULL,
    "horario" TEXT,
    "templateBlipId" TEXT NOT NULL,
    "filtroRecorrencia" TEXT NOT NULL DEFAULT 'QUALQUER',
    "filtroSituacao" TEXT NOT NULL DEFAULT 'AR',
    "tiposOrigem" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "segmentacaoId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etapa_regua_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disparo_mensagem" (
    "id" TEXT NOT NULL,
    "reguaId" TEXT,
    "etapaReguaId" TEXT,
    "templateBlipId" TEXT NOT NULL,
    "templateNomeBlip" TEXT NOT NULL,
    "pessoaCodigo" INTEGER NOT NULL,
    "pessoaNome" TEXT NOT NULL,
    "contaReceberCodigo" INTEGER,
    "telefone" TEXT NOT NULL,
    "parametros" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "blipMessageId" TEXT,
    "erroMensagem" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'REGUA_AUTO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disparadoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "convertido" BOOLEAN NOT NULL DEFAULT false,
    "convertidoEm" TIMESTAMP(3),
    "diasAteConversao" INTEGER,

    CONSTRAINT "disparo_mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "template_blip_nomeBlip_key" ON "template_blip"("nomeBlip");

-- CreateIndex
CREATE INDEX "template_blip_categoria_ativo_idx" ON "template_blip"("categoria", "ativo");

-- CreateIndex
CREATE INDEX "regua_cobranca_ativo_idx" ON "regua_cobranca"("ativo");

-- CreateIndex
CREATE INDEX "etapa_regua_reguaId_ativo_idx" ON "etapa_regua"("reguaId", "ativo");

-- CreateIndex
CREATE INDEX "etapa_regua_templateBlipId_idx" ON "etapa_regua"("templateBlipId");

-- CreateIndex
CREATE INDEX "disparo_mensagem_status_criadoEm_idx" ON "disparo_mensagem"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "disparo_mensagem_reguaId_disparadoEm_idx" ON "disparo_mensagem"("reguaId", "disparadoEm");

-- CreateIndex
CREATE INDEX "disparo_mensagem_pessoaCodigo_idx" ON "disparo_mensagem"("pessoaCodigo");

-- CreateIndex
CREATE INDEX "disparo_mensagem_templateBlipId_idx" ON "disparo_mensagem"("templateBlipId");

-- CreateIndex
CREATE UNIQUE INDEX "disparo_mensagem_etapaReguaId_pessoaCodigo_contaReceberCodi_key" ON "disparo_mensagem"("etapaReguaId", "pessoaCodigo", "contaReceberCodigo");

-- AddForeignKey
ALTER TABLE "etapa_regua" ADD CONSTRAINT "etapa_regua_reguaId_fkey" FOREIGN KEY ("reguaId") REFERENCES "regua_cobranca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapa_regua" ADD CONSTRAINT "etapa_regua_templateBlipId_fkey" FOREIGN KEY ("templateBlipId") REFERENCES "template_blip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

