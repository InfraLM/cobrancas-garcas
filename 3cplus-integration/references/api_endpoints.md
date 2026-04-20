# 3C Plus API V1 — Endpoints Completos

> Total: 159 endpoints organizados por categoria. Os endpoints mais usados para o sistema de cobrança estão marcados com destaque. Autenticação via query parameter `?api_token={TOKEN}` em todos os endpoints.

---

## Domínios

| Domínio | Base URL | Uso |
|---|---|---|
| **Discador** | `https://{subdominio}.3c.plus/api/v1` | Campanhas, agentes, chamadas, mailing |
| **Click2Call** | `https://3c.fluxoti.com/api/v1` | Exclusivamente `/click2call` |
| **Omnichannel** | `https://app.3c.fluxoti.com/omni-api/v1/whatsapp/` | WhatsApp |

---

## Endpoints Mais Usados (Sistema de Cobrança)

### Agentes

| Endpoint | Método | Token | Descrição |
|---|---|---|---|
| **`/agent/login`** | POST | Agente | Logar na campanha. Body: `campaign={id}` |
| **`/agent/logout`** | POST | Agente | Deslogar da campanha |
| **`/agent/call/{call-id}/qualify`** | POST | Agente | Qualificar chamada. Body: `qualification_id={id}` |
| **`/agent/call/{call-id}/hangup`** | POST | Agente | Desligar chamada ativa |
| `/agent/campaigns` | GET | Agente | Listar campanhas do agente |
| `/agent/loggedCampaign` | GET | Agente | Campanha logada atualmente |
| `/agent/status` | GET | Agente | Status atual do agente |
| **`/click2call`** | POST | **Gestor** | Iniciar Click2Call. Body: `extension={ext}&phone={num}` |
| `/agents/status` | GET | Gestor | Status de todos os agentes |
| `/agents/online` | GET | Gestor | Agentes logados |
| `/agents/{agent-id}/logout` | POST | Gestor | Deslogar outro agente |

### Campanhas e Mailing

| Endpoint | Método | Descrição |
|---|---|---|
| `/campaigns` | GET | Listar campanhas |
| **`/campaigns/{id}/lists`** | GET | Listar listas de mailing |
| **`/campaigns/{id}/lists`** | POST | Criar nova lista |
| **`/campaigns/{id}/lists/{list-id}/mailing.json`** | POST | Adicionar contatos via JSON |
| **`/campaigns/{id}/mailing`** | POST | Upload CSV com contatos |
| **`/campaigns/{id}/mailing/delete`** | DELETE | Remover contatos |
| `/campaigns/{id}/agents` | GET | Listar agentes da campanha |
| `/campaigns/{id}/agents` | POST | Adicionar agentes à campanha |

### Chamadas e Gravações

| Endpoint | Método | Descrição |
|---|---|---|
| **`/calls`** | GET | Relatório de chamadas (com filtros) |
| `/calls/{call-id}` | GET | Detalhes de uma chamada |
| **`/calls/{call-id}/recording`** | GET | Download da gravação |
| `/calls/{call-id}/recording_amd` | GET | Download da gravação AMD |
| `/calls/csv` | GET | Exportar relatório CSV |

### WhatsApp (Omnichannel)

| Endpoint | Método | Descrição |
|---|---|---|
| **`/message/send_chat`** | POST | Enviar mensagem WhatsApp |
| `/me` | GET | Dados da empresa (inclui instâncias) |

### Autenticação

| Endpoint | Método | Descrição |
|---|---|---|
| `/authenticate` | POST | Autenticar e obter token |

---

## Lista Completa por Categoria

### Agents (37 endpoints)

- `GET /agent/calls` — Histórico de chamadas do agente
- `POST /agent/login` — Login na campanha
- `POST /agent/webphone/login` — Login no webphone
- `POST /agent/logout` — Logout da campanha
- `POST /agent/connect` — Conectar agente
- `POST /agent/work_break/{work-break-id}/enter` — Entrar em intervalo
- `POST /agent/work_break/exit` — Sair do intervalo
- `POST /agent/manual_call/enter` — Entrar modo manual
- `POST /agent/manual_call/dial` — Discar manualmente
- `POST /agent/manual_call/{call-id}/qualify` — Qualificar chamada manual
- `POST /agent/manual_call/exit` — Sair modo manual
- `POST /agent/manual_call_acw/enter` — Entrar modo manual TPA
- `POST /agent/manual_call_acw/dial` — Discar manual em TPA
- `POST /agent/manual_call_acw/exit` — Sair modo manual TPA
- `POST /agent/call/{call-id}/qualify` — Qualificar chamada
- `POST /agent/call/{call-id}/hangup` — Desligar chamada
- `GET /agent/campaigns` — Campanhas do agente
- `GET /agent/work_break_intervals` — Intervalos da campanha logada
- `PUT /agents/{user-id}/work_break` — Alterar intervalo do agente
- `GET /agent/schedules` — Agendamentos expirados
- `GET /agents` — Listar todos os agentes
- `GET /agents/status` — Status de todos os agentes
- `GET /agents/online` — Agentes online
- `POST /agents/{agent-id}/logout` — Deslogar outro agente
- `GET /agent/statistics` — Estatísticas de chamadas conectadas
- `GET /agents/statistics/by_agent` — Estatísticas por agente
- `GET /agents/statistics/by_agent/csv` — Estatísticas por agente CSV
- `GET /qualification/statistics` — Estatísticas de qualificação
- `GET /agents/login_history` — Histórico de login
- `POST /agent/consult` — Iniciar consulta
- `POST /agent/consult/queue` — Consulta para fila receptiva
- `POST /agent/consult/cancel` — Cancelar consulta
- `POST /agent/consult/exit` — Sair da consulta
- `POST /agent/consult/transfer` — Transferir chamada
- `POST /click2call` — Iniciar Click2Call (token gestor)
- `POST /spy/{agent-id}/start` — Espionar agente
- `DELETE /spy/stop` — Parar espionagem

### Auth (1 endpoint)

- `POST /authenticate` — Autenticar e receber token

### Callbacks (1 endpoint)

- `GET /callbacks` — Listar callbacks da empresa

### Calls (11 endpoints)

- `GET /calls` — Relatório de chamadas
- `GET /calls/total` — Relatório total
- `GET /calls/csv` — Exportar CSV
- `GET /calls/receptive` — Chamadas receptivas ativas
- `GET /calls/{call-id}` — Detalhes de uma chamada
- `GET /calls/{call-id}/recording` — Download gravação
- `GET /calls/{call-id}/recording_amd` — Download gravação AMD
- `GET /calls/{call-id}/recording_consult` — Download gravação consulta
- `GET /calls/{call-id}/recording_transfer` — Download gravação transferência
- `GET /records/{year}/{month}/{day}` — Download ZIP de gravações do dia
- `GET /calls/sid/{sid}` — Buscar chamada por SID

### Campaigns (43 endpoints)

- `GET /agent/loggedCampaign` — Campanha logada
- `GET /campaigns` — Listar campanhas
- `POST /campaigns` — Criar campanha
- `GET /campaigns/{id}` — Detalhes da campanha
- `DELETE /campaigns/{id}` — Deletar campanha
- `PUT /campaigns/{id}` — Atualizar campanha
- `PATCH /campaigns/{id}` — Atualização parcial
- `GET /campaigns/{id}/intervals` — Intervalos da campanha
- `PUT /campaigns/{id}/pause` — Pausar campanha
- `PUT /campaigns/{id}/resume` — Retomar campanha
- `GET /campaigns/{id}/agents` — Agentes da campanha
- `POST /campaigns/{id}/agents` — Adicionar agentes
- `GET /campaigns/{id}/agents/metrics` — Métricas por hora
- `GET /campaigns/{id}/agents/metrics/total` — Métricas totais
- `GET /campaigns/{id}/agents/metrics/total/csv` — Métricas CSV
- `GET /campaigns/{id}/agents/metrics/total_per_time` — Métricas por período
- `GET /campaigns/{id}/agents/status` — Status dos agentes
- `DELETE /campaigns/{id}/agents/{agent-id}` — Remover agente
- `GET /campaigns/{id}/agents/qualifications` — Qualificações por agente
- `GET /campaigns/{id}/agents/qualifications/csv` — Qualificações CSV
- `GET /campaigns/{id}/calls` — Chamadas ativas da campanha
- `GET /campaigns/{id}/lists` — Listas de mailing
- `POST /campaigns/{id}/lists` — Criar lista
- `DELETE /campaigns/{id}/lists` — Deletar todas as listas
- `POST /campaigns/{id}/lists/csv` — Criar lista via CSV
- `GET /campaigns/{id}/lists/metrics` — Métricas das listas
- `GET /campaigns/{id}/lists/qualifications` — Qualificações das listas
- `GET /campaigns/{id}/lists/total_metrics` — Métricas totais
- `DELETE /campaigns/{id}/lists/{list-id}` — Deletar lista
- `POST /campaigns/{id}/mailing` — Upload CSV de mailing
- `POST /campaigns/{id}/lists/{list-id}/mailing` — Inserir mailing na lista
- `DELETE /campaigns/{id}/lists/{list-id}/mailing` — Deletar mailing da lista
- `GET /campaigns/{id}/qualifications` — Estatísticas de qualificação
- `POST /campaigns/{id}/lists/{list-id}/mailing.json` — Inserir mailing via JSON
- `DELETE /campaigns/{id}/mailing/delete` — Deletar mailings da campanha
- `GET /campaigns/{id}/qualifications/total` — Qualificações totais
- `PUT /campaigns/{id}/lists/{list-id}/updateWeight` — Atualizar peso da lista
- `POST /campaigns/{id}/callbacks` — Criar callback
- `DELETE /campaigns/{id}/callbacks/{callback-id}` — Deletar callback
- `GET /campaigns/{id}/schedules` — Agendamentos da campanha
- `GET /campaigns/{id}/statistics` — Estatísticas da campanha
- `GET /qualifications/total` — Qualificações totais (global)
- `GET /qualifications/total/csv` — Qualificações totais CSV

### Companies (3 endpoints)

- `PUT /company/settings` — Atualizar configurações
- `POST /company/generate-bill` — Gerar fatura
- `GET /company/calls` — Chamadas ativas da empresa

### Company Role (1 endpoint)

- `GET /company_role` — Listar roles

### Criterion Lists (10 endpoints)

- `GET /criterion_lists` — Listar listas de critérios
- `POST /criterion_lists` — Criar lista de critérios
- `GET /criterion_list/{id}` — Detalhes da lista
- `GET /criterion_list/{id}/criteria` — Critérios da lista
- `PUT /criterion_lists/{id}` — Atualizar lista
- `DELETE /criterion_lists/{id}` — Deletar lista
- `GET /criterion_lists/{id}/criteria` — Listar critérios
- `POST /criterion_lists/{id}/criteria` — Criar critério
- `PUT /criterion_lists/{id}/criteria/{criterion-id}` — Atualizar critério
- `DELETE /criterion_lists/{id}/criteria/{criterion-id}` — Deletar critério

### Feedbacks (9 endpoints)

- `POST /feedbacks` — Criar feedback
- `PUT /feedbacks` — Atualizar feedback
- `GET /feedbacks/{campaign-id}/{call-history-id}` — Feedback de uma chamada
- `GET /feedbacks/{campaign-id}/total` — Estatísticas de feedback
- `GET /feedbacks/{campaign-id}/agent` — Feedbacks por agente
- `GET /feedbacks/{campaign-id}/agent/stats` — Estatísticas por agente
- `GET /feedbacks/agent/stats` — Estatísticas do agente autenticado
- `GET /feedbacks/{id}` — Feedback por ID
- `GET /feedbacks/{campaign-id}/total/csv` — Estatísticas CSV

### IVR / URA (16 endpoints)

- `PUT /ivr_after_call/{ivr-id}` — Atualizar IVR
- `GET /uras` — Listar URAs
- `POST /uras` — Criar URA
- `GET /uras/{ura-id}` — Detalhes da URA
- `DELETE /uras/{ura-id}` — Deletar URA
- `PUT /uras/{ura-id}` — Atualizar URA
- `GET /ivr_after_call` — Listar IVR pós-chamada
- `POST /ivr_after_call` — Criar IVR pós-chamada
- `GET /ivr_after_call/{ivr-id}` — Detalhes IVR pós-chamada
- `DELETE /ivr_after_call/{ivr-id}` — Deletar IVR pós-chamada
- `GET /ivr_after_call/{id}/criteria` — Critérios do IVR
- `POST /ivr_after_call/{id}/criteria` — Criar critério
- `PUT /ivr_after_call/{id}/criteria/{criterion-id}` — Atualizar critério
- `DELETE /ivr_after_call/{id}/criteria/{criterion-id}` — Deletar critério
- `GET /receptive_ivr` — Listar IVR receptivo
- `POST /receptive_ivr` — Criar IVR receptivo

### Intervals (4 endpoints)

- `POST /work_break_group/{id}/intervals` — Criar intervalo
- `GET /work_break_group/{id}/intervals` — Listar intervalos
- `PUT /work_break_group/{id}/intervals/{interval-id}` — Atualizar intervalo
- `DELETE /work_break_group/{id}/intervals/{interval-id}` — Deletar intervalo

### Office Hours (5 endpoints)

- `GET /office_hours` — Listar horários
- `POST /office_hours` — Criar horário
- `GET /office_hours/{id}` — Detalhes do horário
- `PUT /office_hours/{id}` — Atualizar horário
- `DELETE /office_hours/{id}` — Deletar horário

### Profile (3 endpoints)

- `PUT /me/password` — Alterar senha
- `GET /me` — Dados do usuário autenticado (inclui instâncias WhatsApp)
- `PUT /me` — Editar perfil

### Qualification Lists (6 endpoints)

- `GET /qualification_lists` — Listar listas de qualificação
- `POST /qualification_lists` — Criar lista
- `GET /qualification_list/{id}` — Detalhes da lista
- `PUT /qualification_lists/{id}` — Atualizar lista
- `DELETE /qualification_lists/{id}` — Deletar lista
- `GET /qualification_list/{id}/campaigns` — Campanhas da lista

### Qualifications (4 endpoints)

- `POST /qualification_lists/{id}/qualifications` — Criar qualificação
- `GET /qualification_lists/{id}/qualifications` — Listar qualificações
- `PUT /qualification_lists/{id}/qualifications/{qual-id}` — Atualizar qualificação
- `DELETE /qualification_lists/{id}/qualifications/{qual-id}` — Deletar qualificação

### Receptive Queues (12 endpoints)

- `GET /receptive_queues` — Listar filas receptivas
- `POST /receptive_queues` — Criar fila
- `GET /receptive_queues/active` — Filas ativas
- `GET /receptive_queues/agents` — Filas com agentes
- `GET /receptive_queues/{id}` — Detalhes da fila
- `GET /receptive_queues/{id}/metrics` — Métricas da fila
- `GET /receptive_queues/{id}/metrics/qualifications` — Qualificações da fila
- `PUT /receptive_queues/{id}/metrics/qualifications` — Atualizar fila
- `DELETE /receptive_queues/{id}/metrics/qualifications` — Deletar fila
- `GET /receptive_queues/{id}/calls` — Chamadas da fila
- `GET /receptive_queues/{id}/agents_status` — Status dos agentes
- `GET /receptive_queues/online` — Filas com agentes online

### Receptive Settings (4 endpoints)

- `GET /receptive_number_settings` — Listar configurações
- `POST /receptive_number_settings` — Criar configuração
- `PUT /receptive_number_settings/{did}` — Atualizar configuração
- `DELETE /receptive_number_settings/{did}` — Deletar configuração

### Receptive Metrics (2 endpoints)

- `GET /receptive_metrics` — Métricas por fila
- `GET /total_receptive_metrics` — Métricas totais

### Records (5 endpoints)

- `GET /calls/{call-id}/recording` — Download gravação
- `GET /calls/{call-id}/recording_amd` — Download gravação AMD
- `GET /calls/{call-id}/recording_consult` — Download gravação consulta
- `GET /calls/{call-id}/recording_transfer` — Download gravação transferência
- `GET /records/{year}/{month}/{day}` — Download ZIP do dia

### Routes (3 endpoints)

- `GET /routes` — Listar rotas
- `PUT /routes` — Atualizar rotas
- `GET /routes/{routeId}/hangupCauseReport` — Relatório de causas de desligamento

### Schedules (8 endpoints)

- `GET /schedules` — Listar agendamentos
- `PUT /schedules/{id}` — Atualizar agendamento
- `DELETE /schedules/{id}` — Deletar agendamento
- `GET /schedules/csv` — Exportar CSV

### Teams (5 endpoints)

- `GET /teams` — Listar equipes
- `POST /teams` — Criar equipe
- `GET /teams/{id}` — Detalhes da equipe
- `PUT /teams/{id}` — Atualizar equipe
- `DELETE /teams/{id}` — Deletar equipe

### Users (11 endpoints)

- `GET /users` — Listar usuários
- `POST /users` — Criar usuário
- `GET /users/csv` — Exportar CSV
- `DELETE /users/{user-id}` — Deletar usuário
- `PUT /users/{user-id}` — Atualizar usuário
- `PUT /users/{user-id}/disable` — Desabilitar usuário
- `PUT /users/{user-id}/enable` — Habilitar usuário
- `PUT /users/{user-id}/enable/web_extension` — Habilitar/desabilitar webphone
- `GET /users/{user-id}/deactivate` — Desativar usuário
- `POST /webphone/users` — Criar múltiplos usuários webphone
- `PUT /users/{user-id}/basic-data` — Atualizar dados básicos

### Work Break Groups (5 endpoints)

- `GET /work_break_group` — Listar grupos de intervalo
- `POST /work_break_group` — Criar grupo
- `GET /work_break_group/{id}` — Detalhes do grupo
- `PUT /work_break_group/{id}` — Atualizar grupo
- `DELETE /work_break_group/{id}` — Deletar grupo

### User Data (3 endpoints)

- `GET /user_data` — Listar dados de usuários
- `POST /user_data` — Criar dados
- `PUT /user_data` — Atualizar dados

### Misc (2 endpoints)

- `GET /version` — Versão da aplicação
- `GET /line_of_work` — Listar linhas de trabalho
- `GET /promoter` — Listar promotores
- `GET /agents/status/metrics/total` — Métricas totais de status
