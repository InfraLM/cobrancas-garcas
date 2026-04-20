# Eventos Socket.io da 3C Plus — Documentação Completa

> Todos os 40 eventos disponíveis no Socket.io da 3C Plus, organizados por categoria. Os payloads foram **capturados em ambiente real** com a conta da Liberdade Médica. Para cada evento principal, são fornecidos a interface TypeScript e um exemplo JSON real.

---

## Conexão

```javascript
import io from 'socket.io-client';

const socket = io('https://socket.3c.plus', {
  query: { token: 'SEU_API_TOKEN' },
  transports: ['websocket'],
});
```

---

## Tabela de Status do Agente

| Código | Constante | Descrição |
|---|---|---|
| 0 | STATUS_OFFLINE | Agente offline |
| 1 | STATUS_IDLE | Agente ocioso (pronto) |
| 2 | STATUS_ON_CALL | Em chamada |
| 3 | STATUS_ACW | Em pós-atendimento |
| 4 | STATUS_ON_MANUAL_CALL | Em chamada manual |
| 5 | STATUS_ON_MANUAL_CALL_CONNECTED | Chamada manual conectada |
| 6 | STATUS_ON_WORK_BREAK | Em intervalo |
| 21 | STATUS_ON_MANUAL_CALL_ACW | Chamada manual pós-atendimento |
| 22 | STATUS_MANUAL_CALL_CONNECTED | Chamada manual TPA conectada |

---

## 1. Eventos de Agente (15)

### `agent-is-idle`

Agente ficou ocioso (pronto para receber chamadas). Ocorre após login, pós-qualificação ou pós-manual.

```typescript
interface AgentIsIdleEvent {
  agent: {
    id: number;                    // 193740
    status: number;                // 1 = idle
    status_in_ring_group: null;
    extension_number: number;      // 1011
  };
  queues: any[];
  campaignId: number;              // 233972
  campaignGroupId: null;
  ring_groups: any[];
  socket: null;
}
```

```json
{
  "agent": {
    "id": 193740,
    "status": 1,
    "status_in_ring_group": null,
    "extension_number": 1011
  },
  "queues": [],
  "campaignId": 233972,
  "campaignGroupId": null,
  "ring_groups": [],
  "socket": null
}
```

### Demais Eventos de Agente

| Evento | Descrição | Payload Principal |
|---|---|---|
| `agent-in-acw` | Agente em Tempo Pós Atendimento | `{ agent, call }` |
| `agent-login-failed` | Falha no login da campanha | `{ agent, reason, webphone }` |
| `agent-logged-out` | Agente fez logout | `{ agent }` |
| `agent-entered-manual-mode` | Entrou em modo manual | `{ agent }` |
| `agent-entered-manual-mode-failed` | Falha ao entrar modo manual | `{ agent, reason }` |
| `agent-left-manual-mode` | Saiu do modo manual | `{ agent }` |
| `agent-left-manual-mode-failed` | Falha ao sair modo manual | `{ agent, reason }` |
| `agent-entered-manual-mode-acw` | Entrou modo manual em TPA | `{ agent }` |
| `agent-left-manual-mode-acw` | Saiu modo manual em TPA | `{ agent }` |
| `agent-entered-work-break` | Entrou em intervalo | `{ agent, interval }` |
| `agent-entered-work-break-failed` | Falha ao entrar intervalo | `{ agent, reason }` |
| `agent-left-work-break` | Saiu do intervalo | `{ agent }` |
| `agent-left-work-break-failed` | Falha ao sair do intervalo | `{ agent, reason }` |
| `agent-schedule-notification` | Notificação de agendamento | `{ agent, schedule }` |

---

## 2. Eventos de Chamadas da Discadora (10)

### `call-was-created`

Chamada criada e disparada pelo discador. Primeiro evento do ciclo de vida.

```typescript
interface CallWasCreatedEvent {
  call: {
    mailing_id: string;            // "69d3ee934a10586af808b32a"
    phone: string;                 // "5579998841145"
    identifier: string;            // UUID da chamada
    campaign_id: number;           // 233972
    company_id: number;            // 8948
    call_mode: string;             // "dialer"
    campaign_group_id: number;     // 0
    list_id: number;               // 3729687 (ATENÇÃO: number aqui, string em outros eventos)
    id: string;                    // "call:8948:233972:pvCCpxUvUZ"
    telephony_id: string;          // "pvCCpxUvUZ"
    filter_calls: number;          // 1
    route_id: number;              // 13102
    status: number;                // 1 = criada
    dialed_time: number;           // Unix timestamp em segundos
  };
  webhookEvent: null;
  bootTime: string;                // ISO timestamp
}
```

```json
{
  "call": {
    "mailing_id": "69d3ee934a10586af808b32a",
    "phone": "5579998841145",
    "identifier": "dba5688b-c596-4d49-b681-ab24eb98b38c",
    "campaign_id": 233972,
    "company_id": 8948,
    "call_mode": "dialer",
    "campaign_group_id": 0,
    "list_id": 3729687,
    "id": "call:8948:233972:pvCCpxUvUZ",
    "telephony_id": "pvCCpxUvUZ",
    "filter_calls": 1,
    "route_id": 13102,
    "status": 1,
    "dialed_time": 1775858207
  },
  "webhookEvent": null,
  "bootTime": "2026-04-10T21:56:47.530209+00:00"
}
```

### `call-was-answered`

Cliente atendeu o telefone. **Atenção: tipos mudam para string neste evento.**

```typescript
interface CallWasAnsweredEvent {
  call: {
    mailing_id: string;
    phone: string;
    identifier: string;
    campaign_id: number;
    company_id: number;
    call_mode: string;
    campaign_group_id: number;
    id: string;
    telephony_id: string;
    list_id: string;               // ATENÇÃO: string aqui (era number em call-was-created)
    filter_calls: string;          // ATENÇÃO: string
    route_id: string;              // ATENÇÃO: string
    status: string;                // "2" = atendida (string, não number)
    dialed_time: string;           // ATENÇÃO: string
    has_early_media: string;       // "true" ou "false"
    early_media_data: string;
    answered_time: string;         // Unix timestamp como string
  };
  webhookEvent: null;
  bootTime: string;
}
```

```json
{
  "call": {
    "mailing_id": "69d3ee934a10586af808b32a",
    "phone": "5579998841145",
    "identifier": "dba5688b-c596-4d49-b681-ab24eb98b38c",
    "campaign_id": 233972,
    "company_id": 8948,
    "call_mode": "dialer",
    "campaign_group_id": 0,
    "id": "call:8948:233972:pvCCpxUvUZ",
    "telephony_id": "pvCCpxUvUZ",
    "list_id": "3729687",
    "filter_calls": "1",
    "route_id": "13102",
    "status": "2",
    "dialed_time": "1775858207",
    "has_early_media": "true",
    "early_media_data": "1775858211.140793,1;1775858211.280761,0",
    "answered_time": "1775858211"
  },
  "webhookEvent": null,
  "bootTime": "2026-04-10T21:56:54.100968+00:00"
}
```

### `call-was-connected`

Chamada conectada ao agente. **Payload mais rico** — contém dados completos do agente, campanha, qualificações e mailing.

```typescript
interface CallWasConnectedEvent {
  agent: {
    id: number;
    name: string;
    email: string | null;
    active: boolean;
    telephony_id: string;
    company_id: number;
    extension_number: number;
    type: string;                  // "agent"
    webphone: boolean;
    extension: {
      id: number;
      extension_number: number;
      type: string;
      company_id: number;
    };
    agent_status: {
      id: number;
      status: number;              // 2 = em chamada
      call: string;                // ID da chamada
      logged_campaign: number;
      webphone: boolean;
      connected_time: number;      // Unix timestamp
    };
    roles: Array<{ id: number; name: string; }>;
  };
  agentStatus: number;             // 2 = em chamada
  call: {
    mailing_id: string;
    phone: string;
    identifier: string;
    campaign_id: number;
    company_id: number;
    call_mode: string;
    id: string;
    telephony_id: string;
    status: string;                // "3" = conectada
    dialed_time: string;
    amd_status: string;            // "1" = máquina detectada, "0" = humano
    sid: string;                   // Session ID
    answered_time: string;
    connected_time: string;
    agent: string;                 // ID do agente como string
  };
  campaign: {
    id: number;
    name: string;
    start_time: string;            // "11:00:00"
    end_time: string;              // "02:59:00"
    paused: boolean;
    recording_enabled: boolean;
    dialer: {
      qualification_list: {
        id: number;
        name: string;
        qualifications: Array<{
          id: number;
          name: string;
          behavior: number;
          color: string;
          conversion: boolean;
          allow_schedule: string | null;
          is_positive: boolean;
          impact: string;
        }>;
      };
    };
  };
  webhookEvent: null;
  bootTime: string;
}
```

### `call-was-abandoned`

Cliente desligou antes de conectar com o agente.

```typescript
interface CallWasAbandonedEvent {
  call: {
    mailing_id: string;
    phone: string;
    identifier: string;
    campaign_id: number;
    company_id: number;
    id: string;
    telephony_id: string;
    status: string;                // "6" = abandonada
    hangup_cause: string;          // Código SIP (ex: "16")
    hangup_cause_txt: string;      // "Normal clearing"
    hangup_cause_color: string;    // "#5CB85C"
    hangup_time: string;           // Unix timestamp
    answered_time: string;
    amd_status: string;
    amd_time: string;
  };
  webhookEvent: null;
  bootTime: string;
}
```

### `call-history-was-created`

Histórico consolidado da chamada. **Evento mais importante** — contém todos os dados finais.

```typescript
interface CallHistoryWasCreatedEvent {
  callHistory: {
    number: string;                // Número discado
    campaign: { id: number; name: string; };
    company: { id: number; name: string; };
    mailing_data: {
      _id: string;                 // MongoDB ID
      identifier: string;
      campaign_id: number;
      company_id: number;
      list_id: number;
      phone: string;
      data: {
        name: string;              // Nome do contato
        stage: string;             // Estágio (ex: "Prospecção")
      };
    };
    phone_type: string;            // "mobile" ou "landline"
    agent: { id: number; name: string | null; };
    route: { id: number; name: string; host: string; };
    telephony_id: string;
    status: number;                // Status final (9=abandonada, 15=não atendida)
    qualification: {
      id: string | null;
      name: string | null;
      behavior: string | null;
      conversion: string | null;
      is_dmc: number;
      is_unknown: number;
      impact: string | null;
    };
    billed_time: number;           // Tempo faturado em segundos
    hangup_cause: number;          // Código SIP
    recorded: boolean;
    ended_by_agent: boolean;
    call_mode: string;
    list: { id: number; name: string; };
    call_date: string;             // ISO timestamp
    calling_time: number;          // Tempo total em segundos
    waiting_time: number;
    speaking_time: number;         // Tempo falando com agente
    speaking_with_agent_time: number;
    acw_time: number;              // Tempo pós-atendimento
    has_early_media: boolean;
  };
  hangupCause: {
    text: string;
    color: string;
    id: number;
    sip: string;
  };
  qualificationList: {
    id: number;
    name: string;
    company_id: number;
  };
  webhookEvent: null;
  bootTime: string;
}
```

### Demais Eventos de Chamada

| Evento | Descrição | Campos Adicionais |
|---|---|---|
| `call-was-hung-up` | Chamada desligada | `call.hangup_cause`, `call.hangup_time` |
| `call-was-finished` | Chamada finalizada | Duração total |
| `call-was-unanswered` | Não atendida | `call.hangup_cause_txt` |
| `call-was-failed` | Chamada com falha | `call.hangup_cause`, `call.hangup_cause_txt` |
| `call-was-abandoned-by-voicemail-detection` | Caixa postal detectada | `call.amd_status` |

---

## 3. Eventos de Chamadas Manuais (9)

| Evento | Descrição |
|---|---|
| `manual-call-was-created` | Chamada manual criada |
| `manual-call-was-connected` | Chamada manual conectada ao agente |
| `manual-call-was-answered` | Chamada manual atendida pelo cliente |
| `manual-call-was-hung-up` | Chamada manual desligada |
| `manual-call-was-finished` | Chamada manual finalizada |
| `manual-call-was-unanswered` | Chamada manual não atendida |
| `manual-call-was-failed` | Chamada manual com falha |
| `manual-call-history-was-created` | Histórico da chamada manual criado |
| `manual-call-acw-was-connected` | Chamada manual em TPA conectada |

Os payloads seguem a mesma estrutura dos eventos de chamada da discadora, com a diferença de que `call_mode` é `"manual"` em vez de `"dialer"`.

---

## 4. Eventos de Spy Snoop (3)

| Evento | Descrição |
|---|---|
| `spy-snoop-was-started` | Espionagem de chamada iniciada |
| `spy-snoop-was-finished` | Espionagem finalizada |
| `spy-snoop-was-failed` | Espionagem falhou |

---

## 5. Eventos de Receptivo (4)

| Evento | Descrição |
|---|---|
| `receptive-entered-queue` | Chamada receptiva entrou na fila |
| `receptive-was-connected` | Receptivo conectado com agente |
| `receptive-was-abandoned` | Receptivo abandonado |
| `receptive-was-finished` | Receptivo finalizado |

---

## 6. Eventos de WhatsApp (1)

### `new-message-whatsapp`

Nova mensagem recebida no WhatsApp. Funciona independentemente de agentes logados.

```typescript
interface WhatsAppMessageEvent {
  chat: {
    id: number;                        // 5079254
    contact: {
      id: number;                      // 4645437
      name: string;                    // Nome ou número
      image: string;                   // URL da foto de perfil
      number: string;                  // "5562991088407"
    };
    instance_id: string;               // ID da instância WhatsApp
    instance: {
      id: string;
      name: string;                    // "SDR - CASTRO"
      phone: string;                   // Número da instância
      status: string;                  // "connected"
      type: string;                    // "whatsapp-3c"
    };
    agent_id: number | null;
    agent: {
      id: number;
      name: string;
      extension: { extension_number: number; };
      role: { name: string; };
    } | null;
    unread: number;
    finished: boolean;
    last_message_data: {
      body: string;
      type: string;                    // "chat", "audio", "image", "document"
      date: number;                    // Unix timestamp
      send_by_me: boolean;
    };
  };
  message: {
    id: string;                        // ID único da mensagem
    number: string;                    // Número do remetente
    type: string;                      // "chat" | "audio" | "image" | "document" | "video"
    body: string;                      // Conteúdo texto (vazio para mídia)
    chat_id: string;
    from: string;                      // Número de origem
    to: string;                        // Número de destino
    author: string;
    fromMe: boolean;                   // true se enviada pelo sistema
    media: string | null;              // URL de download da mídia
    media_name: string | null;
    audio_transcription: string | null;
    time: number;                      // Unix timestamp
    quoted_msg: {
      body: string | null;
      id: string | null;
      media: string | null;
      type: string | null;
    };
  };
}
```

---

## 7. Outros Eventos (1)

| Evento | Descrição |
|---|---|
| `mailing-list-empty` | Lista de mailing ficou vazia (todos os contatos foram discados) |

---

## Fluxos de Chamada — Sequência de Eventos

### Chamada Completa (Discadora)

```
call-was-created → call-was-answered → call-was-connected → call-was-hung-up → call-was-finished → call-history-was-created
```

### Chamada Não Atendida

```
call-was-created → call-was-unanswered → call-history-was-created
```

### Chamada Abandonada (cliente desligou antes de conectar)

```
call-was-created → call-was-answered → call-was-abandoned → call-history-was-created
```

### Chamada Manual Completa

```
manual-call-was-created → manual-call-was-connected → manual-call-was-answered → manual-call-was-hung-up → manual-call-was-finished → manual-call-history-was-created
```

### Click2Call Completo

```
agent-is-idle → [POST /click2call] → call-was-connected → call-was-hung-up → call-was-finished → call-history-was-created → agent-in-acw → [POST /qualify] → agent-is-idle
```

---

## Padrões e Armadilhas

### Inconsistência de Tipos

Campos numéricos podem ser `number` em um evento e `string` em outro. **Sempre normalizar com `Number()` antes de persistir.**

| Campo | `call-was-created` | `call-was-answered` |
|---|---|---|
| `status` | `number` (1) | `string` ("2") |
| `list_id` | `number` (3729687) | `string` ("3729687") |
| `route_id` | `number` (13102) | `string` ("13102") |
| `dialed_time` | `number` | `string` |

### Timestamps Mistos

| Formato | Campos | Exemplo |
|---|---|---|
| Unix (segundos) | `dialed_time`, `answered_time`, `connected_time`, `time` | `1775858207` |
| ISO 8601 | `call_date`, `created_at`, `updated_at`, `bootTime` | `"2026-04-10T21:56:47.530209+00:00"` |

### Campos Opcionais

Muitos campos podem ser `null` ou vazio. Preparar o sistema para: `agent.name` pode ser `null` se a chamada não foi conectada; `qualification` é sempre enviado mas pode ter todos os campos como `null`; `mailing_data.data` é um objeto customizável que depende das colunas do CSV importado.
