# 3C Plus Omnichannel API — Endpoints Completos

> Extraido da colecao Postman oficial. Base URL Omni API: `https://app.3c.fluxoti.com/omni-api/v1/whatsapp/`
> Base URL Omni Chat API (nova): `https://app.3c.plus/omni-chat-api/v1/whatsapp/`
> Auth: `?api_token={TOKEN}` (Omni API) ou `Bearer {TOKEN}` (Omni Chat API)

---

## Descoberta: DUAS APIs

A 3C Plus tem **duas APIs Omnichannel** — uma legada e uma nova:

| API | Base URL | Auth | Nota |
|-----|----------|------|------|
| **Omni API** (legada) | `app.3c.fluxoti.com/omni-api/v1` | `?api_token=` | Muitos endpoints marcados DEPRECATED |
| **Omni Chat API** (nova) | `app.3c.plus/omni-chat-api/v1` | `Bearer token` | API atual, endpoints sem DEPRECATED |

### Descoberta: WABA existe!

No response do `/transfer/list` da Omni Chat API, uma instancia tem `"type": "waba"`. Confirmado: **a 3C Plus suporta tanto `whatsapp-3c` quanto `waba`** como tipos de instancia.

---

## 1. AGENTS (Agentes)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/agent/ping` | Ping do agente (keepalive) |
| GET | `/agents` | Listar todos os agentes WhatsApp |
| GET | `/team/agents` | Agentes da equipe com GroupChannel |

---

## 2. CHATS (Conversas)

### Listagem de chats

| Metodo | Endpoint | Descricao | API |
|--------|----------|-----------|-----|
| GET | `/chats/all` | Todos os chats (in_progress + queue + snooze + groups) | Omni |
| GET | `/chats` | Chats do agente (paginado) | Omni |
| GET | `/chats/queue` | Chats na fila (sem agente) | Ambas |
| GET | `/chats/in_progress` | Chats em andamento | Ambas |
| GET | `/chats/in_snooze` | Chats em snooze | Ambas |
| GET | `/chats/in_chatbot` | Chats no chatbot | Chat API |
| GET | `/chats/finished/all` | Chats finalizados | Ambas |
| GET | `/chats/history` | Historico de chats (filtros: team_id, instance_id, agent_id, number) | Omni |
| GET | `/chats/:chatId` | Chat por ID | Ambas |
| GET | `/chats/:chatId/history` | Historico de um chat especifico | Omni |
| GET | `/chats/:chatId/protocols` | Protocolos de atendimento do chat | Chat API |
| GET | `/chats/groups` | Chats de grupo | Ambas |
| GET | `/chats/contact/:contactId/instance/:instanceId` | Chat por contato e instancia | Chat API |
| GET | `/chats/unread_and_warnings` | Contadores de nao lidos e alertas | Chat API |
| GET | `/chats/verify-notified-chats` | Verificar chats notificados | Chat API |

### Acoes em chats

| Metodo | Endpoint | Body | Descricao |
|--------|----------|------|-----------|
| POST | `/chats/open_new_chat` | `{ number, instance_id }` | Abrir novo chat |
| POST | `/chats/accept_queue/:chatId` | — | Aceitar chat da fila |
| POST | `/chats/:chatId/finish` | `{ qualification, qualification_note }` | Finalizar chat com qualificacao |
| POST | `/chats/:chatId/transfer` | `{ instance_id }` | Transferir chat |
| POST | `/chats/:chatId/snooze` | `{ end_snooze: "2025-01-19 20:00:00" }` | Adiar chat (snooze) |
| PUT | `/chats/:chatId/unread` | — | Marcar como lido (zerar unread) |

### Transferencias em massa

| Metodo | Endpoint | Body | Descricao |
|--------|----------|------|-----------|
| POST | `/agent_transfer_chats/agent/:agentId` | `{ team_ids, internal_note }` | Transferir todos os chats do agente para equipes |
| POST | `/agent_transfer_chats/team/:teamId/agent/:agentId` | `{ user_id }` | Transferir chats por instancia |
| GET | `/chats/transfer/list` | — | Lista de agentes e instancias para transferencia |

### Finalizar em massa

| Metodo | Endpoint | Body | Descricao |
|--------|----------|------|-----------|
| POST | `/finish_agent_chats/agent/:agentId` | `{ qualification, qualification_note }` | Finalizar todos os chats do agente |

### Grupos

| Metodo | Endpoint | Body | Descricao |
|--------|----------|------|-----------|
| GET | `/chats/groups` | — | Listar grupos |
| GET | `/chats/group/participants` | `{ instance_id, id }` | Participantes do grupo |
| GET | `/chats/group/:groupId/agents` | — | Agentes responsaveis pelo grupo |
| POST | `/chats/group/:groupId/responsible` | `{ agents: [10, 11] }` | Definir agentes responsaveis |
| DELETE | `/chats/group/:groupId` | — | Remover grupo |

---

## 3. MESSAGES (Mensagens)

### Envio de mensagens

| Metodo | Endpoint | Body/FormData | Descricao |
|--------|----------|---------------|-----------|
| POST | `/message/send_chat` | `{ chat_id, body, instance_id }` | Enviar texto |
| POST | `/message/send_image` | FormData: `chat_id, image (file), caption, instance_id` | Enviar imagem |
| POST | `/message/send_voice` | FormData: `chat_id, audio (.ogg), instance_id` | Enviar audio (voz/PTT) |
| POST | `/message/send_audio` | FormData: `chat_id, audio (.mp3/.ogg), instance_id` | Enviar audio (arquivo) |
| POST | `/message/send_video` | FormData: `chat_id, video (.mp4/.mov), caption, instance_id` | Enviar video |
| POST | `/message/send_document` | FormData: `chat_id, file, caption, instance_id` | Enviar documento |
| POST | `/message/send_internal_chat` | `{ chat_id, body }` | Mensagem interna (nao vai pro WhatsApp) |
| POST | `/message/send_template` | `{ chat_id, body, instance_id, template_id, template_language, template_name }` | Enviar template WABA |
| POST | `/message/forward_message` | `{ chat_ids: [id1, id2], message_id, instance_id }` | Encaminhar mensagem |

### Consulta de mensagens

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/message/:chatId` | Mensagens do chat ativo (protocolo atual) |
| GET | `/message/:chatId/history` | Todas as mensagens incluindo historico |
| GET | `/chats/:chatId/messages` | Mensagens por chat ID (Omni API) |
| GET | `/message/:number/history` | Historico de mensagens por numero |
| POST | `/message/search` | Buscar mensagens (body: `{ instance_id, search, per_page, chat_id }`) |

### Gerenciamento

| Metodo | Endpoint | Body | Descricao |
|--------|----------|------|-----------|
| DELETE | `/message/delete` | `{ message_id, chat_id }` | Deletar mensagem |

### IA (OpenAI)

| Metodo | Endpoint | Body | Descricao |
|--------|----------|------|-----------|
| POST | `/message/improve` | `{ instance_id, message, instructions }` | Melhorar texto com IA |
| POST | `/message/suggest` | `{ instance_id, chat_id, latest, temperature }` | Sugerir resposta com IA |

---

## 4. CONTACTS (Contatos)

| Metodo | Endpoint | Body | Descricao |
|--------|----------|------|-----------|
| GET | `/contacts` | — | Listar todos os contatos |
| GET | `/contacts/:contactId` | — | Contato por ID |
| PUT | `/contacts/:contactId` | `{ name_alias }` | Atualizar contato |
| POST | `/contacts/check_contacts` | `{ phones: [num], instance_id }` | Verificar se numeros tem WhatsApp |
| POST | `/contacts/:contactId/block` | — | Bloquear contato |
| POST | `/contacts/:contactId/unblock` | — | Desbloquear contato |

---

## 5. INSTANCES (Canais/Instancias)

| Metodo | Endpoint | Body | Descricao |
|--------|----------|------|-----------|
| GET | `/instances` | — | Listar todas as instancias |
| GET | `/instances/:instanceId` | — | Instancia por ID |
| POST | `/instance` | `{ name, first_connection, group_channel_id, team_id }` | Criar instancia |
| PUT | `/instance/:instanceId` | `{ name, team_id, max_time_* }` | Atualizar instancia |
| PUT | `/instance/:instanceId/reconnect` | — | Reconectar instancia |
| POST | `/instance/:instanceId/disconnect` | — | Desconectar instancia |
| DELETE | `/instance/:instanceId` | — | Deletar instancia |
| GET | `/instance/:instanceId/qrcode` | — | QR Code para conectar WhatsApp |
| GET | `/instance/:instanceId/status` | — | Status da instancia (connected/disconnected/qr) |
| GET | `/instances/dashboard/:instanceId` | — | Dashboard com metricas da instancia |
| POST | `/instance/check_contact_number` | `{ phone }` | Verificar numero em qual instancia |

---

## 6. GROUP CHANNELS (Grupos de Canais)

| Metodo | Endpoint | Body | Descricao |
|--------|----------|------|-----------|
| GET | `/group-channel/:id` | — | Group Channel por ID |
| GET | `/group-channel/team/:teamId` | — | Group Channels por equipe |
| POST | `/group-channel` | `{ name, company_id, team_id, qualification_list_id, color, whatsapp }` | Criar |
| PUT | `/group-channel/:id` | `{ name, team_id, ... }` | Atualizar |
| DELETE | `/group-channel/:id` | — | Deletar |
| POST | `/group-channel/:id/config` | `{ max_time_*, snooze_time, office_hour_id }` | Configurar estrategia |

### Dashboard

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/dashboard` | Dashboard geral (todas metricas + agentes) |
| GET | `/group-channel/dashboard/:id` | Metricas por Group Channel |
| GET | `/group-channel/dashboard/instance/:instanceId` | Metricas por instancia |

### Quick Messages (Respostas rapidas)

| Metodo | Endpoint | Body | Descricao |
|--------|----------|------|-----------|
| GET | `/group-channel/:id/quick-messages` | — | Listar respostas rapidas |
| POST | `/group-channel/quick-message` | `{ shortcut, message, group_channel_id }` | Criar (ex: /hello) |
| PUT | `/group-channel/quick-message/:id` | `{ shortcut, message }` | Atualizar |
| DELETE | `/group-channel/quick-message/:id` | — | Deletar |

### Tags de Contato

| Metodo | Endpoint | Body | Descricao |
|--------|----------|------|-----------|
| GET | `/group-channel/:id/contact-tags` | — | Listar tags |
| POST | `/group-channel/:id/contact-tags` | `{ name, color }` | Criar tag |
| PUT | `/group-channel/:id/contact-tags/:tagId` | `{ name, color }` | Atualizar |
| DELETE | `/group-channel/:id/contact-tags/:tagId` | — | Deletar |

---

## 7. TEAMS (Equipes)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/teams` | Listar equipes WhatsApp |

---

## 8. CHATBOT

| Metodo | Endpoint | Body | Descricao |
|--------|----------|------|-----------|
| GET | `/chatbot` | — | Listar chatbots |
| GET | `/chatbot/:id` | — | Chatbot por ID |
| POST | `/chatbot` | `{ name, initial_trigger, ending_trigger, time_to_end_chat, default_error_message }` | Criar |
| PUT | `/chatbot/:id` | Mesmo body | Atualizar |
| DELETE | `/chatbot/:id` | — | Deletar |
| GET | `/chatbot/metrics` | — | Metricas do chatbot |

### Chatbot Actions

| Metodo | Endpoint | Body | Descricao |
|--------|----------|------|-----------|
| GET | `/chatbot/actions/:id` | — | Acao por ID |
| POST | `/chatbot/actions` | `{ type, text_content, chatbot_id, multiple_choice_items }` | Criar acao |
| PATCH | `/chatbot/actions/:id` | `{ text_content, ... }` | Atualizar |
| DELETE | `/chatbot/actions/:id` | — | Deletar |
| POST | `/chatbot/actions/sync/action/:firstId/with/:nextId` | — | Sincronizar acoes (ligar fluxo) |

---

## 9. REPORTS (Relatorios)

| Metodo | Endpoint | Query Params | Descricao |
|--------|----------|-------------|-----------|
| GET | `/reports/chats` | `page, per_page, start_date, end_date, group_channel_ids, agents_ids, number, instance_id, status, qualification, protocol_number, transferred` | Relatorio completo de chats |

---

## 10. COMPANIES (Administracao)

| Metodo | Endpoint | Body | Descricao |
|--------|----------|------|-----------|
| PUT | `/companies/:id/whatsapp-licenses/change` | `{ whatsapp_licenses }` | Alterar licencas WhatsApp |
| PUT | `/companies/:id/whatsapp-max-concurrent-logins/change` | `{ whatsapp_max_concurrent_logins }` | Alterar logins simultaneos |

---

## Resumo: Endpoints essenciais para o CRM

### Para construir a tela de Conversas

| Prioridade | Endpoint | Uso |
|------------|----------|-----|
| P0 | `GET /chats/queue` | Lista de chats na fila |
| P0 | `GET /chats/:chatId/messages` | Mensagens do chat |
| P0 | `POST /message/send_chat` | Enviar texto |
| P0 | `POST /chats/accept_queue/:chatId` | Aceitar chat |
| P0 | `POST /chats/open_new_chat` | Iniciar conversa |
| P1 | `POST /message/send_image` | Enviar imagem |
| P1 | `POST /message/send_voice` | Enviar audio |
| P1 | `POST /message/send_document` | Enviar documento |
| P1 | `POST /chats/:chatId/finish` | Finalizar chat |
| P1 | `POST /chats/:chatId/transfer` | Transferir chat |
| P1 | `PUT /chats/:chatId/unread` | Marcar como lido |
| P2 | `POST /chats/:chatId/snooze` | Adiar chat |
| P2 | `POST /message/send_internal_chat` | Nota interna |
| P2 | `GET /group-channel/:id/quick-messages` | Respostas rapidas |
| P2 | `POST /message/forward_message` | Encaminhar |
| P3 | `POST /message/improve` | IA: melhorar texto |
| P3 | `POST /message/suggest` | IA: sugerir resposta |
| P3 | `POST /message/send_template` | Template WABA |

### Socket.io (tempo real)
- `new-message-whatsapp` — receber mensagens em tempo real (ja documentado em socket_events.md)
