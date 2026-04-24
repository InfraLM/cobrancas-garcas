# Backend Backlog

Documento vivo que acumula todas as necessidades de backend identificadas durante a construcao do frontend. Cada vez que uma tela ou funcionalidade for criada no frontend, as demandas de backend sao registradas aqui automaticamente.

> **Regra**: Ao construir qualquer tela no frontend, o Claude DEVE atualizar este arquivo com os requisitos de backend que aquela tela vai exigir.

---

## Como usar este documento

### Categorias de registro

| Tag | Significado |
|-----|-------------|
| `[ROTA]` | Endpoint REST necessario (metodo, path, descricao) |
| `[QUERY]` | Query SQL/Prisma complexa que sera necessaria |
| `[WEBHOOK]` | Webhook que precisa ser recebido ou enviado |
| `[SOCKET]` | Evento Socket.io que precisa ser escutado ou emitido |
| `[WORKER]` | Servico background necessario (cron, daemon, fila) |
| `[MODEL]` | Novo model Prisma ou alteracao no schema |
| `[INTEGRACAO]` | Chamada a API externa (Asaas, 3C Plus, SEI, Blip) |
| `[MIDDLEWARE]` | Middleware necessario (auth, validacao, rate limit) |
| `[SEGURANCA]` | Requisito de seguranca (autenticacao, autorizacao, LGPD) |

### Formato de registro

```markdown
### Nome da Tela / Funcionalidade
**Tela frontend**: `src/pages/NomePage.tsx`
**Data**: YYYY-MM-DD
**Status**: pendente | em desenvolvimento | concluido

- [TAG] Descricao da necessidade
  - Detalhes tecnicos, tabelas envolvidas, parametros
  - Dependencias de outras funcionalidades
```

### Prioridades

| Prioridade | Significado |
|------------|-------------|
| P0 | Bloqueante — frontend nao funciona sem isso |
| P1 | Essencial — funcionalidade core depende disso |
| P2 | Importante — melhora a experiencia mas nao bloqueia |
| P3 | Desejavel — pode ser feito depois |

---

## Backlog por Funcionalidade

### Alunos (Listagem + Perfil 360°)
**Tela frontend**: `src/pages/AlunosPage.tsx`
**Data**: 2026-04-10
**Status**: pendente

- [ROTA] GET /api/alunos — listagem paginada com filtros (busca, situação, serasa) — P0
  - Query: JOIN pessoa + matricula + curso + turma
  - Incluir resumo financeiro agregado (parcelas em atraso, valor inadimplente)
  - Incluir flag serasa (JOIN com tabela serasa por CPF)
  - Paginação: offset/limit, ordenação por nome
- [ROTA] GET /api/alunos/:codigo — perfil completo do aluno — P0
  - Dados pessoais: pessoa (nome, cpf, contato, endereço)
  - Acadêmico: matricula + curso + turma + matriculaperiodo
  - Financeiro: contareceber agregado + lista de parcelas
  - Engajamento: pf_alunos (via matricula)
  - Plantões: pf_plantoes (via matricula)
  - Suporte: blip_contacts + blip_tickets (via cpf_sanitizado)
  - Serasa: serasa (via cpf_cnpj_numerico)
- [QUERY] Financeiro agregado por pessoa — P0
  ```sql
  SELECT pessoa, COUNT(*) FILTER (WHERE situacao='AR' AND datavencimento < NOW()) as atraso,
         SUM(CASE WHEN situacao='AR' THEN valor - COALESCE(valorrecebido,0) ELSE 0 END) as valor_aberto
  FROM cobranca.contareceber GROUP BY pessoa
  ```
- [QUERY] Plantões por matrícula — P1
  ```sql
  SELECT matricula, status, COUNT(*) FROM cobranca.pf_plantoes GROUP BY matricula, status
  ```
- [QUERY] Tickets Blip por CPF — P1
  ```sql
  SELECT bc.cpf_sanitizado, COUNT(bt.id), COUNT(bt.id) FILTER (WHERE bt.team ILIKE '%financ%')
  FROM cobranca.blip_contacts bc JOIN cobranca.blip_tickets bt ON ...
  ```
- [QUERY] Serasa por CPF — P1
  ```sql
  SELECT * FROM cobranca.serasa WHERE cpf_cnpj_numerico = REPLACE(REPLACE(pessoa.cpf,'.',''),'-','')
  ```

### Workflow de Negociações (Kanban)
**Tela frontend**: `src/pages/WorkflowNegociacoesPage.tsx`
**Data**: 2026-04-10
**Status**: pendente
**Doc completo**: `docs/workflow-negociacao.md`

#### Models Prisma (schema.prisma)
- [MODEL] AcordoFinanceiro — pipeline/kanban com etapas, valores, vínculos SEI/Asaas/ClickSign — P0
- [MODEL] ParcelaOriginalAcordo — snapshot das parcelas SEI selecionadas (espelha contarecebernegociado) — P0
- [MODEL] ParcelaAcordo — cada cobrança gerada no Asaas com asaasPaymentId unique — P0
- [MODEL] WebhookEvent — log imutável com idempotência (@@unique origem+eventoId) — P0
- [MODEL] Documento — contratos ClickSign com status, URLs, signatários JSON — P0

#### Rotas REST
- [ROTA] GET /api/acordos — listagem paginada com filtros por etapa, agente, aluno — P0
- [ROTA] POST /api/acordos — criar acordo (selecionar parcelas, calcular valores) — P0
- [ROTA] GET /api/acordos/:id — detalhes completos do acordo — P0
- [ROTA] PATCH /api/acordos/:id/etapa — avançar etapa do kanban — P0
- [ROTA] PATCH /api/acordos/:id/vincular-sei — informar código da negociação SEI — P0
- [ROTA] POST /api/acordos/:id/gerar-cobrancas — criar cobranças no Asaas — P0
- [ROTA] POST /api/acordos/:id/enviar-assinatura — enviar termo ao ClickSign — P1
- [ROTA] DELETE /api/acordos/:id — cancelar acordo — P1

#### Webhooks
- [WEBHOOK] POST /api/webhooks/asaas — P0
  - Eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, PAYMENT_REFUNDED
  - Salvar em webhook_event, processar async, atualizar parcela_acordo
  - Retornar 200 imediatamente (Asaas pausa fila após 15 falhas consecutivas)
  - Validar header `asaas-access-token`
  - Se todas as parcelas pagas → mover acordo para PAGO
- [WEBHOOK] POST /api/webhooks/clicksign — P1
  - Eventos: sign (signatário assinou), document_closed (todos assinaram), refusal, deadline
  - Validar HMAC SHA256 (header Content-Hmac)
  - Atualizar documento.situacao e acordo.etapa
  - Download do PDF assinado e armazenamento

#### Integrações Asaas (validadas via MCP)
- [INTEGRACAO] POST /v3/customers — criar cliente no Asaas — P0
  - Campos obrigatórios: name, cpfCnpj
  - Opcionais: email, mobilePhone, address, postalCode
  - Usar externalReference = pessoa.codigo do SEI
- [INTEGRACAO] POST /v3/payments — criar cobrança avulsa — P0
  - Campos obrigatórios: customer (asaas_id), billingType (BOLETO/PIX/CREDIT_CARD), value, dueDate
  - Usar externalReference = acordo_financeiro.id
  - description = "Parcela 1/3 - Acordo #ID - Liberdade Médica"
  - Para entrada 60% + 40%: criar 2 payments separados (NÃO usar installmentCount)
- [INTEGRACAO] GET /v3/payments/{id}/pixQrCode — obter QR Code PIX — P1
- [INTEGRACAO] GET /v3/payments/{id}/identificationField — linha digitável boleto — P1

#### Integrações ClickSign (validadas via código exemplo)
- [INTEGRACAO] POST /api/v3/envelopes — criar envelope — P1
- [INTEGRACAO] POST /api/v3/envelopes/{id}/documents — adicionar PDF (base64) — P1
- [INTEGRACAO] POST /api/v3/envelopes/{id}/signers — adicionar aluno como signatário — P1
  - Apenas 1 signatário (aluno), diferente do exemplo que tinha 2 (prestador + sócio)
  - Comunicação: assinatura via WhatsApp, lembretes via email
  - Phone format: apenas dígitos sem +55
- [INTEGRACAO] POST /api/v3/envelopes/{id}/requirements — requisito de assinatura — P1
  - action: "agree", role: "sign"
  - auth via WhatsApp: action: "provide_evidence", auth: "whatsapp"
- [INTEGRACAO] PATCH /api/v3/envelopes/{id} — ativar envelope (status: running) — P1
- [INTEGRACAO] GET /api/v3/envelopes/{id}/documents/{docId}/download — baixar PDF assinado — P1

#### Queries SEI (para popular formulário de criação)
- [QUERY] Parcelas em atraso do aluno — P0
  ```sql
  SELECT cr.codigo, cr.valor, cr.datavencimento, cr.multa, cr.juro,
         cr.descontoinstituicao, cr.descontoconvenio, cr.valordescontoprogressivo,
         cr.valordesconto, cr.valorrecebido, cr.tipoorigem, cr.nossonumero
  FROM cobranca.contareceber cr
  WHERE cr.pessoa = :pessoaCodigo
    AND cr.situacao = 'AR'
    AND cr.datavencimento < CURRENT_DATE
    AND COALESCE(cr.valorrecebido, 0) < cr.valor
  ORDER BY cr.datavencimento
  ```
- [QUERY] Verificar se parcela já está em outro acordo ativo — P0
  ```sql
  SELECT poa."contaReceberCodigo"
  FROM cobranca.parcela_original_acordo poa
  JOIN cobranca.acordo_financeiro af ON af.id = poa."acordoId"
  WHERE af.etapa NOT IN ('CANCELADO', 'PAGO')
    AND poa."contaReceberCodigo" IN (:codigos)
  ```
- [QUERY] Reconciliar NCR do SEI com parcelas do acordo — P2
  ```sql
  SELECT cr.codigo, cr.valor, cr.datavencimento
  FROM cobranca.contareceber cr
  WHERE cr.codorigem = :negociacaoContaReceberCodigo
    AND cr.tipoorigem = 'NCR'
  ```
- [QUERY] Métricas do workflow (dashboard futuro) — P3
  ```sql
  SELECT etapa, COUNT(*), SUM("valorAcordo"),
         AVG(EXTRACT(EPOCH FROM ("atualizadoEm" - "criadoEm")) / 86400) as dias_medio
  FROM cobranca.acordo_financeiro
  GROUP BY etapa
  ```
- [QUERY] Negociações do agente com tempo médio — P3
  ```sql
  SELECT af."criadoPor", COUNT(*),
         SUM(CASE WHEN etapa = 'PAGO' THEN 1 ELSE 0 END) as concluidas,
         AVG(CASE WHEN etapa = 'PAGO' THEN EXTRACT(EPOCH FROM ("atualizadoEm" - "criadoEm")) / 86400 END) as dias_medio
  FROM cobranca.acordo_financeiro af
  GROUP BY af."criadoPor"
  ```

#### Workers
- [WORKER] Processar webhook_event pendentes — P1
  - Job que verifica processado=false e tenta processar
  - Retry com backoff exponencial
  - Alerta se > 10 eventos pendentes por > 1 hora
- [WORKER] Verificar parcelas do acordo vencidas — P2
  - Cron diário: parcela_acordo com situacao=PENDENTE e dataVencimento < hoje
  - Atualizar para VENCIDO, notificar agente
  - Se acordo tinha parcela única → mover para INADIMPLENTE
- [WORKER] Gerar PDF do termo de negociação — P1
  - Template DOCX com variáveis: nome, cpf, valor, parcelas, datas, condições
  - Converter para PDF via ConvertAPI ou similar
  - Upload para storage (Supabase ou local)

#### Segurança
- [SEGURANCA] Webhook Asaas: validar authToken no header asaas-access-token — P0
- [SEGURANCA] Webhook ClickSign: validar HMAC SHA256 (Content-Hmac header) — P1
- [SEGURANCA] CPF do aluno mascarado em logs, nunca exposto no frontend — P0
- [SEGURANCA] Chaves de API (Asaas, ClickSign) apenas no .env, nunca no frontend — P0

### Sistema de Ocorrências
**Data**: 2026-04-10
**Status**: pendente
**Tipos definidos em**: `src/types/ocorrencia.ts`

- [MODEL] Ocorrencia — log de eventos com padrão mínimo (tipo, pessoaCodigo, agenteCodigo, descricao, origem, metadados JSON) — P0
  - Cada evento vincula: aluno + agente + tipo + origem
  - Metadados extras como JSON livre (IDs externos, valores, etc)
- [ROTA] GET /api/ocorrencias — listagem com filtros (aluno, agente, tipo, período) — P0
- [ROTA] GET /api/ocorrencias/aluno/:pessoaCodigo — timeline do aluno — P0
- [ROTA] POST /api/ocorrencias — registrar ocorrência manual (observação, contato) — P1
- [QUERY] Métricas de contato por aluno — P2
  ```sql
  SELECT "pessoaCodigo", 
    COUNT(*) FILTER (WHERE tipo LIKE 'LIGACAO_%') as total_ligacoes,
    COUNT(*) FILTER (WHERE tipo LIKE 'WHATSAPP_%') as total_whatsapp,
    COUNT(*) FILTER (WHERE tipo = 'NEGOCIACAO_CONCLUIDA') as negociacoes_concluidas
  FROM cobranca.ocorrencia GROUP BY "pessoaCodigo"
  ```
- [QUERY] Alunos sem tentativa de contato — P2
  ```sql
  SELECT p.codigo, p.nome FROM cobranca.pessoa p
  LEFT JOIN cobranca.ocorrencia o ON o."pessoaCodigo" = p.codigo
  WHERE o.id IS NULL AND p.aluno = true
  ```
- [WORKER] Cada transição no workflow gera ocorrência automaticamente — P1
- [WORKER] Eventos do Socket.io 3C Plus geram ocorrências (LIGACAO_*, WHATSAPP_*) — P1
- [WORKER] Webhooks Asaas/ClickSign geram ocorrências (NEGOCIACAO_PAGAMENTO_CONFIRMADO, etc) — P1

### Valor Líquido e Taxas (ParcelaAcordo)
**Data**: 2026-04-10
**Status**: pendente

- [MODEL] Adicionar campos valorLiquido e taxaAsaas na parcela_acordo — P1
  - Asaas retorna `netValue` no GET /v3/payments/{id} e no webhook
  - taxa = value - netValue
  - Valor líquido é base para cálculo de comissão
- [ROTA] GET /api/acordos/:id/financeiro — resumo com valor líquido total e taxa total — P2

### Segmentação (Motor de Regras)
**Tela frontend**: `src/pages/SegmentacaoPage.tsx`
**Data**: 2026-04-10
**Status**: pendente

- [MODEL] RegraSegmentacao — nome, descricao, condicoes (JSON), criadoPor, timestamps — P0
- [MODEL] ExecucaoSegmentacao — regraId, totalAlunos, valorInadimplente, executadoEm — P2
- [ROTA] GET /api/segmentacoes — listar regras salvas com métricas — P0
- [ROTA] POST /api/segmentacoes — criar regra — P0
- [ROTA] PUT /api/segmentacoes/:id — editar regra — P1
- [ROTA] DELETE /api/segmentacoes/:id — remover regra — P1
- [ROTA] POST /api/segmentacoes/:id/executar — rodar regra e retornar alunos — P0
  - Query builder dinâmico que traduz condições JSON em SQL
  - JOINs: pessoa + contareceber + matricula + pf_alunos + pf_plantoes + blip + serasa + ocorrencia + blacklist
  - Retorna: lista de alunos + contagem + valor inadimplente total
- [ROTA] POST /api/segmentacoes/:id/exportar-3cplus — enviar lista para mailing da 3C Plus — P1
  - POST /mailing_lists/{id}/contacts para cada aluno
  - Registrar ocorrência DISPARO_INCLUIDO
- [QUERY] Query builder dinâmico — P0
  - Traduzir condições JSON para WHERE clauses PostgreSQL
  - Suportar: número (=, >, <, BETWEEN), booleano, lista (IN, NOT IN)
  - Sempre excluir blacklist ativa
- [WORKER] Atualização automática de listas — P2
  - Cron diário re-executa regras ativas
  - Sincroniza com mailing da 3C Plus (add novos, remove pagadores)

### Blacklist
**Data**: 2026-04-10
**Status**: pendente

- [MODEL] Blacklist — pessoaCodigo, tipo (PEDIDO_ALUNO, PROCESSO_JUDICIAL, ACORDO_ATIVO, OUTRO), observacao, criadoPor, ativo, criadoEm, removidoEm — P0
- [ROTA] GET /api/blacklist — listar bloqueios ativos — P1
- [ROTA] POST /api/blacklist — adicionar aluno à blacklist — P0
- [ROTA] PATCH /api/blacklist/:id — desativar bloqueio — P1
- [QUERY] Excluir blacklist ativa em todas as segmentações — P0
  ```sql
  LEFT JOIN cobranca.blacklist bl ON bl."pessoaCodigo" = p.codigo AND bl.ativo = true
  WHERE bl.id IS NULL
  ```

---

## Infraestrutura Transversal

Necessidades que afetam multiplas telas e devem ser resolvidas cedo.

### Autenticacao e Autorizacao
**Status**: pendente

- [MIDDLEWARE] Sistema de autenticacao (JWT ou session) — P0
  - Login de usuarios do sistema (nao alunos)
  - Roles: admin, supervisor, agente
  - Proteger todas as rotas exceto health check
- [MODEL] Tabela de usuarios do sistema (se User atual nao for suficiente) — P0
- [ROTA] POST /api/auth/login — P0
- [ROTA] POST /api/auth/logout — P0
- [ROTA] GET /api/auth/me — P0

### Socket.io Worker (3C Plus)
**Status**: pendente

- [WORKER] Servico Node.js separado conectado ao Socket.io da 3C Plus 24/7 — P1
  - Escuta eventos de chamada (call-was-connected, call-was-finished, etc)
  - Escuta new-message-whatsapp
  - Encaminha eventos ao backend via API interna ou Redis
- [SEGURANCA] Token da 3C Plus nao pode ficar no frontend — P0

### Webhook Asaas
**Status**: pendente (detalhado em Workflow de Negociações acima)

- [WEBHOOK] POST /api/webhooks/asaas — unificado para pagamentos e workflow — P0
  - Ver seção "Workflow de Negociações" para detalhes completos
  - Também usado para: remover do mailing 3C Plus ao confirmar pagamento

### Sync SEI
**Status**: parcialmente implementado

- [WORKER] Scripts de Full Load ja existem: fullLoad.js, loadPfAlunos.js, loadPfPlantoes.js, loadSerasa.js, loadBlip.js ✅
- [WORKER] Delta Sync (incremental) — PENDENTE — P1
  - Atualmente o sync faz SELECT da tabela inteira (Full Load) e deleteMany + createMany
  - Precisa implementar sync baseado em campo de "updated_at" ou similar das tabelas SEI
  - As queries dos WebServices do SEI ainda nao estao dinamicas (nao filtram por data de alteracao)
  - Objetivo: reduzir tempo de sync e carga na API do SEI
  - Depende de verificar quais tabelas SEI possuem campo de data de alteracao
- [ROTA] Considerar criar rotas para disparar sync sob demanda via painel admin — P3

---

## 6. Ligacoes Ativas (3C Plus Integration)

**Tela frontend**: `src/pages/LigacoesPage.tsx`
**Data**: 2026-04-13
**Status**: pendente

### Models Prisma

- [MODEL] EventoLigacao — cada evento de chamada recebido via Socket.io — P0
  - id (uuid), tipo (String), pessoaCodigo (Int?), agenteId (String?),
    telefone (String?), duracao (Int?), qualificacao (String?),
    metadados (Json), criadoEm (DateTime @default(now()))
- [MODEL] ConfiguracaoAgente3C — config 3C Plus por agente — P1
  - id, userId (FK User), apiToken (String, encrypted), ramal (Int), subdomain (String),
    agente3cplusId (Int), ativo (Boolean), criadoEm, atualizadoEm
- [MODEL] Campanha3C — campanhas de ligacao em massa — P1
  - id, nome (String), status (String: ativa/pausada/encerrada), listas (Json),
    totalContatos (Int), totalLigacoes (Int), totalAtendidas (Int), totalNaoAtendidas (Int),
    criadoPor (String), criadoEm, encerradaEm
- [MODEL] AgendamentoCallback — retornos agendados — P1
  - id, pessoaCodigo (Int), agenteId (String), telefone (String),
    dataHora (DateTime), observacao (String?), status (String: pendente/realizado/cancelado),
    criadoEm (DateTime @default(now()))

### Rotas REST

- [ROTA] POST /api/ligacoes/login — proxy login agente na 3C Plus — P0
  - Backend faz POST /agent/login com token do agente (application/x-www-form-urlencoded)
  - Body: campaign={id}
- [ROTA] POST /api/ligacoes/logout — proxy logout agente — P0
  - Backend faz POST /agent/logout com token do agente
- [ROTA] POST /api/ligacoes/click2call — proxy click2call — P0
  - Backend faz POST https://3c.fluxoti.com/api/v1/click2call com token do GESTOR
  - Body: extension={ext}&phone={num}
  - Rate limiting: max 1 chamada a cada 5s por agente
- [ROTA] POST /api/ligacoes/campanha — criar campanha + importar mailing — P1
  - Recebe listas de segmentacao com peso
  - Executa query builder para gerar lista de alunos
  - POST /campaigns/{id}/lists/{list-id}/mailing.json com contatos
- [ROTA] POST /api/ligacoes/qualificar — proxy qualificacao de chamada — P0
  - Backend faz POST /agent/call/{call_id}/qualify com token do agente
  - Body: qualification_id={id} (application/x-www-form-urlencoded)
- [ROTA] POST /api/ligacoes/callback — agendar retorno de chamada — P1
- [ROTA] GET /api/ligacoes/callbacks — listar retornos pendentes — P1
- [ROTA] GET /api/ligacoes/eventos — historico de eventos (por agente, periodo) — P1
- [ROTA] GET /api/ligacoes/gravacao/:callId — proxy download gravacao — P1
  - Backend faz GET /calls/{callId}/recording com token do gestor
- [ROTA] GET /api/ligacoes/status — status do agente — P1
  - Backend faz GET /agent/status com token do agente

### Socket.io

- [SOCKET] Conexao permanente com socket.3c.plus via backend relay — P0
  - Backend conecta ao socket da 3C Plus com token do manager
  - Retransmite eventos relevantes para o frontend via Socket.io do proprio backend
  - Eventos escutados: agent-is-idle, agent-in-acw, call-was-created, call-was-answered,
    call-was-connected, call-was-hung-up, call-was-finished,
    call-history-was-created, call-was-unanswered, call-was-abandoned, new-message-whatsapp
  - Cada evento recebido: 1) salva em EventoLigacao, 2) gera Ocorrencia, 3) retransmite ao frontend
  - CRITICO: normalizar tipos com Number() — campos mudam de number para string entre eventos

### Workers

- [WORKER] Relay Socket.io 3C Plus -> Backend -> Frontend — P0
  - Servico Node.js separado, conectado 24/7 ao socket.3c.plus
  - Reconexao automatica com backoff exponencial
  - Heartbeat/ping para detectar desconexao
- [WORKER] Alertas de callbacks pendentes — P2
  - Cron a cada 5 minutos: verificar callbacks com dataHora < agora e status = pendente
  - Notificar agente (via socket ou notificacao in-app)
- [WORKER] Gerar ocorrencias a partir de eventos de ligacao — P1
  - call-was-connected -> LIGACAO_EFETUADA
  - call-was-unanswered -> LIGACAO_NAO_ATENDIDA
  - call-was-abandoned -> LIGACAO_ABANDONADA
  - call-history-was-created -> LIGACAO_HISTORICO (com duracao, qualificacao)

### Seguranca

- [SEGURANCA] Tokens 3C Plus NUNCA no frontend — todas as chamadas via proxy backend — P0
- [SEGURANCA] WebRTC iframe URL construida no backend, token injetado via API — P0
- [SEGURANCA] Rate limiting no click2call (max 1 chamada a cada 5s por agente) — P1
- [SEGURANCA] Token do gestor (Marcelo) fica no .env, token do agente no ConfiguracaoAgente3C — P0

### Detalhes Tecnicos 3C Plus

- Dominios: Discador (liberdademedica.3c.plus/api/v1), Click2Call (3c.fluxoti.com/api/v1), Omnichannel (app.3c.fluxoti.com/omni-api/v1/whatsapp/)
- Content-Type Discador: application/x-www-form-urlencoded
- Content-Type Omnichannel: application/json
- Fluxo Click2Call: iframe WebRTC (8-10s SIP) → POST /agent/login (token agente) → agent-is-idle → POST /click2call (token gestor)
- Qualificacoes: extraidas do evento call-was-connected → campaign.dialer.qualification_list.qualifications
- Gravacao: GET /calls/{id}/recording — download apos chamada. Transcricao NAO tem endpoint (futuro)
- Company: 8948, Campaign: 233972, Hyago: 193740/ext 1011, Marcelo (Gestor): 119414/ext 1001

---

## 7. Conversas WhatsApp (Omnichannel 3C Plus)

**Tela frontend**: `src/pages/ConversasPage.tsx`
**Data**: 2026-04-13
**Status**: pendente
**API**: Omnichannel 3C Plus (Omni API + Omni Chat API)

### Models Prisma

- [MODEL] MensagemWhatsapp — ja criada na migration de eventos — P0
  - Dedup: @@unique mensagemExternaId
  - Campos: chatId, tipo, corpo, fromMe, agenteId, timestamp, ack, interno, deletado, mediaUrl, mediaNome
- [MODEL] Adicionar campo `instanciaId` e `instanciaTipo` no registro de chats — P1

### Rotas REST — Chat Management

- [ROTA] GET /api/conversas/chats — listar chats do agente (in_progress + queue) — P0
  - Proxy: GET /chats (Omni Chat API, Bearer token)
  - Filtros: status, agent_id, instance_id
  - Combinar: GET /chats/queue para fila
- [ROTA] GET /api/conversas/chats/:chatId/mensagens — historico de mensagens — P0
  - Proxy: GET /chats/:chatId/messages (Omni Chat API)
  - Paginacao: page, per_page
- [ROTA] POST /api/conversas/chats/:chatId/aceitar — aceitar chat da fila — P0
  - Proxy: POST /chats/accept_queue/:chatId (Omni Chat API)
- [ROTA] POST /api/conversas/chats/:chatId/finalizar — finalizar chat — P0
  - Proxy: POST /chats/:chatId/finish (Omni Chat API)
  - Body: qualification, qualification_note
- [ROTA] POST /api/conversas/chats/:chatId/transferir — transferir chat — P1
  - Proxy: POST /chats/:chatId/transfer (Omni Chat API)
  - Body: agent_id ou team_id
- [ROTA] POST /api/conversas/chats/:chatId/snooze — adiar chat — P1
  - Proxy: POST /chats/:chatId/snooze (Omni Chat API)
  - Body: end_snooze (datetime ISO)
- [ROTA] PUT /api/conversas/chats/:chatId/lido — marcar como lido — P2
  - Proxy: PUT /chats/:chatId/unread (Omni Chat API)

### Rotas REST — Envio de Mensagens

- [ROTA] POST /api/conversas/enviar/texto — enviar mensagem de texto — P0
  - Proxy: POST /message/send_chat (Omni API, ?api_token=)
  - Body: chat_id, body, instance_id
- [ROTA] POST /api/conversas/enviar/imagem — enviar imagem — P1
  - Proxy: POST /message/send_image (Omni API, FormData)
  - Body: chat_id, instance_id, file (multipart)
- [ROTA] POST /api/conversas/enviar/audio — enviar audio — P1
  - Proxy: POST /message/send_voice (Omni API, FormData)
  - Body: chat_id, instance_id, file (.ogg)
- [ROTA] POST /api/conversas/enviar/documento — enviar documento — P1
  - Proxy: POST /message/send_document (Omni API, FormData)
  - Body: chat_id, instance_id, file
- [ROTA] POST /api/conversas/enviar/interno — nota interna — P1
  - Proxy: POST /message/send_internal_chat (Omni API)
  - Body: chat_id, body
- [ROTA] POST /api/conversas/enviar/template — enviar template WABA — P2
  - Proxy: POST /message/send_template (Omni API)
  - Body: chat_id, template_id, variables, instance_id

### Rotas REST — Auxiliares

- [ROTA] GET /api/conversas/instancias — listar instancias WhatsApp — P1
  - Proxy: GET /instances (Omni Chat API)
  - Retorna: whatsapp-3c e waba com status de conexao
- [ROTA] GET /api/conversas/equipes — listar equipes para transferencia — P1
  - Proxy: GET /teams (Omni Chat API)
- [ROTA] GET /api/conversas/agentes — listar agentes para transferencia — P1
  - Proxy: GET /agents (Omni Chat API)
- [ROTA] GET /api/conversas/respostas-rapidas — listar respostas rapidas — P2
  - Proxy: GET /quick-messages (Omni Chat API)

### Socket.io

- [SOCKET] Escutar new-message-whatsapp — P0
  - Evento ja capturado pelo worker Socket.io existente
  - Retransmitir ao frontend em tempo real
  - Payload: chat_id, message (tipo, corpo, fromMe, ack, etc)
  - Atualizar lista de chats (mover para topo, incrementar badge)
- [SOCKET] Escutar chat-was-accepted — P1
  - Atualizar status do chat na lista
- [SOCKET] Escutar chat-was-finished — P1
  - Mover chat para aba "Finalizados"
- [SOCKET] Escutar chat-was-transferred — P1
  - Atualizar agente no chat
- [SOCKET] Escutar message-ack-update — P1
  - Atualizar checkmarks (device → read)

### Queries

- [QUERY] Vincular contato WhatsApp com aluno SEI — P0
  ```sql
  SELECT p.codigo, p.nome, p.celular
  FROM cobranca.pessoa p
  WHERE REPLACE(REPLACE(p.celular,'(',''),')','')
    LIKE '%' || RIGHT(:contatoNumero, 9)
  ```
- [QUERY] Ocorrencias recentes do aluno (para painel lateral) — P0
  ```sql
  SELECT tipo, descricao, "criadoEm"
  FROM cobranca.ocorrencia
  WHERE "pessoaCodigo" = :codigo
  ORDER BY "criadoEm" DESC
  LIMIT 5
  ```
- [QUERY] Financeiro resumido (reusar da tela Alunos) — P0

### Workers

- [WORKER] Persistir mensagens WhatsApp em MensagemWhatsapp — P1
  - Cada new-message-whatsapp salva no banco com dedup
  - Gera ocorrencia: WHATSAPP_RECEBIDO ou WHATSAPP_ENVIADO
- [WORKER] Notification sound — P2
  - Emitir evento especial quando mensagem chega em chat nao ativo do agente
  - Frontend toca som de notificacao

### Seguranca

- [SEGURANCA] Tokens 3C Plus Omnichannel NUNCA no frontend — proxy via backend — P0
- [SEGURANCA] Dois tokens: api_token (Omni API legacy) e Bearer (Omni Chat API) — P0
- [SEGURANCA] Upload de arquivos: validar tipo MIME e tamanho max (16MB WhatsApp) — P1
- [SEGURANCA] Rate limiting no envio de mensagens (anti-spam) — P1

### Detalhes Tecnicos API

- **Omni API** (legacy): `https://app.3c.fluxoti.com/omni-api/v1/whatsapp/`
  - Auth: `?api_token=TOKEN` (query param)
  - Usado para: envio de mensagens, downloads de media
- **Omni Chat API** (nova): `https://app.3c.plus/omni-api/v1/`
  - Auth: Bearer token no header Authorization
  - Usado para: gerenciamento de chats, equipes, agentes, instancias
- Company: 8948
- Instancias: whatsapp-3c (nao oficial) e waba (oficial)
- Referencia completa: `3cplus-integration/references/omnichannel_api_endpoints.md`

---

## Indice de Telas → Requisitos

| Tela | Status Backend | Rotas | Queries | Integrações |
|------|---------------|-------|---------|-------------|
| Alunos | pendente | 2 | 4 | blip, serasa |
| Workflow Negociações | pendente | 8 | 5 | asaas, clicksign, sei |
| Ocorrências | pendente | 3 | 2 | 3cplus, asaas, clicksign |
| Segmentação | pendente | 4 | 3 | 3cplus (mailing) |
| Blacklist | pendente | 3 | 1 | — |
| Ligacoes Ativas | pendente | 10 | 0 | 3cplus (socket, api, webrtc) |
| Conversas WhatsApp | pendente | 15 | 3 | 3cplus (omni api, socket) |

---

## Sprint 2026-04-24 — Cobranca Automatica + Pausa + Busca + Segmentacao por Titulo

### ✅ CONCLUIDO nesta sprint

#### Pausa de ligacao por aluno
- [MODEL] `pausa_ligacao` (CRM): origem, motivo, pausadoPor, pausaAte, soft-delete via removidoEm — ✅
- [ROTA] `POST /pausas-ligacao`, `DELETE /:id`, `GET /por-aluno/:codigo`, `POST /remover-em-massa` — ✅
- [SERVICE] `pausaLigacaoService.js` + `sincronizarPausaPorEtapa(acordo)` auto-pausa quando acordo entra em TERMO_ENVIADO/ACORDO_GERADO/SEI_VINCULADO/CHECANDO_PAGAMENTO — ✅
- [INTEGRACAO] Filtro aplicado em `mailingService.subirSegmentacaoParaCampanha` antes do POST 3C Plus — ✅

#### Busca por nome com pg_trgm
- [MODEL] Migration: extensions `pg_trgm` + `unaccent` + funcao imutavel `cobranca.normalizar_busca(text)` + 6 indexes GIN trigram — ✅
- [SERVICE] `utils/buscaNomeHelper.js`: buildWhereNome + buildOrderByRelevancia + buildBuscaClauses — ✅
- [REFACTOR] 6 controllers migrados para usar helper: alunosController, acordosController, ocorrenciasController, cadastroRecorrenciaController, ficouFacilController, titulosController — ✅

#### Segmentacao por Titulo
- [MODEL] `RegraSegmentacao.tipo` (ALUNO|TITULO) + `RegraSegmentacao.totalTitulos` + `TemplateBlip.escopo` (AMBOS|TITULO) — ✅
- [QUERY] `buildSegmentacaoTitulosQuery` novo + dispatcher `buildSegmentacaoQuery(cond, opts, tipo)` — ✅
- [QUERY] CAMPO_MAP categorizado com `escopos: ['ALUNO'|'TITULO'|ambos]` + 6 campos de titulo novos (titulo_situacao, titulo_tipo_origem, titulo_valor, titulo_dias_ate_vencimento, titulo_dias_apos_vencimento, titulo_data_vencimento) — ✅
- [QUERY] `buildSegmentacaoCountQuery(cond, tipo)` retorna total+alunos_unicos+valor_total pra TITULO — ✅

#### Templates Blip + Disparos Manuais
- [MODEL] `template_blip`: nomeBlip @unique, titulo, descricao, conteudoPreview, variaveis JSONB, categoria, escopo, ativo — ✅
- [SERVICE] `reguaExecutorService.js`: resolverVariaveis + 9 fontes (NOME_ALUNO, PRIMEIRO_NOME, VALOR_PARCELA, DATA_VENCIMENTO, DIAS_ATE_VENCIMENTO, DIAS_ATE_VENCIMENTO_FRIENDLY, DIAS_APOS_VENCIMENTO, DIAS_APOS_VENCIMENTO_FRIENDLY, LINK_PAGAMENTO_SEI) — ✅
- [ROTA] CRUD `/templates-blip` + endpoint `/fontes` + `/preview` — ✅
- [INTEGRACAO] `blipMensagemService.enviarTemplate({ telefone, templateNome, parametros, botaoUrlParam })` generico — ✅
- [MODEL] `disparo_mensagem`: status PENDENTE|ENVIADO|FALHOU|CANCELADO + UNIQUE(etapaReguaId, pessoaCodigo, contaReceberCodigo) — ✅
- [ROTA] `/disparos/prever` + `/disparos/disparar-agora` + `/disparos/historico` + `/disparos/resumo` — ✅
- [SEGURANCA] Validacao compat template-regra: template TITULO exige regra TITULO — ✅

#### Regua automatica
- [MODEL] `regua_cobranca` + `etapa_regua` (diasRelativoVenc, horario, templateBlipId FK, segmentacaoId, ultimaExecucaoEm) — ✅
- [MODEL] `RegraSegmentacao.escopoUso` (GLOBAL|EMBUTIDA_REGUA) + `reguaOwnerId` FK cascade — ✅
- [WORKER] `reguaSchedulerService.js`: tick 1min, `estaNoHorarioDa(etapa, regua)` + `jaRodouHoje(etapa)`, lock reentrancia via `trabalhandoTick`, `processarEtapa` com createMany em batches de 500 — ✅
- [WORKER] `reguaWorkerService.js`: drain 5s, cancelamento auto de pendentes de regua desativada, defesa em profundidade (re-valida conta.situacao antes do envio) — ✅
- [ROTA] CRUD `/reguas-cobranca` + `/etapas` nested + `/executar-agora` + `/simular` + `/preview` + `/metricas` + `/modelo-padrao` — ✅
- [INTEGRACAO] Ao ativar regua (ativo: false→true): `executarReguaAgora` chamado em background — ✅

### 🔜 PROXIMAS SPRINTS

- [WORKER] Reconciliacao diaria de conversao — marcar `DisparoMensagem.convertido=true` quando `contareceber.situacao=RE` apos `disparadoEm`. Atribuicao: so ultimo disparo de sucesso antes do pagamento — P1
- [MIDDLEWARE] Rate limit em `POST /disparos/disparar-agora`: cooldown de 5min por user. Mesmo sendo admin, evita disparo acidental de 10k mensagens — P1
- [WORKER] Arquivamento de `disparo_mensagem` > 90 dias em tabela fria ou JSONB compactado. Crescimento estimado: 600-2500 rows/dia — P2
- [SEGURANCA] Sanitizar `parametros` em responses do endpoint `/disparos/historico` — LINK_PAGAMENTO_SEI contem token (nao critico pois ja vai por WhatsApp, mas melhor ocultar em listagens) — P2
- [MIDDLEWARE] `requireRole('ADMIN')` em rotas de escrita de regua/template — hoje single-tenant, mas bom hardening — P2
- [ARQUITETURA] Regua por aluno (trigger-based): "aluno entrou na segmentacao pela primeira vez ha X dias". Util para boas-vindas, reconquista — P3
- [INTEGRACAO] A/B test de templates numa mesma etapa (duas versoes enviadas em 50/50, metrica de conversao por variante) — P3
- [ROTA] Dashboard de metricas avancado (graficos temporais, cohort, aging) — hoje so tem chip por etapa — P3
