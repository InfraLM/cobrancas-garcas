# Análise: Plano do Claude vs Skill 3C Plus Integration

> Análise detalhada do plano proposto pelo Claude para a tela "Ligações Ativas" em relação aos requisitos e descobertas da skill 3cplus-integration.

---

## Resumo Executivo

O plano do Claude está **95% alinhado** com a skill 3cplus-integration. A arquitetura proposta é sólida e segue as melhores práticas identificadas durante os testes reais. **Você pode continuar com confiança**, mas há **3 pontos críticos** que precisam de ajustes.

---

## ✅ O Que Está Correto

### 1. Arquitetura Frontend-Backend Separada

O Claude propôs corretamente que os tokens 3C Plus **nunca fiquem no frontend**. Isso está alinhado com a descoberta crítica na skill:

> **Diretrizes Rápidas (item 7):** Obrigatório manter um daemon Node.js conectado ao Socket.io permanentemente para capturar eventos.

**Status:** ✅ Correto. O backend será responsável por manter a conexão Socket.io 24/7.

### 2. Máquina de Estados da Página

A sequência proposta está correta:

```
IDLE → SELECAO_TIPO → CONFIG_CAMPANHA → TESTE_AUDIO → EM_LIGACAO → QUALIFICACAO
```

Isso reflete exatamente o fluxo validado em ambiente real:

1. **IDLE** — Agente não está em campanha
2. **SELECAO_TIPO** — Escolhe Individual ou Massa
3. **CONFIG_CAMPANHA** — Seleciona listas (apenas para Massa)
4. **TESTE_AUDIO** — Valida microfone e ativa WebRTC
5. **EM_LIGACAO** — Aguarda eventos Socket (call-was-connected, etc.)
6. **QUALIFICACAO** — Qualifica após chamada

**Status:** ✅ Correto.

### 3. Configuração de Áudio Jabra

O Claude incluiu as constraints validadas exatamente como documentado na skill:

```javascript
echoCancellation: true,
noiseSuppression: true,
autoGainControl: false,  // ← Crítico: Jabra tem AGC próprio
sampleRate: 48000,       // ← Crítico: qualidade DVD, não 16000
sampleSize: 16,
channelCount: 1          // ← Mono para voz
```

**Status:** ✅ Correto. Isso vai produzir a melhor qualidade de áudio.

### 4. WebRTC Iframe + Tempo de Registro SIP

O Claude propôs corretamente:

> **Ativar WebRTC: loading 8-10s → "SIP Registrado"**

Isso está alinhado com a descoberta na skill:

> **Diretrizes Rápidas (item 3):** Ativar iframe **antes** do login. Aguardar 8-10s para registro SIP.

**Status:** ✅ Correto.

### 5. Dois Tokens Obrigatórios

O Claude entendeu que são necessários **dois tokens**:

- **Token do Agente** — Login, Socket.io, WebRTC
- **Token do Gestor** — Click2Call, relatórios

E propôs corretamente que o token do gestor fica **no backend** (encrypted).

**Status:** ✅ Correto. Isso evita exposição de credenciais.

### 6. Eventos Socket Mapeados

O Claude listou 9 eventos principais:

```
created → answered → connected → hung-up → finished → unanswered → abandoned → history → qualificacao
```

Isso está alinhado com os 40 eventos documentados na skill. Os 9 principais são exatamente os que importam para a UI.

**Status:** ✅ Correto.

### 7. Integração com Componentes Existentes

O Claude identificou corretamente que deve reutilizar:

- `Modal` (para PopupAluno)
- `NovaNegociacaoDrawer` (para criar negociação durante chamada)
- `StatusBadge` (para status do aluno)
- `regrasMock` e `alunosMock` (para dados)

**Status:** ✅ Correto. Isso mantém consistência visual.

---

## ⚠️ Pontos Críticos Que Precisam de Ajustes

### Crítico 1: Click2Call Requer Login Prévio

O plano não menciona explicitamente que **Click2Call requer que o agente esteja logado em campanha**.

**Fluxo correto (da skill):**

```
1. POST /agent/login (token agente) → aguardar agent-is-idle
2. POST /click2call (token gestor) → call-was-connected
```

**O que o plano propôs:**

```
Individual: input telefone → teste audio → EM_LIGACAO
```

**Problema:** Falta o passo de login na campanha antes do Click2Call.

**Solução:** Adicionar ao fluxo Individual:

```
1. Selecionar Individual
2. Inserir número
3. Teste de áudio
4. Ativar WebRTC (8-10s)
5. POST /agent/login (backend) → aguardar agent-is-idle
6. POST /click2call (backend) → call-was-connected
7. EM_LIGACAO
```

**Recomendação:** Adicionar um estado intermediário `AGUARDANDO_LOGIN` entre `TESTE_AUDIO` e `EM_LIGACAO` para Individual.

---

### Crítico 2: Qualificações Vêm do Evento call-was-connected

O plano propôs:

> **Qualificacoes vem do campaign.dialer.qualification_list**

Isso está correto, mas **incompleto**. As qualificações chegam via Socket.io no evento `call-was-connected`:

```json
{
  "campaign": {
    "dialer": {
      "qualification_list": {
        "qualifications": [
          { "id": 1, "name": "Vendido", "conversion": true },
          { "id": 2, "name": "Não Qualificado", "conversion": false }
        ]
      }
    }
  }
}
```

**O que falta:** O plano não menciona que as qualificações devem ser **extraídas do evento Socket** e armazenadas no estado da página.

**Recomendação:** Adicionar ao hook `useLigacoes`:

```typescript
// Quando call-was-connected chegar via Socket
const handleCallWasConnected = (data) => {
  const qualificacoes = data.campaign.dialer.qualification_list.qualifications;
  setQualificacoesDisponiveis(qualificacoes);
};
```

---

### Crítico 3: Transcript da Chamada Não Está Mapeado

O plano mencionou:

> **Ao final da chamada, o sistema irá fazer a requisão do transcript daquela chamada para termos registro.**

Mas a skill não documenta um endpoint específico para transcript. Isso pode ser:

1. **Gravação automática** — A 3C Plus grava chamadas automaticamente se `recording_enabled: true` na campanha
2. **Transcrição via API** — Não há endpoint documentado na skill para transcrição

**Recomendação:** Esclarecer com a 3C Plus se:

- Há endpoint para download de gravação: `GET /calls/{call-id}/recording`
- Há endpoint para transcrição: Não documentado
- Ou se a transcrição é manual

**Para agora:** Implementar apenas o download de gravação, que está documentado na skill:

```typescript
// Após call-was-finished
const downloadGravacao = async (callId) => {
  const response = await fetch(
    `https://{subdominio}.3c.plus/api/v1/calls/${callId}/recording?api_token={TOKEN}`
  );
  // Salvar arquivo
};
```

---

## ✅ Pontos Que Estão Bem Pensados

### 1. Segurança: Tokens no Backend

O Claude propôs corretamente que os tokens 3C Plus **nunca fiquem no frontend**. Todas as chamadas à API 3C Plus devem ser feitas pelo backend.

**Implementação sugerida:**

```typescript
// Frontend
POST /api/ligacoes/click2call
Body: { numeroTelefone: "62991088407" }

// Backend
POST https://3c.fluxoti.com/api/v1/click2call?api_token={TOKEN_GESTOR}
Body: { extension: 1011, phone: "62991088407" }
```

### 2. Rate Limiting

O Claude propôs:

> **Rate limiting no click2call (1 chamada/5s por agente)**

Isso é essencial para evitar abuso e respeitar limites da 3C Plus.

### 3. Dados Reais da Liberdade Médica

O Claude incluiu os dados validados:

```
Company: 8948
Campaign: 233972
Agent Hyago: ID 193740, Extension 1011
Socket: wss://socket.3c.plus
```

Isso facilita testes iniciais.

---

## 📋 Checklist de Validação

Antes de começar a implementação, valide:

| Item | Status | Ação |
|---|---|---|
| Tokens 3C Plus no backend (não frontend) | ✅ | Prosseguir |
| Máquina de estados correta | ✅ | Prosseguir |
| Constraints de áudio Jabra | ✅ | Prosseguir |
| WebRTC 8-10s SIP | ✅ | Prosseguir |
| **Click2Call requer login prévio** | ⚠️ | **Ajustar fluxo** |
| **Qualificações do evento Socket** | ⚠️ | **Adicionar ao hook** |
| **Transcript/Gravação mapeado** | ⚠️ | **Esclarecer com 3C Plus** |
| Rate limiting implementado | ✅ | Prosseguir |
| Dados reais incluídos | ✅ | Prosseguir |

---

## 🎯 Recomendações Finais

### Antes de Começar

1. **Ajuste o fluxo de Click2Call** — Adicione o passo de login antes de discar
2. **Mapeie qualificações do Socket** — Extraia do evento `call-was-connected`
3. **Esclareça transcript** — Confirme com 3C Plus se há endpoint de transcrição

### Durante a Implementação

1. **Mocks com dados reais** — Use os IDs da Liberdade Médica nos mocks
2. **Simule todos os 9 eventos** — Teste a sequência completa de chamada
3. **Teste audio com Jabra** — Valide as constraints antes de integrar com 3C Plus real

### Após a Implementação

1. **Integre com backend real** — Remova mocks e conecte ao Socket.io real
2. **Teste com agente real** — Use a conta da Liberdade Médica para validar
3. **Monitore logs** — Capture erros de Socket, API, WebRTC

---

## Conclusão

O plano do Claude é **sólido e bem pensado**. A arquitetura está correta, a segurança foi considerada e os detalhes técnicos (áudio, WebRTC, eventos) estão alinhados com a skill 3cplus-integration.

**Você pode continuar com confiança**, mas faça os **3 ajustes críticos** antes de começar a codificação. Isso vai economizar tempo de refatoração depois.

**Próximo passo:** Começar pela implementação dos tipos (`src/types/ligacao.ts`) e mocks, depois os componentes simples, e finalmente o hook central `useLigacoes` que orquestra tudo.
