# Onboarding de um Novo Agente

Checklist passo-a-passo para adicionar um agente cobrador ao sistema. **Cada novo agente precisa de ramal SIP único** — o sistema bloqueia explicitamente a tentativa de cadastrar 2 agentes com a mesma extension.

**Tempo estimado:** 15-20 minutos por agente (3C Plus + sistema). Treinamento operacional separado.

---

## 1. Painel 3C Plus (5-10min)

> Faça primeiro porque o resto depende dos IDs/tokens gerados aqui.

- [ ] **Criar usuário agente** no painel 3C Plus
  - Nome completo
  - E-mail corporativo (`@liberdademedicaedu.com.br`)
  - Função: Agente
- [ ] **Atribuir extension SIP única**
  - Cada agente precisa de um ramal próprio (ex: `4001`, `4002`, `4003`, `4004`)
  - **NÃO** reutilize extension de outro agente — o segundo SIP register desloga o primeiro silenciosamente
  - O `.env` do sistema tem `THREECPLUS_AGENT_EXTENSION` que serve apenas como fallback para ADMIN. **Não use esse mesmo número** em agente
- [ ] **Vincular à campanha de discador** (se for atender modo massa)
- [ ] **Gerar API token do agente**
  - Anote/guarde — vai ser puxado automaticamente pelo nosso sistema
- [ ] **Confirme o `agentId`** que a 3C Plus atribuiu (aparece no perfil do agente)

---

## 2. Meta WABA (se for enviar templates oficiais — 2min)

- [ ] **Adicionar o user à instância WABA Cobrança Oficial** (mesma para todos os agentes — não criar instância nova)
  - WABA permite múltiplos operadores na mesma instância
  - O sistema já força WABA na rota de template (commit `7800664`), então o agente só precisa "ter acesso" à instância
- [ ] **Templates aprovados:** o time já tem ~10 templates aprovados na Meta. Não precisa de ação adicional por agente

---

## 3. Sistema de Cobrança (5min)

### Via UI (recomendado)

- [ ] Login como **ADMIN** → menu Usuários → **Novo Usuário**
- [ ] Preencher:
  - Nome
  - E-mail (mesmo do passo 1)
  - Role: **AGENTE**
  - Ativo: ✅
- [ ] Após criar, abrir o user → botão **"Vincular agente 3C Plus"**
  - O sistema busca pelo e-mail na 3C Plus e popula `threecplusUserId`, `threecplusAgentId`, `threecplusExtension`, `threecplusAgentToken` automaticamente
  - **Se a extension já existe em outro agente**, o sistema retorna 409 com a mensagem:
    > *"A extension X já está em uso por Fulano (email). Cada agente precisa de um ramal SIP único."*
  - Nesse caso, voltar ao painel 3C Plus, ajustar a extension, e tentar vincular de novo

- [ ] **Vincular instância WhatsApp**:
  - No user → aba "Instâncias WhatsApp" → **Adicionar**
  - Selecionar a `WABA Cobrança Oficial` (compartilhada)
  - **Opcional:** se o agente vai ter número 3C+ pessoal próprio, adicionar como segunda instância (`tipo='whatsapp-3c'`)
- [ ] **Vincular campanhas** (modo discador): aba "Campanhas" no user → sync

### Verificações pós-cadastro

- [ ] No banco, confirmar que o user tem:
  - `role='AGENTE'`
  - `ativo=true`
  - `threecplusAgentId` preenchido (Int)
  - `threecplusExtension` preenchida e **única** entre agentes não-ADMIN
  - `threecplusAgentToken` preenchido (mascarado como `***` na UI)
- [ ] Confirmar 1+ linhas em `instancia_whatsapp_user` para esse `userId`
- [ ] Se a whitelist do worker não atualizou automaticamente: chamar `POST /api/users/whitelist/refresh` (admin-only) para forçar reload

---

## 4. Teste end-to-end (5min)

Login como o novo agente em janela anônima:

- [ ] **Login Google funciona** → vai para Home
- [ ] **Tela Conversas carrega** (vê lista de chats aguardando + EM_ATENDIMENTO)
- [ ] **Assumir uma conversa** funciona e mostra "Você está atendendo"
  - Em paralelo, tentar **assumir a mesma conversa** com outro user → deve retornar 409 `"Conversa ja esta sendo atendida por X"` (lock pessimista)
- [ ] **Enviar texto livre** funciona (dentro de janela 24h)
- [ ] **Enviar template Meta** funciona (mesmo que conversa primária seja 3C+, o sistema força WABA para template)
- [ ] **Tela Ligações:**
  - Tem botão "Iniciar turno" → ativa WebRTC (iframe carrega)
  - Após "Online", tentar `Click2Call` em um aluno qualquer com `tempoFalando=0` → 3C Plus inicia chamada para o ramal do agente
- [ ] **Tela Negociações:**
  - Vê lista de acordos
  - Pode criar novo acordo (passa pelo fluxo SELECAO → TERMO_ENVIADO → ...)

---

## 5. Treinamento operacional (separado, ~30min)

- [ ] Quando usar canal **WABA** (templates, primeira mensagem fora da janela 24h) vs **3C+** (atendimento dentro da janela 24h)
- [ ] Como **pausar um aluno** quando inicia negociação (impede régua automática + outros agentes)
- [ ] Como **assumir / transferir / encerrar conversa** — cada ação fica registrada em `ocorrencia` (auditoria)
- [ ] Não cancelar disparos da régua sem necessidade
- [ ] Como criar um **acordo financeiro** (Asaas + ClickSign) — fluxo Kanban
- [ ] **Disponibilidade:** se vai ficar offline/break, **encerrar conversas EM_ATENDIMENTO** ou transferir antes — pendentes ficam invisíveis até reativar

---

## 6. Quando algo não funcionar

### "Não consigo fazer Click2Call"
- Verifique se `threecplusExtension` está preenchida no perfil do agente no SEI
- Verifique se o agente está logado e online no WebRTC (iframe da 3C Plus carregou e mostra "Conectado")
- Veja se 2 agentes estão usando a mesma extension (não deveria — o sistema bloqueia, mas se foi criado antes da validação, pode acontecer com users legados)

### "Tentei mandar template e deu erro"
- Confirmar que a instância selecionada é **WABA** (badge no SeletorCanal)
- Se mesmo assim falhar, ver logs do backend — o log enriquecido mostra `template=X chat=Y instancia=Z status=N` e o body da resposta da 3C Plus

### "Worker não está recebendo eventos do agente novo"
- Chamar `POST /api/users/whitelist/refresh` para forçar reload imediato (default refresca a cada 5min)
- Verificar nos logs do backend o `[Whitelist] Carregada — agentes: [...]` — confirmar que o `threecplusAgentId` do novo está na lista

### "Conversa aparece atribuída a outro agente quando assumo"
- É comportamento correto (lock pessimista). A outra pessoa pegou primeiro.
- Solicite que ele **transfira** a conversa para você se for o caso.

---

## Anexo — Modelo de dados

Tabelas envolvidas no cadastro de um agente:

| Tabela | Campos críticos | Notas |
|---|---|---|
| `user` | `email`, `nome`, `role`, `ativo`, `threecplusAgentId`, `threecplusExtension`, `threecplusAgentToken`, `threecplusUserId` | Token mascarado na UI |
| `instancia_whatsapp_user` | `userId`, `instanciaId`, `apelido`, `telefone`, `tipo`, `removidoEm` | Soft-delete; pode ser N por user |
| `campanha_user` (FK lógica) | `userId`, `campanhaId` | Vinculação a campanhas do discador |

---

**Última atualização:** 2026-05-13
**Relacionado:** [meta documentacao/preparo-multiagentes-2026-05-13.md](../meta%20documentacao/preparo-multiagentes-2026-05-13.md)
