# Integração WhatsApp Business API (WABA)

Documento de referência da integração WABA via 3C Plus + Meta Cloud API. Cobre desde o motor de templates até a UX da tela de conversa, decisões tomadas, bugs encontrados e o fluxo final validado em produção.

**Última atualização:** 2026-05-07

---

## 1. Visão geral

A Liberdade Médica usa duas instâncias de WhatsApp através da 3C Plus:

- **WhatsApp 3C+** (`type: whatsapp-3c`): canal não oficial. Texto livre a qualquer momento, sem custo por mensagem, sem restrição de janela. Risco de banimento pelo Meta.
- **WABA** (`type: waba`): canal oficial via Meta Cloud API. Sujeito à regra de **janela de 24h** — fora dela, só template aprovado. Custo por conversa (sessão de 24h).

A integração foi construída em 5 sprints + correções pontuais. O resultado é uma tela de conversa onde o agente:

1. Vê histórico unificado por aluno (mensagens de ambos os canais ordenadas cronologicamente).
2. Escolhe via dropdown qual canal usar para a próxima mensagem.
3. Dentro da janela 24h da WABA → texto livre, mídia, áudio.
4. Fora da janela → CTA "Selecione um modelo de mensagem" → modal de templates aprovados.
5. Cada balão exibe badge do canal usado (`WABA` emerald / `WhatsApp 3C+` cinza).

---

## 2. Componentes envolvidos

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Meta Graph API (templates)                       │
│  graph.facebook.com/v21.0/{waba_id}/message_templates                  │
│  - CRUD de templates                                                    │
│  - Webhook de status: APPROVED / REJECTED / PAUSED / DISABLED          │
└───────────────┬─────────────────────────────────┬──────────────────────┘
                │                                  │
                │ direto                           │ webhook
                │                                  │
                ▼                                  ▼
┌──────────────────────────┐         ┌─────────────────────────────────┐
│  metaTemplatesService.js │         │  metaWebhookController.js       │
│  Wrapper da Graph API    │         │  /api/webhooks/meta              │
└──────────────────────────┘         └─────────────────────────────────┘
                │                                  │
                ▼                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  Banco PostgreSQL (cobrança schema)                     │
│  - template_meta              (CRUD local + status sincronizado)       │
│  - meta_webhook_event          (auditoria de eventos Meta)              │
│  - mensagem_whatsapp           (templateMetaId, templateMetaNome,       │
│                                  instanciaTipo)                         │
│  - conversa_cobranca           (instanciaTipo)                          │
│  - instancia_whatsapp_user     (tipo: whatsapp-3c | waba)              │
└────────────────────────────────────────────────────────────────────────┘
                ▲
                │
                │
┌────────────────────────────────────────────────────────────────────────┐
│                          3C Plus Omnichannel                            │
│  app.3c.plus/omni-chat-api/v1/whatsapp                                 │
│  - /chats/open_new_chat                                                 │
│  - /message/send_chat                                                   │
│  - /message/send_template       (envio template — caminho central)     │
│  - /message/send_image, send_voice, send_document                      │
└────────────────────────────────────────────────────────────────────────┘
                ▲
                │ envio + recebimento via Socket.io 24/7
                │
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend (React + TS)                            │
│  - /configuracoes/templates-conversa  (gestão Atalho/Meta unificada)   │
│  - /atendimento/conversas              (tela de conversa)               │
│  - SeletorCanal, BolhaMensagem, InputMensagem, ChatItem                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Cronologia das sprints

### Sprint 1 — Schema + service + controller (`ec33013`)

**Backend foundation.**

- `prisma/schema.prisma`: adicionou modelos `TemplateMeta` (id, metaTemplateId, name, language, category, status, components JSON, variaveisMap JSON, qualityRating, rejectReason, etc.) e `MetaWebhookEvent` (auditoria).
- Migration manual `20260507000000_add_template_meta`.
- `backend/src/services/metaTemplatesService.js`: wrapper da Meta Graph API (`listarRemoto`, `criarRemoto`, `deletarRemoto`, `sincronizarStatus`).
- `backend/src/controllers/templatesMetaController.js`: CRUD local + submeter pra Meta + sincronizar.
- Variáveis de ambiente: `META_API_VERSION`, `META_ACCESS_TOKEN`, `META_BUSINESS_ID`, `META_WABA_ID`, `META_PHONE_NUMBER_ID`, `META_WEBHOOK_VERIFY_TOKEN`.

**Decisão:** usar **System User Token** (permanente) em vez de App Token (expira <24h).

### Sprint 2 — UI gestão unificada (`fc64972`)

`/configuracoes/templates-conversa` agrupa Atalhos rápidos (`TemplateWhatsapp`) + Modelos Meta (`TemplateMeta`) numa tela só. Modal de escolha "+ Novo template" diferencia os dois caminhos. Editor Meta tem 2 colunas (form + preview WhatsApp-like com background pattern).

### Sprint 3 — Webhook Meta + cron de sync (`020c319`)

- `metaWebhookController.js` recebe `message_template_status_update`, `template_category_update`, `message_template_quality_update` da Meta.
- GET `/api/webhooks/meta` para handshake inicial (verify token).
- POST `/api/webhooks/meta` responde 200 imediato, persiste evento bruto em `meta_webhook_event` e processa async.
- Cron a cada 30min chama `sincronizarStatus()` como fallback caso webhook falhe.
- Realtime Socket.io emite atualização para a UI de gestão de templates.

**Aprendizado:** o webhook da Meta exige resposta < 5s. Persistir bruto e processar async garante isso.

### Fix `aefbe41` — 401 da Meta não desloga o user

A Meta podia retornar 401 (token expirado, escopo errado) num GET de templates. Sem tratamento, o frontend interpretava como "user não autenticado" e fazia logout. Fix: backend mapeia 401/403 da Meta para 502 antes de propagar — UI mostra erro de integração externa em vez de quebrar a sessão.

### Sprint 4 — Envio de template no input do agente (`469957b`)

- Endpoint `POST /api/conversas/enviar/template` no backend.
- `SelecionarTemplateMetaModal` no frontend: lista templates aprovados, agrupados por categoria, com preview + form de variáveis (auto-preenchidas com dados do aluno via mapeamento).
- `MensagemWhatsapp.templateMetaId` para tracking.
- Detecção da janela 24h fechada → CTA "Selecione um modelo".

### Sprint 5 — Seletor de canal + badge nos balões (`73d0d63`)

Multi-canal por agente. Adicionado:

- `instancia_whatsapp_user.tipo` (whatsapp-3c | waba)
- `mensagem_whatsapp.instanciaTipo` (denormalizado)
- `conversa_cobranca.instanciaTipo`
- `SeletorCanal.tsx`: dropdown compacto com badges
- Badge nos balões fromMe (depois estendido para !fromMe)

**Mas introduziu vários bugs descobertos depois.** Ver seção 5.

### Pós-Sprint 5 — Refinamento

- `a0ea7d3` ADMIN vê todas as instâncias do sistema (não só as próprias).
- `213062d` Campo `tipo` também no form de edição (não só de criação).
- `a7349d7` **Janela 24h por instância + histórico unificado** (refator estrutural — ver seção 4).
- `8fe0d33` Fix `ReferenceError` no ConversasPage (uso de ref antes de declarar).
- `ffa9c4d` "Iniciar via WABA" abre modal automaticamente.
- `94b8a2b` Eliminado `abrirChatNovo` do fluxo WABA — `send_template` no chat existente é o caminho.
- `991ad50` → `733c717` → `e06f8c2` Descoberta do payload correto da 3C Plus (ver seção 5).
- `5f6ec05` Bolha de template exibe corpo resolvido + nome do template.
- `f2ca633` Envio respeita a instância escolhida no seletor (bug de roteamento).
- `fd12484` WABA padrão + memória de última escolha + pré-escuta áudio + lookup defensivo de tipo.
- `3d816a5` Áudio com mimetype real (webm) — em investigação.

---

## 4. Decisões arquiteturais importantes

### 4.1. Histórico unificado por aluno (não por chat)

A 3C Plus gera `chatId` distinto por (instância, contato). Inicialmente cada `ConversaCobranca` (chave `chatId`) era exibida como item separado — agente via 2 cards do mesmo aluno (um WhatsApp 3C+ e outro WABA, se existissem).

**Solução adotada (`a7349d7`)**: lista agrupa por aluno (`pessoaCodigo` ou `contatoNumero`), mostrando 1 item com badges múltiplos. Ao abrir, o backend retorna mensagens de **todas** as conversas-irmãs do mesmo aluno em ordem cronológica, com cada balão carregando seu `instanciaTipo`.

Backend `obter` em `conversaCobrancaController.js`:

```js
const irmas = await prisma.conversaCobranca.findMany({
  where: conversa.pessoaCodigo
    ? { pessoaCodigo: conversa.pessoaCodigo }
    : { contatoNumero: conversa.contatoNumero },
  ...
});
const chatIds = irmas.map(c => Number(c.chatId));
const mensagens = await prisma.mensagemWhatsapp.findMany({
  where: { chatId: { in: chatIds } },
  ...
});
res.json({ data: { conversa, mensagens, conversasIrmas: irmas } });
```

Listar agrupa via `Map` no controller (DISTINCT ON em Prisma é limitado).

### 4.2. Janela 24h calculada localmente (frontend)

Antes: o frontend usava `conversaAtiva.ultimaMensagemCliente` — campo da `ConversaCobranca`, sem distinção de canal. Com seletor permitindo trocar canal, o cálculo ficava errado: cliente respondia 3C+ → janela WABA aparecia "aberta" indevidamente.

**Solução**: filtrar mensagens já carregadas (já vêm unificadas) por `instanciaTipo === 'waba' && fromMe === false` e pegar `Max(timestamp)`.

```tsx
const ultimaMsgWabaClienteMs = useMemo(() => {
  if (!ehWaba) return 0;
  let max = 0;
  for (const m of mensagens) {
    if (!m.fromMe && m.instanciaTipo === 'waba') {
      max = Math.max(max, m.timestamp * 1000);
    }
  }
  return max;
}, [mensagens, ehWaba]);
const janelaFechada = ehWaba && (Date.now() - ultimaMsgWabaClienteMs > 24h);
```

Sempre correto, sem depender de qual conversa é a "primária".

### 4.3. Sem criação de chat WABA paralelo

A 3C Plus não permite criar 2 chats com o mesmo número em instâncias diferentes via `/chats/open_new_chat`. Quando o número já tem chat, retorna o existente ignorando `instance_id`.

**Solução**: aceitar 1 `chatId` por contato. Para enviar pela WABA num chat originalmente 3C+, basta passar `instance_id` da WABA no body do `send_template` ou `send_chat` — a 3C Plus rotea pela instância indicada (não pela primária do chat). Validado: response retorna `instance.type: "waba"` quando é roteado.

`abrirChatNovo` ficou apenas para o botão `+` (aluno sem nenhum chat ainda).

### 4.4. WABA como padrão + memória da última escolha

Risco identificado: agente trocar canal e esquecer de voltar, causando aluno receber mensagens de dois números diferentes.

**Solução (`fd12484`)**: chave `instancia_preferida_<userId>` no localStorage. Prioridade ao abrir conversa:

1. Última escolha salva (se ainda na lista)
2. WABA disponível (default conservador — fora da janela exige template)
3. Instância da conversa
4. Primeira da lista

Toda troca grava. Default WABA é mais conservador que 3C+ porque força template fora da janela em vez de "vazar" texto livre pelo canal não oficial.

### 4.5. `instanciaTipoOverride` defensivo na persistência

A 3C Plus retorna `sent.instance.type` baseado na instância **primária** do chat, não na usada para enviar. Quando agente envia template/texto pela WABA num chat originalmente 3C+, `sent.instance.type` vem `whatsapp-3c` mesmo sendo enviado via WABA.

**Solução**: backend faz lookup do `tipo` real da instância em `instancia_whatsapp_user.tipo` baseado no `instance_id` do request, e força via `instanciaTipoOverride` no `persistirMensagemEnviada`. Aplicado em `enviarTexto`, `enviarTemplate`, `enviarImagem`, `enviarAudio`, `enviarDocumento`.

```js
async function lookupInstanciaTipo(instanceId) {
  if (!instanceId) return null;
  const inst = await prisma.instanciaWhatsappUser.findFirst({
    where: { instanciaId: instanceId },
    select: { tipo: true },
  });
  return inst?.tipo || null;
}
```

### 4.6. ADMIN vê todas as instâncias

`listarInstanciasUser` no controller: se `req.user.role === 'ADMIN'`, retorna `findMany({ distinct: ['instanciaId'] })`. Outros roles continuam recebendo só as próprias. Permite admin testar/validar sem cadastrar manualmente.

### 4.7. Bolha de template renderiza igual texto livre

Versão original tinha um quadrado cinza interno indicando "Template" — visualmente ruim na bolha verde. Mudança: corpo de template renderiza igual texto, e o badge "Template: <nome>" + badge "WABA" aparecem **acima** da bolha. UX limpa, mantém todas as informações.

```tsx
{(tipo === 'chat' || tipo === 'template') && corpo && (
  <p className="...">{corpo}</p>
)}
```

---

## 5. Bugs descobertos da 3C Plus / Meta

### 5.1. `send_template` exige `body_variables`, não `body`

**Erro**: 400 genérico "O recurso solicitado não foi processado".

A 3C Plus **não aceita** `body` com texto resolvido. Aceita `body_variables` (array ordenado pelos índices `{{1}}, {{2}}, ...`). Ela mesma resolve antes de mandar pra Meta.

```js
// CORRETO
{
  chat_id: 5201123,                    // numérico, não string
  instance_id: "...waba...",
  template_id: "1663217384558820",
  template_name: "mensagem_universal_eloi",
  template_language: "pt_BR",
  body_variables: ["Eloi"],            // array ordenado
  tempTime: 1778172923                 // unix segundos
}
```

Implementado em `enviarTemplate` no backend: extrai índices via regex `/\{\{\s*(\d+)\s*\}\}/g`, ordena, mapeia para `body_variables`.

### 5.2. `chat_id` precisa ser numérico

String dá 400 sem detalhe. Backend converte com `Number(chat_id)` antes de enviar.

### 5.3. `send_template` resposta tem `body: null`

A 3C Plus armazena o conteúdo em `waba_template_data.components[0].text` com `{{1}}` cru. Para a UI exibir o corpo, o backend resolve localmente as variáveis e passa via `extras.corpoOverride` para `persistirMensagemEnviada`. Também adiciona `templateMetaNome` denormalizado em `mensagem_whatsapp` (campo novo, migration `20260507180000_add_template_meta_nome_mensagem`).

### 5.4. `open_new_chat` ignora `instance_id` se contato já tem chat

Documentado em 4.3. Implicação: não dá para criar chat WABA paralelo a um chat 3C+ existente. Solução é passar `instance_id` no `send_template` direto.

### 5.5. `instance.type` no response não reflete a instância usada

Documentado em 4.5. Solução é o lookup defensivo no banco.

### 5.6. ReguaWorker / DeltaSync indisponibilidade pontual do Cloud SQL

Em produção (Railway) tivemos um período de erros `Can't reach database server at 35.199.101.38:5432`. Coincidiu com restart de container. Causas possíveis: maintenance Cloud SQL, limite de conexões, IP do Railway mudou após restart. Se voltar: checar painel do Cloud SQL (status, conexões, authorized networks).

### 5.7. Áudio WABA — investigação aberta

Áudio gravado pelo MediaRecorder em Chrome/Firefox é `audio/webm;codecs=opus`. Renomear para `audio/ogg` (apenas a label do Blob) faz a 3C Plus aceitar (HTTP 200) mas a Meta WABA pode rejeitar silenciosamente — response da 3C Plus retorna `size: 0` e o aluno não recebe.

**Tentativa atual (`3d816a5`)**: enviar com mimetype real (`audio/webm`) e deixar a 3C Plus / Meta lidar. Pendente: validar se WABA aceita webm. Se não, próximo passo é converter para ogg/opus de verdade no browser (`opus-recorder` ou `ffmpeg-wasm`).

---

## 6. Pré-setup operacional

Realizado uma única vez por André:

1. **System User Token na Meta**:
   - Business Manager → Settings → Users → System Users → Add
   - Nome: `cobranca-api-bot`, Role: Admin
   - Permissões: `whatsapp_business_management` + `whatsapp_business_messaging`
   - Token gerado vira `META_ACCESS_TOKEN` no `.env`.

2. **Webhook configurado** no painel Meta:
   - Callback URL: `https://api-cobranca.lmedu.com.br/api/webhooks/meta`
   - Verify token: `lm_meta_webhook_2026_xPq9aZkR3vT`
   - Subscrições: `message_template_status_update`, `template_category_update`, `message_template_quality_update`.

3. **Vinculação de instâncias** em `instancia_whatsapp_user`:
   - Eloí (userId=2) tem 3 instâncias: 1 WhatsApp castro teste (tipo=null legado), 1 WhatsApp Eloí (whatsapp-3c, `efcb1751...`), 1 WABA Cobrança Oficial (waba, `3fa23e60...`).
   - ADMINs veem todas via lookup distinct no controller.

---

## 7. Fluxo de uso final (validado)

### 7.1. Agente envia template Meta (primeira mensagem WABA do aluno)

1. Tela `/atendimento/conversas`, abre conversa do aluno (chat 3C+ existente).
2. Seletor já em WABA por padrão (preferência salva).
3. Janela 24h fechada (cliente nunca respondeu via WABA).
4. CTA "Selecione um modelo de mensagem" aparece (verde).
5. Click → `SelecionarTemplateMetaModal` abre → escolhe template + preenche variáveis.
6. Click "Enviar agora" → `POST /api/conversas/enviar/template` com `chat_id` numérico (do chat 3C+) + `instance_id` WABA + `template_id`/`template_name`/`template_language` + `body_variables` + `tempTime`.
7. Backend chama 3C Plus → 3C Plus chama Meta → Meta envia.
8. Backend persiste `mensagem_whatsapp` com `tipo='template'`, `templateMetaId`, `templateMetaNome`, `instanciaTipo='waba'` (override), `corpo` resolvido localmente.
9. Realtime emite, balão aparece com badge "Template: <nome>" + badge WABA.

### 7.2. Aluno responde via WABA

1. Worker Socket.io 24/7 recebe `new-message-whatsapp` da 3C Plus.
2. `whatsappHandler.js` persiste `mensagem_whatsapp` com `instanciaTipo='waba'` (vem no payload).
3. `upsertConversa` atualiza `conversa_cobranca.instanciaTipo='waba'` (se diferente).
4. Realtime emite. Frontend adiciona ao histórico unificado.
5. Recalcula `ultimaMsgWabaClienteMs` — janela WABA reabre.
6. Input volta ao modo de digitação livre.

### 7.3. Agente envia texto livre via WABA (janela aberta)

1. Digita no textarea, clica enviar.
2. `handleEnviar` em InputMensagem: `instIdRoteado = instanciaSelecionada` (WABA), `chatIdRoteado = irmaSelecionada?.chatId ?? chatId` (chat ativo).
3. `POST /api/conversas/enviar/texto` com `chat_id` + `instance_id` WABA + `body`.
4. Backend lookup tipo WABA, persiste com `instanciaTipo='waba'`.
5. Balão aparece com badge WABA.

### 7.4. Mídia (imagem/áudio/documento)

Igual texto, mas via `enviarImagem` / `enviarAudio` / `enviarDocumento` no backend. Todos aplicam `lookupInstanciaTipo` para badge correto. Áudio passa por modo "preview" no frontend antes do envio (player + descartar/enviar).

---

## 8. Files-chave

### Backend

| Caminho | Responsabilidade |
|---|---|
| `backend/prisma/schema.prisma` | Modelos `TemplateMeta`, `MetaWebhookEvent`, `MensagemWhatsapp` (+ campos waba), `ConversaCobranca` (+ instanciaTipo), `InstanciaWhatsappUser` (+ tipo) |
| `backend/src/services/metaTemplatesService.js` | Wrapper Meta Graph API |
| `backend/src/controllers/templatesMetaController.js` | CRUD templates Meta |
| `backend/src/controllers/metaWebhookController.js` | Listener webhook Meta |
| `backend/src/controllers/conversasController.js` | `enviarTemplate`, `enviarTexto`, `enviarImagem/Audio/Documento`, `lookupInstanciaTipo`, `persistirMensagemEnviada` |
| `backend/src/controllers/conversaCobrancaController.js` | `obter` (mensagens unificadas + irmas), `listar` (agrupado por aluno) |
| `backend/src/controllers/usersController.js` | `listarInstanciasUser` (ADMIN distinct), `adicionarInstancia`, `editarInstancia` (com `tipo`) |
| `backend/src/workers/handlers/whatsappHandler.js` | Persiste `instanciaTipo` em mensagens recebidas via socket |
| `backend/src/services/conversaCobrancaService.js` | `upsertConversa` atualiza `instanciaTipo` quando muda |

### Frontend

| Caminho | Responsabilidade |
|---|---|
| `src/pages/TemplatesConversaPage.tsx` | Lista unificada Atalhos + Meta |
| `src/pages/TemplateMetaEditorPage.tsx` | Editor 2 colunas (form + preview) |
| `src/pages/ConversasPage.tsx` | Estado de conversa, histórico unificado, preferência de instância (localStorage), realtime cross-chat |
| `src/components/conversas/InputMensagem.tsx` | Modos: digitação livre / template / preview áudio / gravação. Cálculo da janela 24h via mensagens locais |
| `src/components/conversas/SelecionarTemplateMetaModal.tsx` | Modal de seleção + preenchimento de variáveis |
| `src/components/conversas/SeletorCanal.tsx` | Dropdown de canal |
| `src/components/conversas/BolhaMensagem.tsx` | Render do balão + badges (template, canal) |
| `src/components/conversas/ChatItem.tsx` | Item da lista com badges múltiplos |
| `src/components/configuracoes/UsuarioDrawer.tsx` | CRUD de instâncias por usuário (form com select de tipo) |
| `src/types/conversa.ts` | `Mensagem3CPlus.instanciaTipo`, `templateMetaId`, `templateMetaNome`; `ConversaIrma`; `ConversaCobranca.instanciasTipo` |
| `src/services/conversasCobranca.ts` | `obterConversa` retorna `{ conversa, mensagens, conversasIrmas }` |

---

## 9. Pontos abertos / não escopo

- **Áudio WABA**: webm aceito pela Meta? Pendente validar. Se não, converter pra ogg/opus de verdade.
- **Header e Buttons em templates Meta**: editor atual cobre, mas envio só popula `body_variables`. Templates com variáveis no header/botões precisariam de `header_variables` e `buttons_variables` no payload — sprint futura.
- **Migração de mensagens antigas**: as enviadas antes do override defensivo podem ter `instanciaTipo` errado. Aceitamos como legado.
- **Quality rating PAUSED → DISABLED**: monitor visual para o admin. Hoje só status manual.
- **Tracking de eficácia de templates**: `templateMetaId` em `mensagem_whatsapp` permite calcular taxa de resposta por template. Não tem dashboard ainda.
- **Múltiplos números WABA**: a arquitetura suporta (campo `tipo` é por instância), mas o caso de uso é 1 número WABA. Se virar N, validar UX do seletor com lista grande.

---

## 10. Como debugar

### Erro no envio de template

1. Console do backend (Railway): procurar `[3C+ Chat API] send_template payload:` — mostra exatamente o que foi enviado.
2. Logo abaixo: `[3C+ Chat API] send_template falhou: <status> <body>` — resposta da 3C Plus.
3. Se status 400 sem detalhe: provavelmente `chat_id` como string ou faltando algum campo (`tempTime`, `body_variables`).

### Mensagem chega mas badge errado

1. Conferir `mensagem_whatsapp.instanciaTipo` no banco para a mensagem recém-enviada.
2. Se vier `whatsapp-3c` mesmo sendo WABA: `lookupInstanciaTipo` falhou (instância não cadastrada em `instancia_whatsapp_user` ou com `tipo=null`).
3. Editar a instância no UsuarioDrawer e setar o tipo correto.

### Janela 24h calculada errada

1. Abrir DevTools no frontend → Components → InputMensagem.
2. Verificar `mensagens` (ver `instanciaTipo` em cada).
3. `ultimaMsgWabaClienteMs` é calculado via `useMemo` — ver no React DevTools.

### Webhook Meta não chega

1. Painel Meta App → WhatsApp → Configuration → Webhooks → Recent Deliveries.
2. Backend: GET `/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=...&hub.challenge=test` deve retornar `test`.
3. Tabela `meta_webhook_event` mostra eventos recebidos brutos.
4. Cron de fallback (30min) cobre eventuais perdas.

---

## 11. Lições aprendidas

- **Sempre logar o payload e a resposta da 3C Plus antes de tentar adivinhar erros 400 genéricos.** Foi descoberta-chave para o `body_variables`.
- **Limitações da 3C Plus não documentadas claramente**: `chat_id` numérico, `body_variables` obrigatório, `instance.type` no response divergente da instância usada. Aprender testando.
- **Schema `chatId` único**: virou herança de design — em vez de criar conversas paralelas por instância, escolhemos histórico unificado por aluno. Funciona melhor para a UX e respeita a limitação da 3C Plus.
- **Meta WABA é mais rigorosa que 3C+**: aceita HTTP 200 mas pode rejeitar silenciosamente conteúdo malformado (caso do áudio com mimetype errado, `size: 0`).
- **`localStorage` é suficiente para preferência por user**: evita migração de schema e mantém UX responsiva.
- **`instanciaTipoOverride` é defensivo crítico**: a fonte da verdade pra qual canal foi usado é a `instance_id` que enviamos, não o que a 3C Plus retorna. Lookup local resolve.
- **Plan mode + commits pequenos por feature**: cada bug ou feature isolada virou um commit, facilitando revisão e rollback. Histórico ficou legível.
