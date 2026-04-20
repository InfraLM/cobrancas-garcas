-- CreateTable
CREATE TABLE "acordo_financeiro" (
    "id" TEXT NOT NULL,
    "pessoaCodigo" INTEGER NOT NULL,
    "pessoaNome" TEXT NOT NULL,
    "pessoaCpf" TEXT NOT NULL,
    "matricula" TEXT,
    "turmaIdentificador" TEXT,
    "cursoNome" TEXT,
    "celularAluno" TEXT,
    "emailAluno" TEXT,
    "etapa" TEXT NOT NULL DEFAULT 'SELECAO',
    "valorOriginal" DECIMAL(12,2) NOT NULL,
    "valorMultaJuros" DECIMAL(12,2) NOT NULL,
    "valorDescontos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorRecebidoPrevio" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorSaldoDevedor" DECIMAL(12,2) NOT NULL,
    "descontoAcordo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descontoAcordoPercentual" DECIMAL(5,2),
    "valorAcordo" DECIMAL(12,2) NOT NULL,
    "vincularRecorrencia" BOOLEAN NOT NULL DEFAULT false,
    "asaasCustomerId" TEXT,
    "clicksignEnvelopeId" TEXT,
    "clicksignDocumentId" TEXT,
    "clicksignSignerId" TEXT,
    "negociacaoContaReceberCodigo" INTEGER,
    "criadoPor" INTEGER NOT NULL,
    "criadoPorNome" TEXT NOT NULL,
    "observacao" TEXT,
    "motivoCancelamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "termoEnviadoEm" TIMESTAMP(3),
    "termoAssinadoEm" TIMESTAMP(3),
    "acordoGeradoEm" TIMESTAMP(3),
    "seiVinculadoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),

    CONSTRAINT "acordo_financeiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcela_original_acordo" (
    "id" TEXT NOT NULL,
    "acordoId" TEXT NOT NULL,
    "contaReceberCodigo" INTEGER NOT NULL,
    "parcela" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "multa" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "juro" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descontos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorRecebido" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldoDevedor" DECIMAL(12,2) NOT NULL,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "tipoOrigem" TEXT,

    CONSTRAINT "parcela_original_acordo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamento_acordo" (
    "id" TEXT NOT NULL,
    "acordoId" TEXT NOT NULL,
    "numeroPagamento" INTEGER NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "formaPagamento" TEXT NOT NULL,
    "parcelas" INTEGER NOT NULL DEFAULT 1,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT,
    "situacao" TEXT NOT NULL DEFAULT 'PENDENTE',
    "asaasPaymentId" TEXT,
    "asaasInstallmentId" TEXT,
    "asaasInvoiceUrl" TEXT,
    "asaasPixQrCode" TEXT,
    "asaasBankSlipUrl" TEXT,
    "dataPagamento" TIMESTAMP(3),
    "valorPago" DECIMAL(12,2),
    "valorLiquido" DECIMAL(12,2),
    "taxaAsaas" DECIMAL(12,2),

    CONSTRAINT "pagamento_acordo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento" (
    "id" TEXT NOT NULL,
    "acordoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'TERMO_ACORDO',
    "clicksignDocumentKey" TEXT,
    "clicksignEnvelopeId" TEXT,
    "situacao" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "urlOriginal" TEXT,
    "urlAssinado" TEXT,
    "signatarios" JSONB,
    "enviadoEm" TIMESTAMP(3),
    "assinadoEm" TIMESTAMP(3),

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "acordo_financeiro_etapa_idx" ON "acordo_financeiro"("etapa");

-- CreateIndex
CREATE INDEX "acordo_financeiro_pessoaCodigo_idx" ON "acordo_financeiro"("pessoaCodigo");

-- CreateIndex
CREATE INDEX "acordo_financeiro_criadoPor_idx" ON "acordo_financeiro"("criadoPor");

-- CreateIndex
CREATE INDEX "parcela_original_acordo_acordoId_idx" ON "parcela_original_acordo"("acordoId");

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_acordo_asaasPaymentId_key" ON "pagamento_acordo"("asaasPaymentId");

-- CreateIndex
CREATE INDEX "pagamento_acordo_acordoId_idx" ON "pagamento_acordo"("acordoId");

-- CreateIndex
CREATE INDEX "pagamento_acordo_situacao_idx" ON "pagamento_acordo"("situacao");

-- CreateIndex
CREATE UNIQUE INDEX "documento_acordoId_key" ON "documento"("acordoId");

-- AddForeignKey
ALTER TABLE "parcela_original_acordo" ADD CONSTRAINT "parcela_original_acordo_acordoId_fkey" FOREIGN KEY ("acordoId") REFERENCES "acordo_financeiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento_acordo" ADD CONSTRAINT "pagamento_acordo_acordoId_fkey" FOREIGN KEY ("acordoId") REFERENCES "acordo_financeiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_acordoId_fkey" FOREIGN KEY ("acordoId") REFERENCES "acordo_financeiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
