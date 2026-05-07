# Arquitetura de Deploy — Sistema de Cobranca LM

Documento tecnico sobre a decisao de nao deployar o backend inteiro na Vercel e a viabilidade de usar cPanel VPS para o backend Node.js.

---

## Estado atual em producao (atualizado 2026-05-07)

```
Frontend:      Railway → cobranca.lmedu.com.br
Backend:       Railway → api-cobranca.lmedu.com.br
Banco:         Google Cloud SQL (35.199.101.38:5432, schema "cobranca")
DNS/SSL:       Cloudflare apontando para os deploys da Railway
```

**Por que Railway para AMBOS** (em vez do split frontend Vercel + backend Railway sugerido na recomendacao original):
- Unifica deploy/CI em uma plataforma so
- Push-to-deploy no GitHub para os dois servicos
- Mesma origem (apontamentos DNS, SSL gerenciado, dashboards)
- Custo previsivel — ambos no mesmo plano

A analise de "por que NAO Vercel sozinha" continua valida (worker 24/7, sem webhooks 3C Plus, Puppeteer, setInterval delta sync). Railway atende todos os requisitos de processo persistente.

---

## TL;DR

O backend deste sistema **nao pode** ser deployado 100% na Vercel porque depende de **processos stateful de longa duracao** — principalmente um Worker Socket.io que mantem conexao WebSocket persistente com a 3C Plus 24/7. A arquitetura Serverless da Vercel (incluindo Fluid Compute) nao oferece garantias de vida continua necessarias para este caso de uso.

A recomendacao original era split: **frontend na Vercel (estatico Vite)** + **backend em servidor persistente (Node.js)**. **Decisao final foi unificar tudo na Railway** (ver "Estado atual em producao" acima). O cPanel moderno tambem suporta Node.js nativamente via `cPanel Node.js Selector` com Phusion Passenger — nao e mais exclusivo de PHP. Alternativas validas incluem Railway (escolhida), Render, Fly.io, DigitalOcean App Platform ou VPS Linux tradicional com PM2+Nginx.

---

## 1. Stack atual e escopo

### Frontend
- **React 19 + Vite + TypeScript**
- Build estatico (dist/)
- Consome REST (`VITE_API_URL`) e Socket.io (`VITE_BACKEND_URL`)
- **Candidato natural para Vercel** — e o que esta planejado

### Backend
- **Node.js 20+ com ES Modules** (`"type": "module"`)
- **Express 5** (REST /api/*)
- **Socket.io server interno** em /ws (broadcast para browsers)
- **Prisma ORM** + PostgreSQL (Google Cloud SQL)
- **Worker Socket.io** daemon persistente conectado a 3C Plus
- **Puppeteer-core** para geracao de PDF
- Multer, JWT, Helmet, express-rate-limit, etc.

---

## 2. Dependencias criticas que exigem processo persistente

### 2.1 Worker Socket.io 24/7 (socket3cplusWorker.js)

A plataforma **3C Plus** (discador e Omnichannel WhatsApp da operacao) **nao expoe webhooks HTTP** para eventos de ligacoes e mensagens. Toda comunicacao em tempo real acontece exclusivamente via **Socket.io sobre WebSocket**.

Eventos recebidos que precisam ser capturados:

| Evento | Frequencia | Acao no backend |
|--------|-----------|-----------------|
| `new-message-whatsapp` | Cada mensagem recebida ou enviada via canal WhatsApp | Persistir em `mensagem_whatsapp`, upsert em `conversa_cobranca`, enriquecer (JOIN com Pessoa do SEI, calcular valor_inadimplente, dias_atraso, serasa_ativo), broadcast para browsers |
| `call-was-created` | Cada ligacao discada pelo discador | Persistir em `registro_ligacao`, vincular telefone a pessoaCodigo |
| `call-was-connected` | Rede 3C Plus conectou | Atualizar status |
| `call-was-answered` | Humano atendeu | Atualizar inicio real da conversa |
| `call-was-hung-up` / `call-was-finished` | Chamada finalizou | Atualizar tempos, calcular duracao |
| `call-history-was-created` | 3C Plus gravou historico final | Atualizar qualificacao, criar `ocorrencia` |
| `agent-is-idle` / `agent-in-acw` | Mudanca de status do agente | Atualizar estado |

**Consequencia:** O processo precisa ficar vivo continuamente, mesmo sem requests HTTP chegando. Se o Worker cair, **mensagens de WhatsApp e eventos de ligacoes sao perdidos em tempo real** — a 3C Plus emite o evento para a sessao conectada e descarta. Nao ha replay.

Ver: `backend/src/workers/socket3cplusWorker.js`, `backend/src/workers/handlers/whatsappHandler.js`, `backend/src/workers/handlers/ligacaoHandler.js`.

### 2.2 Socket.io server interno (/ws)

Os browsers conectados ao frontend mantem uma conexao WebSocket persistente com o backend via `/ws`. O backend faz **broadcast** de:

- `mensagem:nova` — toda nova mensagem WhatsApp (recebida ou enviada)
- `conversa:atualizada` — mudanca de status, assumir, encerrar, snooze
- `ligacao:evento` — eventos de ligacao em andamento
- `acordo:atualizado` — webhook de pagamento Asaas ou assinatura ClickSign processado

Ver: `backend/src/realtime.js` e `src/contexts/RealtimeContext.tsx`.

### 2.3 Delta Sync com WebServices do SEI

A cada 10 minutos o backend executa sincronizacao incremental de 21 tabelas do sistema academico SEI via REST (`sync/deltaSync.js`). Rodando em setInterval dentro do processo Node, com estado compartilhado para registrar ultima execucao e evitar conflitos.

### 2.4 Puppeteer-core para geracao de PDF

Geracao de termos de negociacao em PDF usa Puppeteer controlando uma instancia do Chrome system (via `CHROME_PATH=/usr/bin/google-chrome`). O binario do Chrome ocupa aproximadamente 170MB descompactado. Usado em `backend/src/services/termoNegociacaoService.js`.

### 2.5 Rate limiting em memoria

`express-rate-limit` com contadores em memoria compartilhada para bloquear tentativas de login (20/15min) e requests gerais (200/min por IP). Em serverless, cada invocacao teria contador zerado.

### 2.6 JWT secret consistente

Tokens emitidos precisam ser validados por qualquer request subsequente. Em serverless com cold starts agressivos, desde que o secret seja env var isso funciona — mas a preocupacao combinada com todos os outros pontos torna o modelo inadequado.

---

## 3. Por que Vercel Serverless / Fluid Compute nao resolve

### 3.1 Vercel Functions (modelo padrao)

- **Duracao maxima por invocacao:** 300s (atualmente, plano Pro). Connexao WebSocket que preciso manter viva por **dias** — impossivel.
- **Sem estado compartilhado entre invocacoes:** cada request gera uma nova instancia potencial. Dois requests consecutivos podem cair em isolated instances, cada uma com seu proprio heap.
- **WebSocket outbound:** Functions podem abrir WebSocket para servico externo, mas a conexao morre com a function. Impossivel manter a conexao com 3C Plus "viva" entre multiplas invocacoes.
- **setInterval nao sobrevive:** Delta Sync de 10 minutos nao funciona — nao ha garantia de que a instancia esteja viva 10 minutos depois.

### 3.2 Vercel Fluid Compute (modelo atual 2026)

Fluid Compute melhora o serverless classico com:
- Reaproveitamento de instancia para multiplos requests concorrentes
- Cold start menor
- Node.js completo (nao edge runtime)

**Mesmo com Fluid Compute:**
- Instancias ainda sao **efemeras**. Vercel garante reaproveitamento quando ha trafego, mas **nao garante que a instancia fique viva sem trafego**.
- O caso de uso "Worker que fica ocioso esperando eventos da 3C Plus" e exatamente o cenario que Fluid Compute **nao otimiza**. Se o Worker fica 30 minutos sem receber request HTTP (porque e WebSocket outbound), a instancia pode ser reciclada.
- Conexoes WebSocket inbound (servidor para browser) tambem tem limite — Fluid Compute prefere streaming HTTP sobre WebSocket.

### 3.3 Bundle size

Puppeteer-core sozinho nao traz Chrome (ok), mas a camada "executable on disk" precisa do Chrome. Vercel nao permite instalar binario system no host (Lambda layer equivalente). Existem pacotes como `@sparticuz/chromium` que empacotam Chrome reduzido para Lambda (~45MB gzip), mas:
- Adiciona complexidade
- Performance pior que Chrome nativo
- Cold start pesado (600ms+ so pra spawnar o Chrome em disco efemero)
- Tem limite de execucao de 300s — geracao + download pode estourar em PDF com varias paginas

### 3.4 Vercel Crons

Vercel tem cron jobs nativos agora (Cron Jobs), mas:
- Granularidade minima 1 minuto — ok para Delta Sync
- Cada execucao e uma function isolada — nao compartilha estado com o Worker principal
- Significa reconectar ao banco em cada execucao, refazer o schema introspect do Prisma, etc.

---

## 4. cPanel com Node.js — desmistificacao

A preocupacao do desenvolvedor e valida historicamente: cPanel foi construido em torno de hosting PHP compartilhado. **Mas ha pelo menos 10 anos** o cPanel suporta Node.js como first-class citizen.

### 4.1 Como funciona

cPanel moderno oferece:
- **Node.js Selector** (componente oficial) — seleciona versao do Node (18, 20, 22, 24 LTS)
- **Phusion Passenger** — servidor de aplicacao Node.js que integra com o Apache/LiteSpeed do cPanel. Funciona como PM2 + Nginx mas gerenciado pela interface cPanel.
- **Startup file** — define entry point (`src/index.js`)
- **Env vars via interface** — configurar DATABASE_URL, JWT_SECRET, tokens etc. sem SSH
- **npm install via interface** — ou via SSH tradicional

Documentacao oficial: https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node-js-application/

### 4.2 Internamente

O que acontece nos bastidores:

```
Request HTTP chega
       v
Apache/LiteSpeed
       v
mod_passenger (Phusion)
       v
  node process (backend/src/index.js)
  |- Express listening on socket
  |- Socket.io in-process
  |- Worker 3C Plus (conexao persistente)
  |- Prisma Client conectado ao Cloud SQL
  |- setInterval Delta Sync
```

O processo Node fica vivo 24/7. Phusion Passenger gerencia:
- Auto-restart se crash
- Spawning de workers (se precisar escalar)
- Rolling restart em deploy
- Logs agregados

E equivalente funcional a rodar `pm2 start ecosystem.config.js` numa VPS Linux crua — so que com GUI no cPanel.

### 4.3 Diferencas em relacao a uma VPS crua

| Aspecto | cPanel + Node.js | VPS Linux crua |
|---------|------------------|----------------|
| Interface | Web GUI | SSH + CLI |
| Setup inicial | Click-based | Scripts manuais |
| Gestao de processos | Phusion Passenger | PM2 / systemd |
| SSL | Auto (Let's Encrypt integrado) | certbot manual |
| Subdominios | GUI | Nginx config manual |
| Preco | Ja includo no hosting | Precisa contratar VPS separada |
| Flexibilidade | Limitada ao que cPanel permite | Total |

---

## 5. Alternativas se cPanel nao for aceito

### 5.1 Railway (recomendada para simplicidade)

- Deploy via GitHub (push-to-deploy)
- Suporte nativo a Node.js, Python, Go, Rust
- WebSocket e processo persistente sem limitacoes
- $5/mes starter, escala por uso
- Postgres gerenciado incluso (se migrar do Cloud SQL)
- Docs: https://docs.railway.app

### 5.2 Render

- Similar a Railway
- Deploy via Git
- "Background Worker" type especifico para workers 24/7
- "Web Service" type para Express + Socket.io
- $7/mes por service (web + worker = $14)
- Docs: https://render.com/docs

### 5.3 Fly.io

- Deploy via `fly deploy` CLI (baseado em Dockerfile)
- VMs globais, escala geografica facil
- WebSocket full support
- $0-5/mes instancia pequena
- Curva de aprendizado maior (Docker obrigatorio)

### 5.4 DigitalOcean App Platform

- Deploy via GitHub
- "Worker" type explicito para Socket.io worker
- $5/mes instancia basica
- Postgres gerenciado disponivel
- Mais "enterprise-like" que Railway/Render

### 5.5 VPS Linux tradicional (Ubuntu 22.04)

- Droplet DigitalOcean / EC2 / Linode (~$6/mes 1GB RAM)
- Setup: Node 20 + PM2 + Nginx + certbot
- Controle total
- Exige mais manutencao

### 5.6 Kubernetes (quando sistema crescer)

- Para cargas 10x+ maiores
- Overhead alto hoje — nao justifica

---

## 6. Recomendacao

**Setup de producao sugerido:**

```
Frontend:      Vercel (cobranca.lmedu.com.br)
Backend:       cPanel Node.js App OU Railway (api-cobranca.lmedu.com.br)
Banco:         Google Cloud SQL (ja em producao — manter)
DNS/SSL:       Cloudflare ou registrar do dominio
```

**Criterios de escolha:**

1. **Se o cliente ja tem cPanel contratado** e o dev aceita validar o Node.js Selector → usar cPanel. Zero custo adicional.
2. **Se o cliente quer um deploy mais moderno** ou o cPanel da muita dor de cabeca → Railway ou Render.
3. **Se precisa de controle absoluto** (compliance, tuning especifico) → VPS Linux + PM2.

Em todos os casos: **Vercel sozinha nao atende**. Se houver insistencia em deploy unificado, a unica opcao seria:
- Substituir 3C Plus por plataforma que emita webhook HTTP (Twilio, Messagebird, ou API da Meta Cloud direto) — grande refactor
- Reescrever Worker como funcao disparada por cron de 1 minuto com DynamoDB ou similar para estado — grande refactor, qualidade de sincronizacao pior
- Aceitar perda de mensagens em tempo real — inaceitavel para operacao de cobranca

---

## 7. Checklist de deploy no cPanel

Se a opcao for cPanel, o desenvolvedor deve validar:

- [ ] Node.js Selector disponivel (versao 20+ LTS)
- [ ] Phusion Passenger ou modulo equivalente ativo
- [ ] Acesso SSH para `npm install` e `npx prisma generate` (ou executar via GUI)
- [ ] Permitido instalar pacotes nativos (`better-sqlite3` foi retirado, mas outros podem precisar compilar)
- [ ] Limite de memoria por processo — backend precisa **minimo 512MB**, recomendado 1GB
- [ ] `cronjobs` no cPanel para Delta Sync redundante (fallback se worker cair)
- [ ] SSL automatico no subdominio `api-cobranca.lmedu.com.br`
- [ ] Possibilidade de instalar Google Chrome no servidor (`yum install google-chrome-stable` ou equivalente) para Puppeteer
- [ ] Outbound WebSocket liberado (firewall nao bloqueando conexoes externas para `socket.3c.plus:443`)
- [ ] Logs persistentes acessiveis

Se algum desses itens **nao** e oferecido pelo cPanel do cliente, migrar para Railway ou VPS Linux.

---

## 8. Referencias no codigo

| Topico | Arquivos |
|--------|----------|
| Worker 24/7 | `backend/src/workers/socket3cplusWorker.js` |
| Handlers de eventos | `backend/src/workers/handlers/whatsappHandler.js`, `backend/src/workers/handlers/ligacaoHandler.js` |
| Socket.io interno | `backend/src/realtime.js` |
| Bootstrap do servidor | `backend/src/index.js` |
| Rotas REST | `backend/src/routes/index.js` |
| PDF Puppeteer | `backend/src/services/termoNegociacaoService.js` |
| Delta Sync | `backend/src/sync/deltaSync.js` |
| Schema Prisma | `backend/prisma/schema.prisma` |

---

## 9. Documentacao externa de suporte

- **Vercel — Functions limitations:** https://vercel.com/docs/functions/limitations
- **Vercel — Fluid Compute:** https://vercel.com/docs/functions/runtimes#fluid-compute
- **Socket.io — WebSocket vs polling:** https://socket.io/docs/v4/
- **cPanel — Node.js Application guide:** https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node-js-application/
- **Phusion Passenger:** https://www.phusionpassenger.com/
- **Railway:** https://docs.railway.app
- **Render Background Workers:** https://render.com/docs/background-workers

---

*Documento preparado em 22/04/2026. Versao 1.0.*
