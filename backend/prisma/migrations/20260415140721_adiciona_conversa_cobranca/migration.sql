-- CreateTable
CREATE TABLE "conversa_cobranca" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "contatoNumero" TEXT NOT NULL,
    "contatoNome" TEXT,
    "contatoImagem" TEXT,
    "pessoaCodigo" INTEGER,
    "matricula" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO',
    "motivoEncerramento" TEXT,
    "observacaoEncerramento" TEXT,
    "agenteId" INTEGER,
    "agenteNome" TEXT,
    "assumidoEm" TIMESTAMP(3),
    "valorInadimplente" DECIMAL(12,2),
    "diasAtraso" INTEGER,
    "serasaAtivo" BOOLEAN NOT NULL DEFAULT false,
    "temAcordoAtivo" BOOLEAN NOT NULL DEFAULT false,
    "acordoId" TEXT,
    "prioridadeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prioridadeFaixa" TEXT NOT NULL DEFAULT 'BAIXA',
    "ultimaMensagemCliente" TIMESTAMP(3),
    "ultimaMensagemAgente" TIMESTAMP(3),
    "aguardandoRespostaDesde" TIMESTAMP(3),
    "reativarEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "encerradoEm" TIMESTAMP(3),

    CONSTRAINT "conversa_cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversa_cobranca_chatId_key" ON "conversa_cobranca"("chatId");

-- CreateIndex
CREATE INDEX "conversa_cobranca_status_ultimaMensagemCliente_idx" ON "conversa_cobranca"("status", "ultimaMensagemCliente" DESC);

-- CreateIndex
CREATE INDEX "conversa_cobranca_agenteId_status_idx" ON "conversa_cobranca"("agenteId", "status");

-- CreateIndex
CREATE INDEX "conversa_cobranca_pessoaCodigo_idx" ON "conversa_cobranca"("pessoaCodigo");

-- CreateIndex
CREATE INDEX "conversa_cobranca_instanciaId_status_idx" ON "conversa_cobranca"("instanciaId", "status");
