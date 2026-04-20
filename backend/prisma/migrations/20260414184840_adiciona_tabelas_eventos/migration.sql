-- CreateTable
CREATE TABLE "mensagem_whatsapp" (
    "id" TEXT NOT NULL,
    "mensagemExternaId" TEXT NOT NULL,
    "chatId" INTEGER NOT NULL,
    "contatoNumero" TEXT NOT NULL,
    "contatoNome" TEXT,
    "contatoImagem" TEXT,
    "instanciaId" TEXT NOT NULL,
    "instanciaNome" TEXT,
    "pessoaCodigo" INTEGER,
    "tipo" TEXT NOT NULL,
    "corpo" TEXT,
    "mediaUrl" TEXT,
    "mediaNome" TEXT,
    "transcricaoAudio" TEXT,
    "fromMe" BOOLEAN NOT NULL,
    "de" TEXT NOT NULL,
    "para" TEXT NOT NULL,
    "agenteId" INTEGER,
    "agenteNome" TEXT,
    "mensagemCitadaId" TEXT,
    "mensagemCitadaCorpo" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagem_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_ligacao" (
    "id" TEXT NOT NULL,
    "telephonyId" TEXT NOT NULL,
    "callId" TEXT,
    "campanhaId" INTEGER,
    "campanhaNome" TEXT,
    "modo" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "pessoaCodigo" INTEGER,
    "pessoaNome" TEXT,
    "mailingId" TEXT,
    "agenteId" INTEGER,
    "agenteNome" TEXT,
    "dataHoraChamada" TIMESTAMP(3) NOT NULL,
    "dataHoraAtendida" TIMESTAMP(3),
    "dataHoraConectada" TIMESTAMP(3),
    "dataHoraDesligada" TIMESTAMP(3),
    "tempoTotal" INTEGER,
    "tempoEspera" INTEGER,
    "tempoFalando" INTEGER,
    "tempoComAgente" INTEGER,
    "tempoAcw" INTEGER,
    "status" INTEGER NOT NULL,
    "statusTexto" TEXT,
    "qualificacaoId" INTEGER,
    "qualificacaoNome" TEXT,
    "qualificacaoPositiva" BOOLEAN,
    "conversao" BOOLEAN,
    "hangupCause" INTEGER,
    "hangupCauseTexto" TEXT,
    "gravada" BOOLEAN NOT NULL DEFAULT false,
    "gravacaoUrl" TEXT,
    "transcricao" TEXT,
    "encerradaPeloAgente" BOOLEAN,
    "amdStatus" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_ligacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_ligacao_raw" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "telephonyId" TEXT,
    "telefone" TEXT,
    "agenteId" INTEGER,
    "payload" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_ligacao_raw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_event" (
    "id" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "eventoTipo" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "pessoaCodigo" INTEGER,
    "acordoId" TEXT,
    "payload" JSONB NOT NULL,
    "processado" BOOLEAN NOT NULL DEFAULT false,
    "processadoEm" TIMESTAMP(3),
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocorrencia" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "pessoaCodigo" INTEGER NOT NULL,
    "pessoaNome" TEXT,
    "agenteCodigo" TEXT,
    "agenteNome" TEXT,
    "registroLigacaoId" TEXT,
    "mensagemWhatsappId" TEXT,
    "webhookEventId" TEXT,
    "acordoId" TEXT,
    "metadados" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mensagem_whatsapp_mensagemExternaId_key" ON "mensagem_whatsapp"("mensagemExternaId");

-- CreateIndex
CREATE INDEX "mensagem_whatsapp_contatoNumero_timestamp_idx" ON "mensagem_whatsapp"("contatoNumero", "timestamp");

-- CreateIndex
CREATE INDEX "mensagem_whatsapp_pessoaCodigo_timestamp_idx" ON "mensagem_whatsapp"("pessoaCodigo", "timestamp");

-- CreateIndex
CREATE INDEX "mensagem_whatsapp_chatId_timestamp_idx" ON "mensagem_whatsapp"("chatId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "registro_ligacao_telephonyId_key" ON "registro_ligacao"("telephonyId");

-- CreateIndex
CREATE INDEX "registro_ligacao_pessoaCodigo_dataHoraChamada_idx" ON "registro_ligacao"("pessoaCodigo", "dataHoraChamada");

-- CreateIndex
CREATE INDEX "registro_ligacao_telefone_dataHoraChamada_idx" ON "registro_ligacao"("telefone", "dataHoraChamada");

-- CreateIndex
CREATE INDEX "registro_ligacao_agenteId_dataHoraChamada_idx" ON "registro_ligacao"("agenteId", "dataHoraChamada");

-- CreateIndex
CREATE INDEX "evento_ligacao_raw_telephonyId_idx" ON "evento_ligacao_raw"("telephonyId");

-- CreateIndex
CREATE INDEX "evento_ligacao_raw_tipo_criadoEm_idx" ON "evento_ligacao_raw"("tipo", "criadoEm");

-- CreateIndex
CREATE INDEX "webhook_event_processado_criadoEm_idx" ON "webhook_event"("processado", "criadoEm");

-- CreateIndex
CREATE INDEX "webhook_event_pessoaCodigo_idx" ON "webhook_event"("pessoaCodigo");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_event_origem_eventoId_key" ON "webhook_event"("origem", "eventoId");

-- CreateIndex
CREATE INDEX "ocorrencia_pessoaCodigo_criadoEm_idx" ON "ocorrencia"("pessoaCodigo", "criadoEm");

-- CreateIndex
CREATE INDEX "ocorrencia_tipo_criadoEm_idx" ON "ocorrencia"("tipo", "criadoEm");

-- CreateIndex
CREATE INDEX "ocorrencia_agenteCodigo_criadoEm_idx" ON "ocorrencia"("agenteCodigo", "criadoEm");
