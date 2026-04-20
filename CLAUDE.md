# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visao Geral
Sistema de cobranca da Liberdade Medica. Monorepo com frontend React e backend Express, integrado ao sistema academico SEI (Sistema de Ensino Integrado) via WebServices REST.

- **Frontend**: React 19 + Vite + TypeScript (pasta `/src`)
- **Backend**: Express 5 + Prisma ORM (pasta `/backend`)
- **Banco de dados**: PostgreSQL (Google Cloud SQL)
- **Integracao**: API REST do SEI para dados academicos e financeiros
- **Integracao**: 3C Plus para ligacoes (Click2Call, WebRTC) e WhatsApp (Omnichannel)
- **Integracao**: Asaas para cobranças e ClickSign para assinaturas digitais
- **Realtime**: Worker Socket.io 24/7 conectado a 3C Plus + Socket.io proprio (/ws) para browsers
- **Deploy**: Vercel (frontend como static site, backend como serverless functions)

## Regras Criticas

### Estrutura de pastas - NUNCA mude
- Codigo frontend vai APENAS em `/src` e suas subpastas
- Codigo backend vai APENAS em `/backend/src` e suas subpastas
- NUNCA crie pastas aninhadas dentro de outras (ex: routes dentro de controllers). Todas as pastas devem ser irmas, no mesmo nivel dentro de `/backend/src/`
- NUNCA crie arquivos na raiz do projeto (exceto configuracoes)

### Banco de dados
- SEMPRE use Prisma para acessar o banco. NUNCA escreva SQL diretamente (exceto em scripts de sync/validacao via `prisma.$queryRawUnsafe`)
- O schema fica em `/backend/prisma/schema.prisma`
- Apos modificar o schema, SEMPRE execute: `cd backend && npx prisma migrate dev --name descricao_da_mudanca`
- Se o Prisma gerar AUTOINCREMENT nas PKs das tabelas SEI, edite o SQL da migration para remover (IDs vem da API)
- Importe o client de `/backend/src/config/database.js`: `import { prisma } from '../config/database.js'`

### Relacionamentos entre tabelas (CONSULTAR SEMPRE)
O mapa completo de relacionamentos esta em `SEI_database/relacionamentos.md`. Este arquivo e a fonte da verdade para JOINs, queries e desenvolvimento. SEMPRE consulte antes de escrever queries que envolvam multiplas tabelas.
- As tabelas SEI NAO possuem FK constraints (para manter o sync simples)
- Os relacionamentos sao documentais, nao fisicos no banco
- O arquivo contem 49 relacoes internas (JOINs possiveis) + relacoes externas + exemplos de queries

### Protecao de Dados
- NUNCA logue, commite ou exponha CPFs, e-mails, telefones ou chaves de API
- A Auth Key do SEI fica em `.env` e `.env.dev` (ambos no `.gitignore`)

## Comandos

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Inicia frontend (porta 5173) |
| `npm run dev:backend` | Inicia backend (porta 3001) |
| `npm run dev:all` | Inicia frontend e backend juntos |
| `cd backend && npm run sync:full` | Executa Full Load de todas as 20 tabelas do SEI |
| `cd backend && npm run sync:pfalunos` | Popula pf_alunos via JSON |
| `cd backend && npm run sync:pfplantoes` | Popula pf_plantoes via JSON |
| `cd backend && npm run sync:serasa` | Popula serasa via JSON |
| `cd backend && npm run sync:blip` | Popula blip_contacts + blip_tickets via API Blip |
| `cd backend && npx prisma migrate dev --name nome` | Cria/aplica migration |
| `cd backend && npx prisma studio` | Abre visual do banco de dados |
| `cd backend && npx prisma generate` | Regenera Prisma Client |
| `cd backend && npm run db:seed` | Popula banco com dados de exemplo |

## Arquitetura de Dados: Integracao SEI

O banco contem 20 tabelas clonadas do SEI. Estas tabelas NAO sao gerenciadas pela aplicacao — sao apenas leitura, populadas pelo script de sync.

### Tabelas SEI (clone)
Todas com PKs sem autoincrement (IDs vem da API) e campos opcionais (?) para flexibilidade no UPSERT:

| Tabela | Descricao | ~Registros |
|--------|-----------|------------|
| `contareceber` | Parcelas/titulos financeiros (coracao do sistema) | 50k |
| `pessoa` | Dados cadastrais (nome, CPF, celular, email) | 2k |
| `matricula` | Vinculo aluno-curso (PK = matricula String, nao codigo) | 2k |
| `matriculaperiodo` | Periodo letivo de uma matricula | 2k |
| `turma` | Dados da turma/cohort | 31 |
| `curso` | Programa academico | 11 |
| `negociacaocontareceber` | Cabecalho de renegociacao de divida | 700 |
| `contarecebernegociado` | Titulos antigos substituidos em acordo | 11k |
| `negociacaorecebimento` | Cabecalho de pagamento recebido | 7k |
| `contarecebernegociacaorecebimento` | Liga titulo ao recibo | 7k |
| `contareceberrecebimento` | Detalhe do pagamento por titulo | 7k |
| `formapagamentonegociacaorecebimento` | Forma de pagamento usada no recibo | 7k |
| `formapagamento` | Dicionario (Boleto, Cartao, PIX) | 11 |
| `cartaocreditodebitorecorrenciapessoa` | Cartoes salvos para recorrencia | 321 |
| `documentoassinado` | Contrato/documento | 1.3k |
| `documentoassinadopessoa` | Assinatura de contrato por pessoa | 2.5k |
| `condicaopagamentoplanofinanceirocurso` | Regras financeiras do curso | 160 |
| `planodescontocontareceber` | Desconto aplicado a um titulo | 19k |
| `planodesconto` | Regras de desconto | 5 |
| `funcionario` | Staff do sistema | 68 |

### Tabelas customizadas (populadas via JSON ou API externa)

| Tabela | Descricao | ~Registros | Fonte |
|--------|-----------|------------|-------|
| `pf_alunos` | Perfil consolidado dos alunos (aulas, status financeiro) | 1.8k | JSON manual |
| `pf_plantoes` | Plantoes flexiveis dos alunos | 1.3k | JSON manual |
| `serasa` | Registros de negativacao Serasa | 983 | JSON manual |
| `blip_contacts` | Contatos do chatbot Blip (com CPF e telefone sanitizados) | 1.9k | API Blip |
| `blip_tickets` | Tickets de atendimento Blip | 2.7k | API Blip |

### Tabelas CRM (escrita do sistema — populadas pelo Worker 24/7 e acoes do agente)

| Tabela | Descricao | Fonte |
|--------|-----------|-------|
| `conversa_cobranca` | Conversa de cobranca enriquecida (status, agente, financeiro, SLA) | Worker Socket.io + acoes do agente |
| `mensagem_whatsapp` | Cada mensagem WhatsApp (texto, audio, imagem, documento) | Worker Socket.io + envio REST |
| `registro_ligacao` | Registro consolidado de cada chamada (duracao, qualificacao, gravacao) | Worker Socket.io |
| `evento_ligacao_raw` | Payloads brutos de eventos de ligacao (append-only, auditoria) | Worker Socket.io |
| `webhook_event` | Eventos recebidos de Asaas/ClickSign (idempotente, processavel) | Webhooks HTTP |
| `ocorrencia` | Timeline unificada de todas as acoes (agente, sistema, webhook) | Multiplas fontes |

### Campos-chave de negocios
- `contareceber.situacao`: AR=A Receber, RE=Recebido, NE=Negociado, CF=Cancelado Financeiro
- `contareceber.tipoorigem`: MAT=Matricula, MEN=Mensalidade, NCR=Negociacao, OUT=Outros, REQ=Requerimento
- `pessoa.seraza` / `pessoa.bloquearcontatocrm`: flags de cobranca
- `matricula.naoenviarmensagemcobranca`: flag para nao cobrar

### Script de Sync (`backend/src/sync/fullLoad.js`)
- Busca dados via POST em `https://sei.liberdademedicaedu.com.br/webservice/api/{SEI+nometabela}`
- Sanitizacao automatica via DMMF do Prisma (detecta tipos dos campos)
- Datas do SEI chegam como `"DD-MM-YYYY HH:mm:ss.SSS"` — convertidas para ISO 8601
- Decimais financeiros arredondados para 2 casas: `Math.round(parseFloat(v) * 100) / 100`
- Strings vazias convertidas para null (evita violacao de unique constraints)
- Full refresh por tabela: deleteMany + createMany em batches de 200
- Delay de 2s entre tabelas para nao sobrecarregar a API
- Timeout de 60s por transacao (contareceber tem 50k+ registros)

### Queries
O banco e PostgreSQL. Use sintaxe nativa: `DISTINCT ON`, `ILIKE`, `INTERVAL`, `TO_CHAR`, `LATERAL`, etc.

## Mapa de Pastas

```
src/                         # FRONTEND
  pages/                     # Uma pagina por arquivo (ConversasPage.tsx, LigacoesPage.tsx, etc.)
  components/                # Componentes reutilizaveis
    conversas/               # 8 componentes: ChatItem, BolhaMensagem, HeaderChat, InputMensagem, etc.
    ligacoes/                # 16 componentes: PainelLigacaoAtiva, WebRTCIframe, BotaoChamar, etc.
    alunos/                  # Drawer e tabs de perfil do aluno
    workflow/                # Kanban de negociacoes
    layout/                  # AppLayout, Header, Sidebar
    ui/                      # Componentes base (Modal, Drawer, Tabs)
  hooks/                     # Custom hooks (useApi.ts, useAuth.ts)
  services/                  # Camada de API
    api.ts                   # Cliente HTTP base (inclui Bearer token automaticamente)
    conversas3cplus.ts       # REST proxy para Omnichannel 3C Plus (envio de mensagens)
    conversasCobranca.ts     # CRUD de ConversaCobranca (nosso dominio)
    ligacoes3cplus.ts        # REST para Click2Call, login, hangup, WebRTC
    alunos.ts                # CRUD alunos com dados reais do SEI
    users.ts                 # CRUD usuarios + integracao 3C Plus
    segmentacao.ts           # CRUD regras de segmentacao + executar
  contexts/                  # React Contexts
    AuthContext.tsx           # Autenticacao
    LigacoesContext.tsx      # Estado de sessao de ligacoes (WebRTC, campanha, chamada ativa)
    RealtimeContext.tsx      # Socket.io /ws — conexao persistente com backend (GLOBAL)
  types/                     # Tipos TypeScript
    conversa.ts              # Chat3CPlus, ConversaCobranca, Mensagem3CPlus, StatusConversa, etc.
    ligacao.ts               # LigacaoAtiva, EventoLigacao, StatusConexao, etc.
    aluno.ts                 # Aluno, ResumoFinanceiro, Engajamento, etc.
    ocorrencia.ts            # TipoOcorrencia, OrigemOcorrencia
    acordo.ts                # AcordoFinanceiro, EtapaAcordo
  utils/                     # Funcoes utilitarias
  mocks/                     # Dados mock (alunos, conversas, ligacoes, ocorrencias, acordos)
  assets/                    # Imagens, icones, fontes

backend/src/                 # BACKEND
  routes/                    # Definicao de rotas Express
  controllers/               # Logica de negocios das rotas
  services/                  # Logica de dominio (conversaCobrancaService.js)
  workers/                   # Worker Socket.io 24/7 e handlers de eventos
    socket3cplusWorker.js    # Daemon: conexao permanente com socket.3c.plus
    handlers/
      whatsappHandler.js     # Persiste mensagens + upsert ConversaCobranca
      ligacaoHandler.js      # Persiste registro_ligacao + evento_ligacao_raw
  middleware/                # Middlewares (auth, errorHandler)
  config/                    # Configuracoes (database.js)
  sync/                      # Scripts de integracao com SEI
  utils/                     # Funcoes utilitarias do backend
  realtime.js                # Socket.io server interno (/ws) — broadcast para browsers
  app.js                     # Setup Express (middleware, rotas, error handler)
  index.js                   # Entry point: httpServer + realtime + worker

backend/prisma/              # BANCO DE DADOS
  schema.prisma              # Schema (User + 20 SEI + 6 CRM + 5 customizadas)
  migrations/                # Historico de migrations

SEI_database/                # DOCUMENTACAO SEI
  relacionamentos.md         # MAPA DE RELACIONAMENTOS (fonte da verdade para JOINs)
  instrucoes.txt             # Base de conhecimento da integracao
  ddl_SEI/                   # DDLs originais das tabelas do SEI
  tabelas_em_uso.txt         # Mapeamento tabela -> servico
  agente_SEI/                # Documentacao especializada (regras de negocio, nomenclaturas)

3cplus-integration/          # DOCUMENTACAO 3C PLUS
  SKILL.md                   # Visao geral da integracao
  references/                # API endpoints, Socket.io events, guia de integracao
    guia_integracao.md       # Guia completo validado em ambiente real
    api_endpoints.md         # 159 endpoints REST
    socket_events.md         # 40 eventos Socket.io com payloads
    omnichannel_api_endpoints.md # ~80 endpoints da API Omnichannel
```

## Arquitetura Realtime (Worker 24/7)

```
              socket.3c.plus (3C Plus)
                       ↓
         (conexao permanente WebSocket)
                       ↓
    ┌─────────────────────────────────────┐
    │  Backend Express (porta 3001)       │
    │  ├─ Worker (socket3cplusWorker.js)  │
    │  │    escuta: new-message-whatsapp, │
    │  │    call-was-*, agent-is-idle...  │
    │  │                                  │
    │  ├─ Handlers:                       │
    │  │    whatsappHandler → mensagem_whatsapp + conversa_cobranca  │
    │  │    ligacaoHandler  → registro_ligacao + evento_ligacao_raw  │
    │  │                                  │
    │  ├─ Socket.io server (/ws)          │
    │  │    broadcast: mensagem:nova,     │
    │  │    conversa:atualizada,          │
    │  │    ligacao:evento                │
    │  │                                  │
    │  └─ REST API (/api/*)               │
    │       conversas, conversas-cobranca, │
    │       ligacoes, webhooks            │
    └─────────────────────────────────────┘
                       ↓
              Socket.io /ws
                       ↓
    ┌─────────────────────────────────────┐
    │  Frontend (browser, porta 5173)     │
    │  └─ RealtimeContext.tsx             │
    │       escuta: mensagem:nova,        │
    │       conversa:atualizada,          │
    │       ligacao:evento                │
    │       (conexao global, nao por pag) │
    └─────────────────────────────────────┘
```

- Frontend NUNCA conecta direto ao socket.3c.plus
- Worker roda no boot do Express (startSocketWorker em index.js)
- Eventos persistem no banco mesmo sem browser aberto
- RealtimeContext conecta uma vez (AppLayout) e nao desconecta ao navegar

## Backend Backlog (ATUALIZAR SEMPRE)
Ao construir qualquer tela no frontend, SEMPRE atualize `backend/BACKLOG.md` com os requisitos de backend que aquela tela vai exigir (rotas, queries, webhooks, workers, models, integracoes). Este arquivo e o projeto do backend — sera implementado depois que o frontend estiver pronto.

## Padrao para Nova Feature de API (Backend)

Toda nova feature de API precisa de **3 passos**:

1. **Criar rota** em `/backend/src/routes/<feature>Routes.js`:
```javascript
import { Router } from 'express';
import { getAll, create } from '../controllers/<feature>Controller.js';
const router = Router();
router.get('/', getAll);
router.post('/', create);
export default router;
```

2. **Criar controller** em `/backend/src/controllers/<feature>Controller.js`:
```javascript
import { prisma } from '../config/database.js';
export async function getAll(req, res, next) {
  try {
    const items = await prisma.<model>.findMany();
    res.json(items);
  } catch (error) {
    next(error);
  }
}
```

3. **Registrar rota** em `/backend/src/routes/index.js`:
```javascript
import featureRoutes from './<feature>Routes.js';
router.use('/<feature>', featureRoutes);
```

## Padrao para Nova Tela (Frontend)

1. **Criar pagina** em `/src/pages/<Nome>Page.tsx`
2. **Adicionar rota** em `/src/App.tsx`: `<Route path="/caminho" element={<NomePage />} />`
3. Se precisa de dados da API, usar o hook `useApi` ou criar funcoes em `/src/services/`

## Padrao para Novo Modelo no Banco

1. Editar `/backend/prisma/schema.prisma` adicionando o model
2. Executar: `cd backend && npx prisma migrate dev --name adiciona_<nome_do_modelo>`
3. Criar tipo correspondente em `/src/types/index.ts`
4. Criar rota + controller para o modelo (ver padrao acima)

## Learnings

Secao de aprendizado continuo do projeto. Atualizada a cada sessao com descobertas, correcoes e padroes que devem ser lembrados em sessoes futuras.

### Instrucoes
- Registre aprendizados que afetam o projeto como um todo (nao especificos de um agente)
- Categorize como: `[CORRECAO]`, `[PADRAO]`, `[FEEDBACK]`, `[ARQUITETURA]` ou `[BUG]`
- Formato: `- [TIPO] descricao concisa (data: YYYY-MM-DD)`

### Registro
- [ARQUITETURA] Banco migrado de SQLite para PostgreSQL (Google Cloud SQL) em 2026-04-08. Todas as restricoes SQLite foram removidas.
- [PADRAO] Tabelas SEI sao read-only (sync via deleteMany+createMany). NAO usar @relation — relacionamentos sao documentais em SEI_database/relacionamentos.md (2026-04-08)
- [PADRAO] CPF da pessoa SEI e formatado (XXX.XXX.XXX-XX). blip_contacts.cpf_sanitizado ja vem neste formato. serasa.cpf_cnpj_numerico e so digitos — precisa REPLACE para JOIN (2026-04-08)
- [ARQUITETURA] Integracao 3C Plus exige worker Socket.io separado (24/7). NAO usar webhooks HTTP — plataforma usa exclusivamente Socket.io (2026-04-09)
- [FEEDBACK] Terminal do usuario e PowerShell. Usar `;` em vez de `&&` para encadear comandos (2026-04-08)
- [BUG] Prisma generate pode falhar com EPERM no Windows se backend ou Prisma Studio estiver rodando — fechar processos antes (2026-04-08)
- [BUG] Tailwind CSS v4 nao funciona neste Windows (politica de controle bloqueia binario nativo oxide). Usar Tailwind v3 com PostCSS (2026-04-09)
- [FEEDBACK] Terminal do usuario e PowerShell — comandos npm devem usar `;` em vez de `&&` (2026-04-09)
- [ARQUITETURA] Workflow de negociacao documentado em docs/workflow-negociacao.md. 5 tabelas novas no CRM: acordo_financeiro, parcela_original_acordo, parcela_acordo, webhook_event, documento (2026-04-10)
- [PADRAO] Asaas: entrada 60%+40% deve criar 2 payments avulsos separados, NAO usar installmentCount (que divide em parcelas iguais) (2026-04-10)
- [PADRAO] ClickSign: API usa formato JSON:API (application/vnd.api+json). Fluxo: Envelope → Document → Signers → Requirements → Activate (2026-04-10)
- [PADRAO] ClickSign: apenas 1 signatario (aluno), diferente do exemplo que tinha 2. Comunicacao via WhatsApp para assinatura, email para lembretes (2026-04-10)
- [CORRECAO] Acordo tem PAGAMENTOS (nao parcelas). Cada pagamento = 1 cobranca Asaas. Se cartao, Asaas parcela internamente via installmentCount+totalValue. PIX/Boleto sao sempre 1x (2026-04-10)
- [PADRAO] Cartao de credito no Asaas: ate 21x Visa/Master, ate 12x outras bandeiras. Usar totalValue (nao installmentValue) para divisao automatica (2026-04-10)
- [ARQUITETURA] Worker Socket.io 24/7 IMPLEMENTADO em backend/src/workers/socket3cplusWorker.js. Conecta na startup do Express, reconecta automaticamente. Frontend usa RealtimeContext (/ws) — NAO conectar direto ao socket.3c.plus (2026-04-15)
- [ARQUITETURA] ConversaCobranca eh a entidade de dominio do CRM. Cada mensagem WhatsApp cria/atualiza uma conversa com vinculo ao aluno (Pessoa SEI), enriquecimento financeiro (valor inadimplente, Serasa, dias atraso) e acoes proprias (assumir, encerrar, transferir, snooze) (2026-04-15)
- [PADRAO] 3C Plus Omnichannel tem DUAS APIs: Omni API legada (app.3c.fluxoti.com, ?api_token=) para agents/teams, e Chat API nova (app.3c.plus/omni-chat-api, Bearer) para chats/mensagens/envio. Mesmo token funciona em ambas (2026-04-15)
- [PADRAO] Canal whatsapp-3c (nao oficial) NAO emite ack de entrega/leitura via socket. Tratamos HTTP 200 do envio REST como ack="device" (2 tracos cinza). Sem tracos azuis nesse canal (2026-04-15)
- [PADRAO] Ordem de eventos de ligacao Click2Call: call-was-created (discando) → call-was-connected (rede conectou, celular tocando) → call-was-answered (humano atendeu) → call-was-finished/hung-up → call-history-was-created (2026-04-15)
- [CORRECAO] Quando desliga via API (POST /agent/call/{id}/hangup), 3C Plus pula call-was-hung-up e emite direto call-was-finished. Handler deve tratar ambos para transicionar a UI (2026-04-15)
- [PADRAO] Mapeamento real do payload de ligacao: call.call_mode (nao call.mode), call.campaign_id (nao call.campaign.id), call.agent eh number direto em created (objeto em connected/finished), call.hangup_cause_txt (nao _text) (2026-04-15)
- [PADRAO] Persistir mensagens enviadas no backend (controller) apos REST 200 — nao depender do echo do socket. Worker persiste recebidas; controller persiste enviadas. Ambos fazem broadcast via realtime (2026-04-15)
- [PADRAO] Para buscar mensagens historicas da 3C Plus quando endpoint /message/{chatId}/history retorna vazio: usar POST /message/search com letras comuns (a, e, o) como workaround. Ideal: persistir todas as mensagens no banco local via worker (2026-04-15)
- [PADRAO] Upload de midias para 3C Plus: usar File() do Node.js (nao Blob) para construir FormData. Sanitizar filename removendo espacos, parenteses e acentos antes de enviar (2026-04-15)
- [BUG] Prisma generate falha com EPERM no Windows quando backend ou Prisma Studio esta rodando. Node --watch tambem trava o DLL. SEMPRE fechar todos os processos Node antes de rodar prisma generate (2026-04-15)
- [FEEDBACK] Modo mock de ligacoes REMOVIDO (2026-04-15). Sistema agora opera exclusivamente em modo real. Toggle de mock foi retirado da UI e do LigacoesContext
- [ARQUITETURA] Auth: JWT + Google OAuth (SSO). Login em /login, dev-login so em development. AuthProvider global no App.tsx. api.ts envia Bearer token em todas as requests. Redirect para /login em 401 (2026-04-16)
- [ARQUITETURA] WebRTC persistente: ativa 1x ao iniciar turno, fica ativo enquanto agente logado. Login na campanha individual automatico. Click2Call direto de qualquer pagina. Dynamic Island mostra chamada em andamento em qualquer tela (2026-04-17)
- [ARQUITETURA] Materialized View mv_aluno_resumo pre-calcula situacao (ATIVO/TRANCADO/CANCELADO), financeiro (ADIMPLENTE/INADIMPLENTE), valor_devedor para ~2000 alunos. Listagem consulta a MV (~200ms). Refresh apos sync SEI via REFRESH MATERIALIZED VIEW CONCURRENTLY (2026-04-17)
- [PADRAO] Situacao do aluno e CALCULADA (proxy), nao lida do SEI. CANCELADO = conta cancelada + matricula IN/CA. TRANCADO = negociacaocontareceber com justificativa TRANCAMENTO sem retorno. ATIVO = demais (2026-04-17)
- [PADRAO] Filtrar funcionarios SEMPRE no inicio: COALESCE(p.funcionario, false) = false. Filtrar curso = 1 e turma NOT IN (1,10,14,19,22,27,29) (2026-04-17)
- [PADRAO] Contas NE nao aparecem no perfil do aluno. So mostrar AR e RE. NE so quando vinculada ao workflow de negociacao do CRM (2026-04-17)
- [PADRAO] Segmentacao: query builder dinamico traduz JSON para SQL com CTEs sob demanda. 24 campos em 8 categorias. RegraSegmentacao salva no banco com CRUD completo (2026-04-17)
- [PADRAO] Mailing 3C Plus: criar lista com headers (identifier + areacodephone) via POST /campaigns/{id}/lists. Adicionar contatos via POST .../mailing.json com array raiz [{identifier, phone}] (2026-04-17)
- [PADRAO] Usuario gestor (token = manager token): usar token e extension do agente do .env para WebRTC e Click2Call. Gestor nao pode se cadastrar em campanhas como agente (2026-04-17)
- [CORRECAO] Apos call-was-finished, agente entra em ACW (status 4) brevemente. NAO fazer login na campanha durante ACW — manter login persistente e so fazer click2call (2026-04-18)
- [PADRAO] GET /users (discador 3C Plus) retorna email + api_token + extension de todos os usuarios. Usar para vincular agentes existentes automaticamente (2026-04-16)
- [PADRAO] Equipes WhatsApp: vincular via PUT /users/{id} com campo teams:[teamIds]. GET /team/agents retorna agentes com suas equipes (2026-04-16)
- [PADRAO] Campanhas paginadas na 3C Plus: GET /campaigns retorna 15 por pagina. Percorrer com ?page=N ate items.length < 15 (2026-04-16)
