---
name: 3cplus-integration
description: Conhecimento profundo sobre a plataforma 3C Plus — Discador Automático, Click2Call, Omnichannel (WhatsApp) e eventos Socket.io em tempo real. Use esta skill para orientar o desenvolvimento de integrações com a 3C Plus, incluindo chamadas em massa (campanhas), chamadas individuais (Click2Call com dois tokens), replicação do WhatsApp no CRM, registro automático de eventos, implementação de WebRTC com otimizações de qualidade de áudio, e monitoramento em tempo real via Socket.io. Todos os fluxos foram validados em ambiente real com a conta da Liberdade Médica.
license: Complete terms in LICENSE.txt
---

# 3C Plus Integration Skill

## O Que É a 3C Plus

A 3C Plus é uma plataforma brasileira de comunicação empresarial que oferece discador automático (power dialer), chamadas individuais (Click2Call), e omnichannel (WhatsApp) para operações de call center. Diferente de plataformas tradicionais, a 3C Plus **não utiliza webhooks** — toda a comunicação em tempo real é feita via **Socket.io**, exigindo um worker daemon conectado permanentemente.

## Para Que Será Usado

A integração com a 3C Plus no sistema de cobrança cobre seis funcionalidades principais:

| Funcionalidade | Descrição | Módulo 3C Plus |
|---|---|---|
| **Ligações em massa** | Discador automático para campanhas de cobrança | Discador (campanhas com mailing list) |
| **Ligações individuais** | Agente liga diretamente para um aluno específico | Click2Call (requer dois tokens: agente + gestor) |
| **WhatsApp no CRM** | Interface de chat replicando a experiência oficial do WhatsApp | Omnichannel (envio via REST, recebimento via Socket.io) |
| **Eventos automáticos** | Registro de todos os eventos: inclusão em campanha, ligação recebida, atendida, transcrição, WhatsApp enviado/recebido, disparos | Socket.io (40 eventos disponíveis) |
| **Softphone WebRTC** | Ramal web embutido no CRM para o agente ouvir e falar | iframe WebRTC com otimizações de áudio |
| **Mailing dinâmico** | Sincronização automática de listas de inadimplentes | REST API de Mailing Lists |

## Arquitetura de Integração

A integração combina dois canais de comunicação e exige dois tokens:

```
REST API (HTTPS)     → Comandos: login, discar, enviar mensagem, gerenciar listas
Socket.io (WebSocket) → Eventos: status de chamadas, mensagens WhatsApp, status de agentes
```

### Dois Tokens Obrigatórios

| Token | Uso | Endpoints |
|---|---|---|
| **Token do Agente** | Login na campanha, Socket.io, Ramal Web (WebRTC) | `POST /agent/login`, `POST /agent/logout`, `POST /agent/call/{id}/qualify` |
| **Token do Gestor** | Click2Call, gestão de campanhas, relatórios | `POST /click2call`, `GET /campaigns`, `GET /calls` |

A API **não permite que um gestor logue outro agente remotamente**. O `POST /agent/login` loga apenas o próprio usuário do token.

### Domínios da API

| Domínio | Base URL | Uso |
|---|---|---|
| Discador | `https://{subdominio}.3c.plus/api/v1` | Campanhas, agentes, chamadas |
| Click2Call | `https://3c.fluxoti.com/api/v1` | Endpoint `/click2call` exclusivamente |
| Omnichannel | `https://app.3c.fluxoti.com/omni-api/v1/whatsapp/` | WhatsApp (envio/recebimento) |
| Socket.io | `https://socket.3c.plus` | Eventos em tempo real |

A autenticação é sempre via query parameter: `?api_token={TOKEN}`.

## Referências Detalhadas

A documentação está dividida em três arquivos de referência para manter o SKILL.md enxuto:

| Arquivo | Conteúdo | Quando Ler |
|---|---|---|
| `references/guia_integracao.md` | Guia completo: Socket.io, WebRTC, Click2Call, WhatsApp, qualidade de áudio, arquitetura, exemplos de código | **Sempre** — é o documento principal |
| `references/socket_events.md` | Todos os 40 eventos Socket.io com payloads reais em TypeScript e JSON | Ao implementar listener de eventos |
| `references/api_endpoints.md` | Todos os 159 endpoints REST organizados por categoria | Ao implementar chamadas à API |

## Diretrizes Rápidas

1. **Socket.io**: Usar `transports: ['websocket']` obrigatoriamente. O token vai na query: `query: { token: "TOKEN" }`.
2. **Click2Call**: Login com token do agente → aguardar `agent-is-idle` → `POST /click2call` com token do gestor. O endpoint usa domínio `https://3c.fluxoti.com/api/v1/click2call`.
3. **WebRTC**: Ativar iframe **antes** do login. Aguardar 8-10s para registro SIP. Solicitar permissão de microfone proativamente.
4. **Qualidade de Áudio**: Constraints validadas: `echoCancellation: true, noiseSuppression: true, autoGainControl: false, sampleRate: 48000`. Desabilitar flag Chrome `#enable-webrtc-allow-input-volume-adjustment`. Sidetone do Jabra no mínimo.
5. **WhatsApp**: Hierarquia: Grupos de Canais > Canais (Instâncias) > Chats > Mensagens. Recebimento via Socket.io (`new-message-whatsapp`), envio via REST.
6. **Inconsistências de Tipos**: Normalizar campos numéricos com `Number()` antes de persistir — a API retorna tipos inconsistentes entre eventos.
7. **Worker 24/7**: Obrigatório manter um daemon Node.js conectado ao Socket.io permanentemente para capturar eventos.
