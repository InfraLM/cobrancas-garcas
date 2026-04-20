# Guia Completo de Integração 3C Plus

> Este documento consolida todo o conhecimento adquirido durante os testes práticos com a plataforma 3C Plus. Todas as informações, fluxos e payloads foram **validados em ambiente real** com a conta da Liberdade Médica. O objetivo é permitir que um desenvolvedor implemente a integração completa sem dificuldades.

---

## 1. Autenticação e Configuração

### 1.1 Estrutura de Tokens

A 3C Plus utiliza três níveis de token, cada um com escopo diferente. Para o sistema de cobrança, são necessários **dois tokens obrigatoriamente**: o do agente e o do gestor.

| Nível | Escopo | Uso no Sistema de Cobrança |
|---|---|---|
| **Gestor** | Acesso total: agentes, campanhas, relatórios, Click2Call | `POST /click2call`, relatórios, gerenciamento de listas |
| **Supervisor** | Acesso às equipes atribuídas | Monitoramento (opcional) |
| **Agente** | Acesso restrito às próprias ações | Login na campanha, Socket.io, Ramal Web (WebRTC) |

A autenticação é feita via query parameter em todas as requisições:

```
GET /agent/campaigns?api_token={SEU_TOKEN}
POST /agent/login?api_token={SEU_TOKEN}
```

Para obter um token programaticamente, use o endpoint de autenticação:

```
POST https://{subdominio}.3c.plus/api/v1/authenticate
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "password": "senha",
  "company_domain": "liberdademedica"
}
```

A resposta retorna o `api_token` do usuário autenticado.

### 1.2 Domínios da API

A 3C Plus possui **três domínios distintos** para diferentes funcionalidades. Usar o domínio errado resulta em erro 404 ou 401.

| Domínio | Base URL | Funcionalidade |
|---|---|---|
| **Discador** | `https://{subdominio}.3c.plus/api/v1` | Campanhas, agentes, chamadas, mailing |
| **Click2Call** | `https://3c.fluxoti.com/api/v1` | Exclusivamente o endpoint `/click2call` |
| **Omnichannel** | `https://app.3c.fluxoti.com/omni-api/v1/whatsapp/` | WhatsApp: envio e recebimento |

O subdomínio é específico de cada empresa. Para a Liberdade Médica, é `liberdademedica`, resultando em `https://liberdademedica.3c.plus/api/v1`.

### 1.3 Content-Type

A maioria dos endpoints do Discador usa `application/x-www-form-urlencoded`:

```
POST /agent/login?api_token={TOKEN}
Content-Type: application/x-www-form-urlencoded

campaign=233972
```

Os endpoints do Omnichannel (WhatsApp) usam `application/json`:

```
POST /omni-api/v1/whatsapp/message/send_chat
Content-Type: application/json

{"chat_id": "5562991088407", "body": "Mensagem", "instance_id": "80e6ea..."}
```

---

## 2. Conexão Socket.io

### 2.1 Configuração do Cliente

O Socket.io é o canal principal para receber eventos em tempo real. A configuração é simples, mas exige atenção a dois detalhes: o transporte deve ser exclusivamente `websocket` e o token vai na query string.

```javascript
import io from 'socket.io-client';

const socket = io('https://socket.3c.plus', {
  query: { token: 'SEU_API_TOKEN' },
  transports: ['websocket'], // OBRIGATÓRIO: apenas websocket
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

socket.on('connect', () => {
  console.log('Conectado ao Socket.io da 3C Plus');
});

socket.on('disconnect', (reason) => {
  console.log('Desconectado:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Erro de conexão:', error.message);
});
```

### 2.2 Comportamento Importante

O Socket.io recebe eventos de **todos os módulos** (Discador + WhatsApp) independentemente do estado do agente. Mensagens de WhatsApp chegam mesmo que nenhum agente esteja logado em campanha. Isso significa que o worker pode escutar eventos de WhatsApp 24/7 sem precisar manter um agente logado.

### 2.3 Escutando Eventos

Cada evento é escutado com `socket.on()`. O payload varia conforme o tipo de evento (ver `socket_events.md` para payloads completos):

```javascript
// Eventos de agente
socket.on('agent-is-idle', (data) => { /* agente pronto */ });
socket.on('agent-in-acw', (data) => { /* agente em pós-atendimento */ });
socket.on('agent-login-failed', (data) => { /* falha no login */ });

// Eventos de chamada (discador)
socket.on('call-was-created', (data) => { /* chamada criada */ });
socket.on('call-was-answered', (data) => { /* cliente atendeu */ });
socket.on('call-was-connected', (data) => { /* conectou ao agente */ });
socket.on('call-was-hung-up', (data) => { /* desligou */ });
socket.on('call-was-finished', (data) => { /* finalizada */ });
socket.on('call-was-unanswered', (data) => { /* não atendida */ });
socket.on('call-was-abandoned', (data) => { /* abandonada */ });
socket.on('call-history-was-created', (data) => { /* histórico consolidado */ });

// Eventos de WhatsApp
socket.on('new-message-whatsapp', (data) => { /* nova mensagem */ });
```

### 2.4 Worker 24/7

Como a 3C Plus não possui webhooks, é obrigatório manter um **serviço worker (daemon) Node.js** conectado ao Socket.io permanentemente. Este worker recebe os eventos e os persiste no banco de dados do sistema de cobrança.

```javascript
// worker-3cplus.js — Exemplo de worker com reconexão automática
import io from 'socket.io-client';
import { persistirEvento } from './database.js';

const TODOS_EVENTOS = [
  'agent-is-idle', 'agent-in-acw', 'agent-login-failed', 'agent-logged-out',
  'call-was-created', 'call-was-answered', 'call-was-connected',
  'call-was-hung-up', 'call-was-finished', 'call-was-abandoned',
  'call-was-unanswered', 'call-was-failed', 'call-history-was-created',
  'new-message-whatsapp', 'mailing-list-empty',
  // ... demais eventos conforme necessidade
];

const socket = io('https://socket.3c.plus', {
  query: { token: process.env.TOKEN_3CPLUS },
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,
});

TODOS_EVENTOS.forEach(evento => {
  socket.on(evento, async (data) => {
    try {
      await persistirEvento(evento, data);
    } catch (err) {
      console.error(`Erro ao persistir ${evento}:`, err);
    }
  });
});
```

---

## 3. Chamadas em Massa — Discador Automático

O discador automático é o modo principal de cobrança por voz. A 3C Plus disca automaticamente para os contatos de uma lista (Mailing List) e conecta os que atendem a um agente disponível.

### 3.1 Gerenciamento de Mailing Lists

A hierarquia é: **Empresa > Campanha > Lista de Mailing > Contatos**. Para um sistema de cobrança rotativa, é essencial gerenciar as listas dinamicamente.

| Endpoint | Método | Descrição |
|---|---|---|
| `/campaigns/{id}/lists` | GET | Listar todas as listas da campanha |
| `/campaigns/{id}/lists` | POST | Criar nova lista de mailing |
| `/campaigns/{id}/lists/{list-id}/mailing.json` | POST | Adicionar contatos à lista via JSON |
| `/campaigns/{id}/mailing` | POST | Upload de CSV com contatos |
| `/campaigns/{id}/mailing/delete` | DELETE | Remover contatos da campanha |

**Estratégia recomendada para cobrança:**

1. **Job noturno**: Consultar a tabela `contareceber` do SEI (situação `AR` com vencimento expirado) e gerar a lista de inadimplentes.
2. **Atualização de lista**: Adicionar novos inadimplentes via `POST /campaigns/{id}/lists/{list-id}/mailing.json`.
3. **Remoção imediata**: Quando o Asaas notificar pagamento via webhook, remover o aluno da lista de discagem imediatamente para evitar cobranças indevidas.

### 3.2 Ciclo de Vida do Agente

O agente precisa estar **logado em uma campanha** e com o **Ramal Web (WebRTC) ativo** para receber chamadas.

```
1. Conectar ao Socket.io (token do agente)
2. Ativar Ramal Web (iframe WebRTC com token do agente)
3. Aguardar registro SIP (~8-10 segundos)
4. POST /agent/login (body: campaign={id}) com token do agente
5. Aguardar evento Socket: agent-is-idle → Agente pronto para receber chamadas
```

### 3.3 Ciclo de Vida da Chamada

O discador liga automaticamente. O agente não precisa fazer nada — a chamada chega quando o cliente atende.

```
call-was-created       → Chamada criada e disparada pelo discador
call-was-answered      → Cliente atendeu o telefone
call-was-connected     → Conectou ao agente (payload contém call.id, mailing.data, qualifications)
call-was-hung-up       → Chamada desligada
call-was-finished      → Chamada finalizada
agent-in-acw           → Agente em Tempo Pós Atendimento (aguardando qualificação)
POST /agent/call/{call_id}/qualify → Agente qualifica a chamada
agent-is-idle          → Agente livre para próxima chamada
```

**Cenários alternativos:**
- **Não atendida**: `call-was-unanswered`
- **Abandonada** (cliente desligou antes de conectar): `call-was-answered` → `call-was-abandoned`
- **Caixa postal detectada**: `call-was-abandoned-by-voicemail-detection`

### 3.4 Qualificação de Chamadas

Após cada chamada, o agente deve qualificar o resultado. As qualificações disponíveis vêm no payload do evento `call-was-connected` dentro de `campaign.dialer.qualification_list.qualifications`:

```
POST /agent/call/{call_id}/qualify?api_token={TOKEN_AGENTE}
Content-Type: application/x-www-form-urlencoded

qualification_id={id}
```

---

## 4. Chamadas Individuais — Click2Call

O Click2Call permite que o agente ligue diretamente para um número específico, sem depender da lista de mailing. Este é o modo utilizado quando o agente de cobrança quer ligar individualmente para um aluno.

### 4.1 Pré-requisitos

O Click2Call exige **dois tokens com papéis distintos** e uma **campanha sem número para logar**:

| Token | Uso | Motivo |
|---|---|---|
| **Token do Agente** | Login na campanha + Socket.io + Ramal Web | Apenas o próprio agente pode se logar |
| **Token do Gestor** | `POST /click2call` | Endpoint exclusivo de gestor |

**Descoberta crítica validada em teste real:** A API da 3C Plus **não permite que um gestor logue outro agente remotamente**. O `POST /agent/login` loga apenas o próprio usuário do token. Tentativas de usar o token do gestor para logar o agente resultam no erro `422 "O agente não faz parte dessa campanha"`.

### 4.2 Fluxo Completo Validado

O fluxo abaixo foi **testado e validado em ambiente real** com a conta da Liberdade Médica:

```
PASSO 1: Ativar Ramal Web (iframe WebRTC com token do agente)
         URL: https://{subdominio}.3c.plus/extension?api_token={TOKEN_AGENTE}
         Iframe: allow="microphone; autoplay; camera; display-capture"
         Aguardar ~10 segundos para registro SIP

PASSO 2: Conectar Socket.io (token do agente)
         URL: https://socket.3c.plus
         query: { token: TOKEN_AGENTE }

PASSO 3: Login na campanha (token do agente)
         POST /agent/login?api_token={TOKEN_AGENTE}
         Body: campaign=233972
         Content-Type: application/x-www-form-urlencoded

PASSO 4: Aguardar evento Socket: agent-is-idle
         (Confirma que o agente está logado E com webphone ativo)

PASSO 5: Click2Call (token do gestor)
         POST https://3c.fluxoti.com/api/v1/click2call?api_token={TOKEN_GESTOR}
         Body: extension=1011&phone=62991088407
         Content-Type: application/x-www-form-urlencoded

PASSO 6: Aguardar eventos de chamada via Socket
         call-was-connected → Em chamada
         call-was-hung-up → Desligou
         call-was-finished → Finalizada

PASSO 7: Logout (token do agente)
         POST /agent/logout?api_token={TOKEN_AGENTE}

PASSO 8: Desativar Ramal Web (remover iframe)
```

### 4.3 Endpoint Click2Call — Detalhes

```
POST https://3c.fluxoti.com/api/v1/click2call?api_token={TOKEN_GESTOR}
Content-Type: application/x-www-form-urlencoded

extension={EXTENSAO_AGENTE}&phone={NUMERO_TELEFONE}
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `extension` | string | Sim | Número da extensão do agente (ex: `1011`) |
| `phone` | string | Sim | Número de telefone do cliente (ex: `62991088407`) |

**Resposta de sucesso (200):**
```json
{
  "call": { "id": "string", "number": 0 },
  "agent": { "name": "string", "telephony_id": "string" }
}
```

### 4.4 Erros Comuns e Soluções

| Erro | Causa | Solução |
|---|---|---|
| 401 "É necessário autenticação" | Token não enviado | Adicionar `?api_token={TOKEN}` na URL |
| 422 "O campo extension é obrigatório" | Faltando `extension` no body | Enviar `extension={valor}` no body |
| 422 "O agente não faz parte dessa campanha" | Token de gestor usado no login | Usar token do **agente** para `POST /agent/login` |
| 422 "Verifique se o agente está logado corretamente" | Agente não está IDLE | Ativar Ramal Web antes e aguardar registro SIP |
| `agent-login-failed` com `webphone: false` | Ramal Web não completou registro SIP | Aguardar 8-10 segundos após ativar iframe |

### 4.5 Modo Manual (Não Recomendado)

O fluxo via `POST /agent/manual_call/enter` → `POST /agent/manual_call/dial` foi testado mas **abandonado** porque o evento `agent-entered-manual-mode` nunca chega via Socket.io (retorna 204 mas sem confirmação). **Usar Click2Call com dois tokens.**

---

## 5. WebRTC — Ramal Web

O Ramal Web é **obrigatório** para que o agente possa ouvir e falar nas chamadas. Sem ele, o agente fica com status 0 (logado mas não idle) e o Click2Call falha com erro 422.

### 5.1 Incorporação do iframe

```html
<iframe
  id="webrtc-frame"
  src="https://{subdominio}.3c.plus/extension?api_token={TOKEN_AGENTE}"
  allow="microphone; autoplay; camera; display-capture"
  style="width: 100%; height: 220px; border: none;"
/>
```

### 5.2 Regras Críticas (Validadas)

1. O iframe precisa do atributo `allow="microphone; autoplay"` no mínimo.
2. A página deve estar em **HTTPS** para o microfone funcionar.
3. Aguardar **8-10 segundos** após abrir o iframe antes de fazer login (tempo de registro SIP).
4. Verificar via polling `GET /agent/status` que `webphone=true` antes do login.
5. A página **não pode ser recarregada** durante uma ligação ativa.
6. Solicitar `navigator.mediaDevices.getUserMedia({ audio: true })` proativamente **antes** de abrir o iframe para forçar o Chrome a usar o dispositivo correto.

### 5.3 Solicitação Proativa de Permissão

Solicitar permissão de microfone antes de abrir o iframe da 3C Plus melhora a experiência e evita problemas de seleção de dispositivo:

```javascript
async function prepareAudioForWebRTC() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const jabra = devices.find(d =>
      d.kind === 'audioinput' &&
      d.label.toLowerCase().includes('jabra')
    );

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: jabra ? { exact: jabra.deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
        sampleRate: { ideal: 48000 },
        sampleSize: { ideal: 16 },
        channelCount: { ideal: 1 },
      }
    });

    // Liberar o stream imediatamente — a permissão fica cached
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (err) {
    console.error('Erro ao preparar áudio:', err);
    return false;
  }
}
```

---

## 6. Qualidade de Áudio — Configurações Validadas

A qualidade de áudio em chamadas WebRTC com headsets profissionais (como Jabra Evolve2 50) pode ser severamente degradada por conflitos entre o processamento de áudio do Chrome e o processamento nativo do headset. As configurações abaixo foram **validadas em ambiente real** e produziram o melhor desempenho de chamada.

### 6.1 O Problema: Três Camadas de Conflito

**Camada 1 — Troca de Perfil USB:** Quando o Chrome ativa o microfone via WebRTC, o Windows troca automaticamente o perfil de áudio do headset de "Stereo" (alta qualidade) para "Hands-Free/Communications" (mono, baixa qualidade). Isso é confirmado pela Jabra como "by design".

**Camada 2 — Processamento Agressivo do Chrome:** O Chrome aplica AEC (Acoustic Echo Cancellation), AGC (Automatic Gain Control) e NS (Noise Suppression) por padrão. O bug #42233568 do WebRTC documenta supressão excessiva do AEC com headsets Jabra, causando áudio "dentro de uma bolha".

**Camada 3 — Conflito Sidetone + AEC:** O sidetone do headset reproduz a voz do usuário nos alto-falantes. O AEC do Chrome interpreta isso como eco e aplica supressão ainda mais agressiva.

### 6.2 Constraints de Áudio Validadas

As constraints abaixo foram testadas e produziram o melhor resultado com Jabra Evolve2 50:

```javascript
const audioConstraints = {
  audio: {
    deviceId: { exact: selectedDeviceId },
    echoCancellation: true,       // Manter ativo — necessário para chamadas
    noiseSuppression: true,       // Manter ativo — necessário para chamadas
    autoGainControl: false,       // DESATIVAR — o Jabra tem AGC próprio
    sampleRate: { ideal: 48000 }, // Qualidade DVD (não 16000)
    sampleSize: { ideal: 16 },
    channelCount: { ideal: 1 },   // Mono para chamadas de voz
  }
};
```

**Nota importante:** As constraints iniciais da pesquisa recomendavam desativar `echoCancellation` e `noiseSuppression`, mas os testes em ambiente real mostraram que mantê-los ativos com `autoGainControl: false` produz melhor resultado. A chave é desativar apenas o AGC.

### 6.3 Configurações do Chrome (Flags)

Acessar `chrome://flags` e configurar:

| Flag | Valor | Justificativa |
|---|---|---|
| `#enable-webrtc-allow-input-volume-adjustment` | **Disabled** | Impede que o Chrome reduza automaticamente o volume do microfone |
| `#enable-webrtc-apm-downmix-capture-audio-method` | **Default** | Não alterar — o método legado causa artefatos |
| `#chrome-wide-echo-cancellation` | **Default** | Não alterar — centraliza AEC mas pode causar conflitos |

### 6.4 Configurações do Jabra Direct

| Configuração | Valor Recomendado | Justificativa |
|---|---|---|
| **Sidetone** | **Lowest** (não permite desativar) | Reduz conflito com AEC do Chrome |
| **Call Equalizer** | **Neutral** ou **Speech** | "Bass" acentua frequências interpretadas como ruído |
| **Hearing Protection** | G616 ou IntelliTone | Manter padrão |

### 6.5 Configurações do Windows

1. **Formato do microfone**: Alterar de 16000 Hz para **48000 Hz** (qualidade DVD) em Sistema > Som > Propriedades do Microfone.
2. **Aprimoramentos de áudio**: Desativado.
3. **Volume de entrada**: 90% (não 100%, para evitar clipping).

### 6.6 Teste de Áudio Pré-Chamada

Implementar um teste de áudio antes de cada sessão de chamadas é essencial para garantir qualidade. O teste deve:

1. Enumerar dispositivos de áudio e selecionar o headset correto.
2. Gravar 5 segundos de áudio com as constraints otimizadas.
3. Exibir métricas em tempo real: nível médio, pico, frequência dominante, detecção de clipping.
4. Permitir playback e download da gravação para análise.

```javascript
// Exemplo de teste de áudio com AudioContext + AnalyserNode
async function testeAudioPreChamada(deviceId) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: deviceId },
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
      sampleRate: { ideal: 48000 },
      sampleSize: { ideal: 16 },
      channelCount: { ideal: 1 },
    }
  });

  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function calcularMetricas() {
    analyser.getByteFrequencyData(dataArray);
    const valores = Array.from(dataArray);
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const pico = Math.max(...valores);
    const clipping = pico > 250; // > 98% do máximo
    return { media, pico, clipping };
  }

  // Gravar por 5 segundos
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.start();

  // Coletar métricas durante 5 segundos
  const intervalo = setInterval(() => {
    const metricas = calcularMetricas();
    console.log('Métricas:', metricas);
  }, 100);

  setTimeout(() => {
    clearInterval(intervalo);
    recorder.stop();
    stream.getTracks().forEach(t => t.stop());
    audioContext.close();
  }, 5000);

  return new Promise(resolve => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      resolve(blob);
    };
  });
}
```

---

## 7. WhatsApp Omnichannel

O módulo Omnichannel da 3C Plus permite enviar e receber mensagens de WhatsApp. Este módulo é **completamente independente do Discador** — funciona sem que nenhum agente esteja logado em campanha.

### 7.1 Hierarquia de Comunicação

```
Empresa (company_id: 8948)
  └── Grupo de Canais (group_channel_id: 6312)
       └── Canal/Instância (instance_id: "80e6ea...", nome: "SDR - CASTRO")
            └── Chat (chat_id: 5079254, número: "5562991088407")
                 └── Mensagens (texto, áudio, imagem, documento)
```

### 7.2 Recebimento de Mensagens (Socket.io)

O recebimento ocorre exclusivamente via Socket.io, no evento `new-message-whatsapp`. O payload contém toda a informação necessária para exibir a mensagem no CRM:

```javascript
socket.on('new-message-whatsapp', (data) => {
  const { chat, message } = data;

  // Dados do contato
  const numero = chat.contact.number;    // "5562991088407"
  const nome = chat.contact.name;        // Nome ou número

  // Dados da mensagem
  const tipo = message.type;             // "chat", "audio", "image", "document"
  const corpo = message.body;            // Texto (vazio para mídia)
  const media = message.media;           // URL de download (null para texto)
  const enviadoPorMim = message.fromMe;  // true se enviada pelo sistema

  // Persistir no banco de dados
  await salvarMensagem({
    chatId: chat.id,
    telefone: numero,
    tipo,
    corpo,
    mediaUrl: media,
    direcao: enviadoPorMim ? 'saida' : 'entrada',
    timestamp: message.time,
  });
});
```

### 7.3 Tipos de Mensagem

| Tipo (`message.type`) | `message.body` | `message.media` | Exemplo |
|---|---|---|---|
| `chat` (texto) | Conteúdo da mensagem | `null` | Mensagem de texto simples |
| `audio` | Vazio (`""`) | URL `.ogg` para download | Áudio de voz gravado |
| `image` | Vazio (`""`) | URL `.jpeg` para download | Foto enviada pelo cliente |
| `document` | Vazio (`""`) | URL do arquivo | PDF, planilha, etc. |

URLs de download de mídia seguem o padrão:
```
https://app.3c.plus/omni-api/v1/whatsapp/download/{company_id}/{type}/{hash}.{ext}
```

### 7.4 Envio de Mensagens (REST API)

```
POST https://app.3c.fluxoti.com/omni-api/v1/whatsapp/message/send_chat
Content-Type: application/json

{
  "chat_id": "5562991088407",
  "body": "Olá, identificamos uma pendência financeira...",
  "instance_id": "80e6ea859385137827c362646bf51222"
}
```

### 7.5 Replicando o WhatsApp no CRM

Para que o agente interaja com os alunos diretamente dentro do CRM:

**Componente 1 — Worker Socket.io (Backend, 24/7):** Conecta ao Socket.io com token de gestor, escuta `new-message-whatsapp` continuamente, persiste cada mensagem no banco vinculando ao `contact.number`, e baixa/armazena mídias.

**Componente 2 — Interface de Chat (Frontend):** Exibe histórico de mensagens do aluno, permite envio via `POST /message/send_chat`, exibe áudios com player embutido, imagens inline, e download de documentos.

**Componente 3 — Vinculação Aluno-Chat:** Cruzar `contact.number` (3C Plus) com o telefone do aluno no SEI. Cada chat é vinculado ao `aluno_id` no Core de Cobrança.

---

## 8. Registro de Eventos — Vinculação com Agente e Aluno

### 8.1 Tabela de Eventos Proposta

```sql
CREATE TABLE evento_3cplus (
  id                  SERIAL PRIMARY KEY,
  tipo_evento         VARCHAR(50) NOT NULL,
  categoria           VARCHAR(20) NOT NULL,
  call_id             VARCHAR(100),
  telephony_id        VARCHAR(50),
  chat_id             VARCHAR(50),
  message_id          VARCHAR(100),
  campaign_id         INTEGER,
  agente_3cplus_id    INTEGER,
  agente_nome         VARCHAR(100),
  extensao            INTEGER,
  telefone_cliente    VARCHAR(20),
  aluno_id            INTEGER,
  payload             JSONB NOT NULL,
  status_chamada      VARCHAR(20),
  qualificacao        VARCHAR(100),
  duracao_segundos    INTEGER,
  tipo_mensagem       VARCHAR(20),
  corpo_mensagem      TEXT,
  media_url           TEXT,
  direcao             VARCHAR(10),
  timestamp_evento    TIMESTAMP NOT NULL,
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_evento_telefone ON evento_3cplus(telefone_cliente);
CREATE INDEX idx_evento_aluno ON evento_3cplus(aluno_id);
CREATE INDEX idx_evento_agente ON evento_3cplus(agente_3cplus_id);
CREATE INDEX idx_evento_tipo ON evento_3cplus(tipo_evento);
CREATE INDEX idx_evento_timestamp ON evento_3cplus(timestamp_evento);
```

### 8.2 Mapeamento de Eventos

| Evento Socket | Dados Extraídos | Vinculação |
|---|---|---|
| `call-was-created` | `call.id`, `call.phone`, `call.campaign_id` | Telefone → Aluno |
| `call-was-answered` | `call.answered_time` | Atualiza registro existente |
| `call-was-connected` | `agent.id`, `agent.name`, `mailing.data`, `qualifications` | Agente + Aluno |
| `call-was-hung-up` | `call.hangup_cause`, `call.hangup_time` | Atualiza registro |
| `call-was-finished` | Duração total | Atualiza registro |
| `call-history-was-created` | **Payload completo consolidado** | Registro final definitivo |
| `new-message-whatsapp` | `message.type`, `message.body`, `chat.contact.number` | Telefone → Aluno |

**O evento `call-history-was-created` é o mais importante** — contém todos os dados consolidados da chamada e deve ser o registro definitivo.

---

## 9. Inconsistências Identificadas nos Testes

### 9.1 Tipos Inconsistentes

Os eventos apresentam inconsistência de tipos entre eventos diferentes. Um mesmo campo pode ser `number` em um evento e `string` em outro:

| Campo | `call-was-created` | `call-was-answered` |
|---|---|---|
| `status` | `number` (1) | `string` ("2") |
| `list_id` | `number` (3729687) | `string` ("3729687") |
| `route_id` | `number` (13102) | `string` ("13102") |

**Recomendação:** Normalizar todos os campos numéricos com `Number()` antes de persistir.

### 9.2 Timestamps Mistos

| Formato | Campos | Exemplo |
|---|---|---|
| **Unix (segundos)** | `dialed_time`, `answered_time`, `connected_time`, `time` | `1775858207` |
| **ISO 8601** | `call_date`, `created_at`, `updated_at`, `bootTime` | `"2026-04-10T21:56:47.530209+00:00"` |

**Recomendação:** Padronizar para ISO 8601 no banco de dados.

### 9.3 Status do Agente

| Código | Constante | Descrição |
|---|---|---|
| 0 | STATUS_OFFLINE | Agente offline (logado mas sem WebRTC) |
| 1 | STATUS_IDLE | Agente ocioso (pronto para chamadas) |
| 2 | STATUS_ON_CALL | Em chamada |
| 3 | STATUS_ACW | Em pós-atendimento |
| 4 | STATUS_ON_MANUAL_CALL | Em chamada manual |
| 5 | STATUS_ON_MANUAL_CALL_CONNECTED | Chamada manual conectada |
| 6 | STATUS_ON_WORK_BREAK | Em intervalo |
| 21 | STATUS_ON_MANUAL_CALL_ACW | Chamada manual pós-atendimento |
| 22 | STATUS_MANUAL_CALL_CONNECTED | Chamada manual pós-atendimento conectada |

---

## 10. Dados Reais da Liberdade Médica (Validados)

| Dado | Valor |
|---|---|
| Company ID | 8948 |
| Subdomínio | `liberdademedica` |
| Campanha | 233972 (A e B - Pós graduação) |
| Lista Mailing | 3729687 |
| Agente Hyago | ID 193740, extensão 1011 |
| Agente Marcelo (Gestor) | ID 119414, extensão 1001 |
| Instância WhatsApp | `80e6ea859385137827c362646bf51222` (SDR - CASTRO) |
| Telefone Instância | `5562936180653` |
| Group Channel ID | 6312 |
| Team ID | 15962 |

---

## 11. Arquitetura Recomendada

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (CRM)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Kanban   │  │ Chat     │  │ Softphone│  │Timeline │ │
│  │ Cobrança │  │ WhatsApp │  │ WebRTC   │  │ Aluno   │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API
┌──────────────────────┴──────────────────────────────────┐
│                 BACKEND (Core de Cobrança)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ API      │  │ Worker   │  │ Job      │  │ Webhook │ │
│  │ Routes   │  │ Socket.io│  │ Noturno  │  │ Asaas   │ │
│  │          │  │ (24/7)   │  │ Mailing  │  │         │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│                    BANCO DE DADOS                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ evento_  │  │ negocia- │  │ aluno    │  │ SEI     │ │
│  │ 3cplus   │  │ cao      │  │ (mirror) │  │(read-   │ │
│  │          │  │          │  │          │  │ only)   │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────┘
```
