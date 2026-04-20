# Debug: Click2Call retornando 422 "Verifique se o agente está logado corretamente"

## Contexto

Estou integrando Click2Call da 3C Plus em um CRM de cobrança (React + Express). Segui a documentação e os testes anteriores que validaram o fluxo completo, mas o Click2Call está falhando com erro 422.

## Erro exato

```json
{
  "status": 422,
  "title": "Erro de validação",
  "detail": "A ligação falhou. Verifique se o agente está logado corretamente",
  "transaction_id": "a18b0160-d0a4-435d-a120-5ab5a170a391"
}
```

## Dados da conta

| Dado | Valor |
|------|-------|
| Company ID | 8948 |
| Subdomínio | liberdademedica |
| Campanha | 233972 ("A e B - Pós graduação") |
| Agente (Hyago) | ID 193740, extensão 1011 |
| Gestor (Marcelo) | ID 119414, extensão 1001 |

## O que o sistema faz (passo a passo)

### Passo 1: Carregar config do backend
```
GET /api/ligacoes/config
→ Retorna: { agentToken: "qOq45u...", agentExtension: 1011, campaignId: 233972, subdomain: "liberdademedica" }
```

### Passo 2: Montar iframe WebRTC
```html
<iframe
  src="https://liberdademedica.3c.plus/extension?api_token={AGENT_TOKEN}"
  allow="microphone; autoplay; camera; display-capture"
  style="position: fixed; width: 1px; height: 1px; opacity: 0;"
/>
```
O iframe é montado no DOM e fica persistente (não é removido ao navegar entre páginas).

### Passo 3: Aguardar registro SIP (12 segundos)
Após montar o iframe, esperamos 12 segundos para o registro SIP completar.

### Passo 4: Conectar Socket.io
```javascript
import io from 'socket.io-client';

const socket = io('https://socket.3c.plus', {
  query: { token: AGENT_TOKEN },
  transports: ['websocket'],
  reconnection: true,
});
```
**Resultado**: Console mostra `[3C+] Socket conectado` — conexão OK.

### Passo 5: Login na campanha
```
POST https://liberdademedica.3c.plus/api/v1/agent/login?api_token={AGENT_TOKEN}
Content-Type: application/x-www-form-urlencoded
Body: campaign=233972
```
**Resultado**: HTTP 200 — login aparentemente OK.

### Passo 6: Verificar status do agente (polling)
```
GET https://liberdademedica.3c.plus/api/v1/agent/status?api_token={AGENT_TOKEN}
```
**Pergunta**: Qual o retorno esperado aqui? Precisamos que `webphone === true` e `agent_status.status === 1` (idle)?

### Passo 7: Aguardar evento Socket `agent-is-idle`
Escutamos o evento via Socket.io. Se ele chega, consideramos o agente pronto.

**Pergunta**: Este evento está chegando? Ou está chegando `agent-login-failed`?

### Passo 8: Click2Call (onde falha)
```
POST https://3c.fluxoti.com/api/v1/click2call?api_token={MANAGER_TOKEN}
Content-Type: application/x-www-form-urlencoded
Body: extension=1011&phone=62991088407
```
**Resultado**: 422 "Verifique se o agente está logado corretamente"

## Dúvidas específicas

1. **O iframe WebRTC pode estar com estilo `opacity: 0` e `width: 1px`?** Isso impede o registro SIP? Ele precisa de dimensões maiores ou visibilidade para funcionar?

2. **O login retorna 200 mas o agente não fica IDLE?** O `GET /agent/status` retorna `webphone: true` ou `webphone: false` após o login?

3. **A ordem está correta?** No seu sistema, você faz:
   - Primeiro abre o iframe WebRTC
   - Depois conecta o Socket
   - Depois faz o login
   - Ou alguma ordem diferente?

4. **O `agent-is-idle` chega via Socket após o login?** Ou você recebe `agent-login-failed` com `webphone: false`?

5. **12 segundos é suficiente para o SIP registrar?** Ou precisa de mais tempo? Existe alguma forma de verificar programaticamente que o SIP registrou (além de polling `/agent/status`)?

6. **O iframe precisa de interação do usuário (click) antes de poder capturar áudio?** Navegadores modernos bloqueiam autoplay de áudio sem interação — isso pode impedir o registro SIP?

7. **Precisa solicitar `getUserMedia` antes de abrir o iframe?** Na documentação mencionamos solicitar permissão de microfone proativamente:
```javascript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
stream.getTracks().forEach(track => track.stop());
// Permissão fica cacheada — depois o iframe usa
```
Isso é obrigatório para o WebRTC da 3C Plus funcionar?

8. **A campanha 233972 está ativa/despausada?** Uma campanha pausada impede o login do agente?

9. **O agente Hyago (193740) tem webphone habilitado no painel da 3C Plus?** (Painel → Usuários → Hyago → Webphone = habilitado?)

10. **O token do agente é o correto?** O token pode ter expirado ou sido regenerado?

## Logs do console do browser

```
[3C+] Config carregada: { extension: 1011, campaign: 233972 }
[3C+] Socket conectado
[3C+] Login na campanha OK — verificando webphone...
[3C+] Agent status: { webphone: ???, status: ??? }  ← O que retorna aqui?
...
[3C+] Click2Call falhou: 422 {"status":422,"detail":"A ligação falhou. Verifique se o agente está logado corretamente"}
```

## Código fonte relevante

### Login (frontend → 3C Plus direto)
```javascript
const response = await fetch(
  `https://liberdademedica.3c.plus/api/v1/agent/login?api_token=${AGENT_TOKEN}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `campaign=233972`,
  }
);
// retorna 200
```

### Click2Call (frontend → backend proxy → 3C Plus)
```javascript
// Frontend
const response = await fetch('/api/ligacoes/click2call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '62991088407', extension: 1011 }),
});

// Backend proxy
const response = await fetch(
  `https://3c.fluxoti.com/api/v1/click2call?api_token=${MANAGER_TOKEN}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `extension=1011&phone=62991088407`,
  }
);
// retorna 422
```

### Iframe WebRTC
```html
<iframe
  src="https://liberdademedica.3c.plus/extension?api_token={AGENT_TOKEN}"
  allow="microphone; autoplay; camera; display-capture"
  class="fixed bottom-0 left-0 w-px h-px opacity-0 pointer-events-none"
/>
```

## Fluxo validado anteriormente (que funcionou)

Nos testes manuais anteriores, o fluxo que funcionou foi:
1. Abrir iframe WebRTC em tamanho visível (width: 100%, height: 220px)
2. Aguardar 8-10 segundos
3. Conectar Socket.io
4. POST /agent/login
5. Esperar evento agent-is-idle
6. POST /click2call

**Diferença principal**: o iframe era visível e de tamanho normal. Agora está com 1px e opacity 0.

## O que preciso saber

Basicamente: o que está faltando para que a 3C Plus considere o agente como "logado corretamente"? O iframe invisível pode ser o problema? Ou existe algum outro passo que estou pulando?
