# Workflow de Negociação: Liberdade Médica CRM & Billing

O workflow de negociação é o coração do sistema de cobrança. Ele orquestra a transição de uma dívida em atraso para um novo acordo financeiro, integrando o banco de dados acadêmico (SEI), o gateway de pagamentos (Asaas) e a plataforma de assinaturas (ClickSign).

## Premissa Arquitetural Crítica: SEI como Fonte de Verdade Read-Only

**Não realizamos operações de escrita no banco de dados do SEI.** O SEI é o sistema acadêmico oficial e tudo o que temos dele é espelhado via sincronização (pull/get).

- O nosso sistema não cria negociações no SEI.
- O nosso sistema não insere documentos assinados no SEI.
- O nosso sistema não altera o status das parcelas no SEI.

Todas as ações que exigem mudança no SEI são feitas **manualmente pelo agente no próprio sistema SEI**. O nosso CRM atua como camada de orquestração, comunicação (WhatsApp/3C Plus), assinatura (ClickSign) e cobrança (Asaas), vinculando-se aos dados do SEI através de códigos de referência.

## Etapas do Kanban

### Fase 1: Negociação Criada
- Operador seleciona parcelas em atraso (contareceber, situacao=AR, vencida)
- Sistema calcula valor atualizado (valor + multa + juro - descontos - valorrecebido)
- Operador define método de pagamento e número de parcelas
- Dados salvos como rascunho (AcordoFinanceiro, etapa=SELECAO)

### Fase 2: Envio para Assinatura
- Sistema gera Termo de Negociação em PDF
- Envio ao aluno via ClickSign para assinatura digital
- Status atualizado para AGUARDANDO_ASSINATURA
- Documento armazenado no Repositório do CRM

### Fase 3: Criar Cobrança
- Após assinatura confirmada (webhook ClickSign)
- Sistema cria cobranças no Asaas (POST /v3/payments)
- Armazena IDs, URLs de boleto/PIX, links de pagamento

### Fase 4: Vinculação (Ação Manual no SEI)
1. Agente acessa o SEI e cria a negociação manualmente
2. SEI gera código único (negociacaocontareceber.codigo)
3. Agente informa o código no CRM
4. Sistema vincula cobranças Asaas + contrato ClickSign ao código SEI
5. Após sync, parcelas originais ficam NE e novas ficam NCR

### Fase 5: Checando Cobrança
- Aguardando webhooks do Asaas (PAYMENT_RECEIVED, PAYMENT_CONFIRMED)
- Cada pagamento confirmado atualiza a ParcelaAcordo
- Se múltiplas parcelas, marca cada uma individualmente

### Fase 6: Concluído
- Todas as parcelas confirmadas
- Baixa no SEI feita manualmente pelo agente
- Card movido para Concluído

## Tabelas do CRM (schema cobranca)

### acordo_financeiro
Gerencia o pipeline/kanban. Campos principais:
- pessoaCodigo, pessoaNome, pessoaCpf, matricula (vínculo SEI)
- etapa (SELECAO → ACORDO_GERADO → TERMO_ENVIADO → TERMO_ASSINADO → SEI_VINCULADO → PAGO)
- valorOriginal, valorMultaJuros, valorDescontos, valorSaldoDevedor, descontoAcordo, valorAcordo
- numeroParcelas
- asaasCustomerId, clicksignEnvelopeId
- negociacaoContaReceberCodigo (vínculo SEI, preenchido na Fase 4)
- criadoPor (agente), timestamps por etapa

### parcela_original_acordo
Espelha contarecebernegociado do SEI. Snapshot das parcelas originais selecionadas.
- acordoId, contaReceberCodigo
- valor, multa, juro, descontos, valorRecebido, saldoDevedor, dataVencimento, tipoOrigem

### parcela_acordo
Cada cobrança gerada no Asaas.
- acordoId, numeroParcela, valor, dataVencimento
- situacao (PENDENTE, CONFIRMADO, VENCIDO, CANCELADO)
- asaasPaymentId (unique), asaasBillingType, asaasInvoiceUrl, asaasPixQrCode
- dataPagamento, valorPago, formaPagamento

### webhook_event
Log imutável de webhooks recebidos.
- origem (ASAAS, CLICKSIGN), eventoTipo, eventoId, payload (JSON)
- acordoId, processado, processamantoErro
- @@unique([origem, eventoId]) para idempotência

### documento
Contratos e termos via ClickSign.
- acordoId, tipo (TERMO_ACORDO, ADITIVO)
- clicksignDocumentKey, clicksignEnvelopeId
- situacao (RASCUNHO, ENVIADO, ASSINADO, RECUSADO, EXPIRADO)
- urlOriginal, urlAssinado, signatarios (JSON)

## Integrações

### Asaas
- POST /v3/customers — criar/buscar cliente (cpfCnpj, name, email, mobilePhone)
- POST /v3/payments — criar cobrança (customer, billingType, value, dueDate, externalReference)
- GET /v3/payments/{id}/pixQrCode — QR Code PIX
- GET /v3/payments/{id}/identificationField — linha digitável boleto
- Webhook PAYMENT_RECEIVED/PAYMENT_CONFIRMED — confirmar pagamento

### ClickSign
- POST /api/v3/envelopes — criar envelope
- POST /api/v3/envelopes/{id}/documents — adicionar PDF
- POST /api/v3/envelopes/{id}/signers — adicionar signatário (apenas aluno)
- POST /api/v3/envelopes/{id}/requirements — criar requisito de assinatura
- PATCH /api/v3/envelopes/{id} — ativar (status: running)
- Webhook document_closed — confirmar assinatura

### SEI (Read-Only)
- contareceber (situacao=AR, vencida) — fonte das parcelas
- negociacaocontareceber.codigo — vínculo manual
- contareceber.codorigem — liga NCR à negociação
- contarecebernegociado — parcelas originais da negociação
