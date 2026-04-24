# Backend - Express + Prisma + Worker 24/7

Este diretorio contem todo o codigo backend: API REST, worker Socket.io 24/7, e Socket.io server interno.

## Arquitetura

```
src/
  index.js          # Entry point: httpServer + realtime + worker
  app.js            # Setup Express (middleware, rotas, error handler)
  realtime.js       # Socket.io server interno (/ws) — broadcast para browsers
  routes/           # Definicao de rotas - SEM logica de negocios
  controllers/      # Logica de negocios - usa Prisma para acessar o banco
  services/         # Logica de dominio (conversaCobrancaService.js)
  workers/          # Worker Socket.io 24/7 e handlers de eventos
    socket3cplusWorker.js    # Daemon: conexao permanente com socket.3c.plus
    handlers/
      whatsappHandler.js     # new-message-whatsapp → mensagem_whatsapp + conversa_cobranca
      ligacaoHandler.js      # call-was-* → registro_ligacao + evento_ligacao_raw
  middleware/        # Middlewares Express (auth, errorHandler)
  config/           # Configuracoes (database.js = Prisma client)
  sync/             # Scripts de integracao com SEI (fullLoad.js, validationQuery.js)
  utils/            # Funcoes utilitarias puras
```

## Worker Socket.io 24/7

O Worker conecta permanentemente ao socket.3c.plus usando THREECPLUS_MANAGER_TOKEN. Ele:
- Escuta eventos de WhatsApp (new-message-whatsapp) e ligacoes (call-was-*)
- Persiste cada evento no banco (mensagem_whatsapp, registro_ligacao, evento_ligacao_raw)
- Faz upsert da ConversaCobranca com enriquecimento financeiro (vincularPessoa + calcularMetricas)
- Broadcast para browsers conectados via Socket.io /ws (realtime.js)

**IMPORTANTE:** Frontend NUNCA conecta direto ao socket.3c.plus. Sempre pelo /ws do backend.

**Excecao para workers/handlers:** A regra "NUNCA aninhe pastas" tem uma unica excecao: `workers/handlers/` eh permitido porque os handlers sao parte intima do worker e nao fazem sentido como pasta irma.

## Regras Criticas

- **NUNCA aninhe pastas** dentro de outras. Todas as pastas (routes, controllers, middleware, config, utils) ficam no mesmo nivel dentro de `src/`
- **NUNCA escreva SQL diretamente**. Use APENAS Prisma ORM
- **NUNCA importe PrismaClient diretamente nos controllers**. Importe de `../config/database.js`
- **SEMPRE use try/catch nos controllers** e passe o erro para `next(error)`
- **SEMPRE registre novas rotas** em `routes/index.js`
- O backend roda na **porta 3001** em desenvolvimento

## Padrao de Rota

Arquivo: `routes/<feature>Routes.js`
```javascript
import { Router } from 'express';
import { getAll, getById, create, update, remove } from '../controllers/<feature>Controller.js';

const router = Router();

router.get('/', getAll);
router.get('/:id', getById);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

export default router;
```

## Padrao de Controller

Arquivo: `controllers/<feature>Controller.js`
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

export async function create(req, res, next) {
  try {
    const item = await prisma.<model>.create({ data: req.body });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
}
```

## Registrar Nova Rota

Em `routes/index.js`, adicione:
```javascript
import featureRoutes from './<feature>Routes.js';
router.use('/<feature>', featureRoutes);
```

## Banco de Dados (Prisma)

- Schema: `prisma/schema.prisma`
- Client singleton: `src/config/database.js`
- Apos mudar o schema: `npx prisma migrate dev --name descricao`
- Visualizar dados: `npx prisma studio`
- Seed: `npm run db:seed`

### Relacionamentos
O mapa completo de relacionamentos esta em `../SEI_database/relacionamentos.md`. SEMPRE consulte antes de escrever queries com JOINs.

### Backlog
O arquivo `BACKLOG.md` neste diretorio contem TODOS os requisitos de backend identificados durante a construcao do frontend. Consulte antes de implementar para garantir que nada foi esquecido.

### Exemplo de Model Prisma
```prisma
model Produto {
  id          Int      @id @default(autoincrement())
  nome        String
  preco       Float
  descricao   String?
  ativo       Boolean  @default(true)
  categoriaId Int?
  categoria   Categoria? @relation(fields: [categoriaId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## Environment Variables

- Desenvolvimento: `.env.dev` (carregado automaticamente pelo script `dev`)
- Producao: configurar no painel da Vercel
- `DATABASE_URL`: string de conexao PostgreSQL
- `PORT`: porta do servidor (default 3001)
- `NODE_ENV`: development ou production
- `THREECPLUS_MANAGER_TOKEN`: token do gestor 3C Plus (usado pelo worker + click2call + omnichannel)
- `THREECPLUS_AGENT_TOKEN`: token do agente 3C Plus (usado para WebRTC, login, hangup)

## Deploy (Vercel)

O arquivo `api/index.js` exporta o app Express como serverless function.
A Vercel roteia `/api/*` para esta function automaticamente via `vercel.json`.
NAO modifique `api/index.js` a menos que saiba o que esta fazendo.

## Learnings

Secao de aprendizado continuo do backend. Atualizada a cada sessao com descobertas, correcoes e padroes.

### Instrucoes
- Registre aprendizados especificos do backend (rotas, controllers, Prisma, sync)
- Categorize como: `[CORRECAO]`, `[PADRAO]`, `[FEEDBACK]`, `[EDGE-CASE]` ou `[BUG]`
- Formato: `- [TIPO] descricao concisa (data: YYYY-MM-DD)`

### Registro
- [PADRAO] Webhook Blip deve retornar 200 ANTES de processar — Blip bloqueia por 4h se detectar falhas consecutivas (2026-04-08)
- [PADRAO] Sanitizacao de CPF do Blip: extrair 11 digitos via regex no texto bruto (funciona para CPFs com nome embutido, prompts do chatbot, etc) (2026-04-08)
- [PADRAO] Sanitizacao de telefone: remover +55, formatar como (XX) XXXXX-XXXX para match com pessoa.celular do SEI (2026-04-08)
- [BUG] contareceber com 50k+ registros precisa de timeout de 60s na transacao Prisma (2026-04-07)
- [BUG] Strings vazias em campos unique (ex: pessoa.cnpj) causam violacao de constraint — converter para null na sanitizacao (2026-04-07)
- [PADRAO] Worker Socket.io 24/7 iniciado no boot do Express via startSocketWorker() em index.js. Reconecta automaticamente com backoff ate 30s (2026-04-15)
- [PADRAO] Persistir mensagens enviadas no controller (apos REST 200), nao depender do echo do socket. Controller chama persistirMensagemEnviada() que salva em mensagem_whatsapp + upsert ConversaCobranca + broadcast realtime (2026-04-15)
- [PADRAO] Upload de midia para 3C Plus: usar File() nativo do Node.js (nao Blob). Sanitizar filename (remover espacos, parenteses, acentos) via sanitizarFilename() (2026-04-15)
- [PADRAO] Mapeamento de campos de ligacao: call.call_mode (nao call.mode), call.campaign_id (nao call.campaign.id), call.agent eh number direto em created, call.hangup_cause_txt (nao _text). Ver comentarios no ligacaoHandler.js (2026-04-15)
- [PADRAO] 3C Plus Omnichannel: Chat API nova (app.3c.plus/omni-chat-api, Bearer token) para chats/mensagens/envio. Omni API legada (app.3c.fluxoti.com, ?api_token=) so para /agents, /teams (2026-04-15)
- [EDGE-CASE] Quando desliga via API (POST /agent/call/{id}/hangup), 3C Plus pula call-was-hung-up e emite direto call-was-finished. Handler no frontend trata ambos (2026-04-15)
- [EDGE-CASE] Canal whatsapp-3c (nao oficial) NAO emite ack de entrega/leitura. Tratamos HTTP 200 do envio como ack="device". Sem "read" nesse canal (2026-04-15)
- [ARQUITETURA] Materialized View cobranca.mv_aluno_resumo: pre-calcula situacao, financeiro, valor_devedor. GET /api/alunos consulta a MV. REFRESH via fullLoad.js apos sync ou POST /api/alunos/refresh manual (2026-04-17)
- [PADRAO] Queries de listagem NUNCA devem fazer SUM/COUNT em contareceber (50k+ registros, timeout no Cloud SQL). Usar MV ou EXISTS para checks booleanos (2026-04-17)
- [PADRAO] segmentacaoQueryBuilder.js: traduz condicoes JSON para SQL PostgreSQL. CTEs adicionadas sob demanda. Campos mapeados em CAMPO_MAP com expressao SQL + JOIN necessario (2026-04-17)
- [PADRAO] mailingService.js: criar lista com POST /campaigns/{id}/lists (form-urlencoded, header[0]=identifier, header[1]=areacodephone). Adicionar contatos com POST .../mailing.json (array raiz) (2026-04-17)
- [PADRAO] Auth JWT: requireAuth em middleware/auth.js verifica Bearer token. optionalAuth para rotas opcionais. requireRole('ADMIN') para restricao por perfil (2026-04-16)
- [PADRAO] ligacoesController.getConfig: detecta gestor (token = manager token) e retorna token/extension do agente .env. Agentes normais usam seus proprios dados (2026-04-17)
- [EDGE-CASE] Cloud SQL tem timeout de ~60s para queries. Materialized Views com JOINs pesados podem levar >120s para criar. Usar SET statement_timeout = 300000 ou rodar fora do horario (2026-04-17)
- [PADRAO] ligacaoHandler.onCallCreated: vincular pessoaCodigo via vincularPessoa(telefone) para que ligacoes aparecam nas ocorrencias do aluno (2026-04-17)
- [PADRAO] Pausa de ligacao: tabela pausa_ligacao (CRM) com origem SISTEMA/AGENTE + soft-delete via removidoEm. Filtro aplicado no mailingService.subirSegmentacaoParaCampanha ANTES do POST 3C Plus (nao na query base da segmentacao — mantem totais da analise intactos). Auto-pausa via sincronizarPausaPorEtapa em acordosController.atualizarEtapa + 3 pontos do webhooksController (2026-04-24)
- [ARQUITETURA] Busca por nome com pg_trgm + unaccent (extensoes postgres): funcao imutavel cobranca.normalizar_busca(text) + indexes GIN trigram em aluno_resumo.nome, pessoa.nome, acordo_financeiro.pessoaNome, ocorrencia.pessoaNome, cadastro_recorrencia.pessoaNome, ficou_facil.pessoaNome. Helper centralizado em utils/buscaNomeHelper.js: buildWhereNome + buildOrderByRelevancia + buildBuscaClauses. Ranking hibrido: 0=comeca com termo / 1=prefixo de palavra / 2=similarity. Multi-palavra AND. Substitui 6 ILIKE dispersos por logica unificada (2026-04-24)
- [PADRAO] Segmentacao tipo ALUNO | TITULO: RegraSegmentacao.tipo define se query retorna 1 linha por aluno ou 1 por titulo. CAMPO_MAP tem `escopos` por campo (ex: valor_inadimplente so ALUNO, titulo_situacao so TITULO, turma em ambos). Query builder tem dispatcher buildSegmentacaoQuery(cond, opts, tipo) que chama buildAlunoQuery ou buildTituloQuery. Campos TITULO: titulo_situacao, titulo_tipo_origem, titulo_valor, titulo_dias_ate_vencimento, titulo_dias_apos_vencimento, titulo_data_vencimento (2026-04-24)
- [PADRAO] Template Blip com escopo auto-inferido: se variaveis incluem fontes de titulo (VALOR_PARCELA, DATA_VENCIMENTO, DIAS_ATE_VENCIMENTO*, LINK_PAGAMENTO_SEI), escopo=TITULO. Senao escopo=AMBOS. Logica em inferirEscopo() no templatesBlipController — aplicada no criar/atualizar. DispararAgora valida compat: template TITULO exige regra TITULO (2026-04-24)
- [ARQUITETURA] Regua de cobranca automatica: scheduler por horario de etapa (nao 1x/dia rigido). tick a cada 1min verifica `jaRodouHoje(etapa)` + `estaNoHorarioDa(etapa, regua)`. Quando bate horario, executa processarEtapa que usa createMany com skipDuplicates (idempotente via unique (etapaReguaId, pessoaCodigo, contaReceberCodigo)). Worker drena PENDENTES respeitando etapa.horario || regua.horarioPadrao, com defesa em profundidade (re-valida conta.situacao antes do envio — quem pagou nao recebe). Integracao: startReguaScheduler() + startReguaWorker() no boot via index.js (2026-04-24)
- [PADRAO] Defesa em profundidade no envio: worker antes de chamar enviarTemplate checa `SELECT situacao FROM contareceber WHERE codigo=X`. Se != 'AR', marca CANCELADO com mensagem "Titulo nao mais AR" e nao envia. 1ms por disparo, custo irrelevante (worker ja espera 2s entre envios por rate limit Blip) (2026-04-24)
- [PADRAO] Segmentacao embutida em regua: RegraSegmentacao.escopoUso=EMBUTIDA_REGUA + reguaOwnerId FK cascade. Invisivel em /segmentacao por padrao (toggle "Mostrar embutidas" no header revela). Criada via NovaRegraModal com prop reguaOwnerId. Ao deletar regua, embutidas vao junto (cascade). Evita poluicao da tela principal com dezenas de segmentacoes tecnicas (2026-04-24)
- [PADRAO] Fixes criticos N+1: NUNCA usar prisma.xxx.create() dentro de loop. Sempre createMany({ data, skipDuplicates: true }). Aplicado em reguaSchedulerService.processarEtapa (era 1 query por aluno elegivel, virou 1 query por batch de 500). 12k queries/ciclo → 10 queries/ciclo em base de 5k alunos (2026-04-24)
- [PADRAO] Lock de reentrancia em daemons: setInterval com funcao async pode gerar execucoes paralelas se o tick demora mais que o intervalo. Solucao: flag `trabalhandoTick` + `if (trabalhandoTick) return;` no inicio do callback (padrao ja usado em reguaWorkerService.drenarUm) (2026-04-24)
- [PADRAO] Paginacao em segmentacoes grandes: evitar `limit: 99999` (carrega tudo em memoria). Loop com batches de 500 via `buildSegmentacaoQuery(cond, { page, limit: 500 })` + processar + incrementar page ate `rows.length < 500`. Memory pico limitado a ~250KB/batch constante (2026-04-24)
- [ARQUITETURA] 4 daemons rodando no boot do index.js: startSocketWorker (3C Plus 24/7), runDeltaSync (10min), startReguaScheduler (tick 1min), startReguaWorker (poll 5s). Memoria idle esperada: ~150MB heap, ~350MB RSS. Pico com tick + delta + 100 disparos pendentes: ~500MB heap (2026-04-24)
