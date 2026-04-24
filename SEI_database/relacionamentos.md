# Mapa de Relacionamentos do Banco de Dados

Fonte da verdade para todas as relações entre tabelas. Baseado nos DDLs originais do SEI (`SEI_database/ddl_SEI/`) e nas definições das tabelas customizadas.

> **Importante:** Não existem FK constraints no banco (para manter o sync simples). Este documento substitui as constraints como guia para JOINs, queries e desenvolvimento.

---

## Seção A — Relações INTERNAS (JOINs possíveis)

Relações onde **ambas as tabelas existem** no nosso banco. São as únicas que podemos usar em queries reais.

### Tabelas no nosso banco (26)

**SEI (20):** contareceber, pessoa, matricula, matriculaperiodo, turma, curso, negociacaocontareceber, contarecebernegociado, negociacaorecebimento, contarecebernegociacaorecebimento, contareceberrecebimento, formapagamentonegociacaorecebimento, formapagamento, cartaocreditodebitorecorrenciapessoa, documentoassinado, documentoassinadopessoa, condicaopagamentoplanofinanceirocurso, planodescontocontareceber, planodesconto, funcionario

**Customizadas (6):** pf_alunos, pf_plantoes, serasa, blip_contacts, blip_tickets, User

### Relações confirmadas pelos DDLs

#### contareceber (parcelas/títulos financeiros)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 1 | pessoa | pessoa.codigo | N:1 | Devedor da parcela |
| 2 | matriculaaluno | matricula.matricula | N:1 | Matrícula do aluno |
| 3 | turma | turma.codigo | N:1 | Turma da parcela |
| 4 | funcionario | funcionario.codigo | N:1 | Funcionário responsável |
| 5 | candidato | pessoa.codigo | N:1 | Candidato/prospect |
| 6 | responsavelfinanceiro | pessoa.codigo | N:1 | Responsável financeiro |
| 7 | codorigem | negociacaocontareceber.codigo | N:1 | Quando `tipoorigem = 'NCR'`, aponta para a negociação que gerou a parcela (lógica, não FK explícita) |
| 8 | matriculaperiodo | matriculaperiodo.codigo | N:1 | Período letivo vinculado (indexado, mas sem FK explícita no DDL) |

#### matricula (vínculo aluno-curso)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 9 | aluno | pessoa.codigo | N:1 | Aluno matriculado |
| 10 | curso | curso.codigo | N:1 | Curso da matrícula |
| 11 | consultor | funcionario.codigo | N:1 | Consultor comercial |

#### matriculaperiodo (período letivo)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 12 | matricula | matricula.matricula | N:1 | Matrícula do período |
| 13 | turma | turma.codigo | N:1 | Turma do período |
| 14 | contareceber | contareceber.codigo | N:1 | Conta vinculada |
| 15 | condicaopagamentoplanofinanceirocurso | condicaopagamentoplanofinanceirocurso.codigo | N:1 | Condição de pagamento |

#### turma (turma/cohort)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 16 | curso | curso.codigo | N:1 | Curso da turma |
| 17 | tutorblackboard | funcionario.codigo | N:1 | Tutor LMS |

#### negociacaocontareceber (renegociação de dívida)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 18 | pessoacomissionada | pessoa.codigo | N:1 | Pessoa comissionada |
| 19 | pessoa | pessoa.codigo | N:1 | Devedor da negociação (indexado, sem FK explícita) |
| 20 | matriculaaluno | matricula.matricula | N:1 | Matrícula renegociada (indexado, sem FK explícita) |
| 21 | funcionario | funcionario.codigo | N:1 | Quem criou a negociação (indexado, sem FK explícita) |

#### contarecebernegociado (títulos substituídos em acordo)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 22 | contareceber | contareceber.codigo | N:1 | Título original negociado |
| 23 | negociacaocontareceber | negociacaocontareceber.codigo | N:1 | Negociação pai |

#### negociacaorecebimento (cabeçalho de pagamento)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 24 | pessoa | pessoa.codigo | N:1 | Quem pagou |

#### contarecebernegociacaorecebimento (liga título ao recibo)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 25 | contareceber | contareceber.codigo | 1:1 | Título pago (UNIQUE constraint no DDL) |
| 26 | negociacaorecebimento | negociacaorecebimento.codigo | N:1 | Recebimento pai |

#### contareceberrecebimento (detalhe do pagamento por título)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 27 | contareceber | contareceber.codigo | N:1 | Título detalhado |
| 28 | formapagamento | formapagamento.codigo | N:1 | Forma de pagamento usada |
| 29 | formapagamentonegociacaorecebimento | formapagamentonegociacaorecebimento.codigo | N:1 | Detalhe da forma de pagamento |
| 30 | negociacaorecebimento | negociacaorecebimento.codigo | N:1 | Recebimento pai (lógica, sem FK explícita no DDL) |

#### formapagamentonegociacaorecebimento (forma de pagamento do recibo)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 31 | formapagamento | formapagamento.codigo | N:1 | Tipo (PIX, Boleto, Cartão, etc) |
| 32 | negociacaorecebimento | negociacaorecebimento.codigo | N:1 | Recebimento pai |

#### planodescontocontareceber (desconto aplicado a um título)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 33 | contareceber | contareceber.codigo | N:1 | Título com desconto |
| 34 | planodesconto | planodesconto.codigo | N:1 | Regra de desconto aplicada |

#### condicaopagamentoplanofinanceirocurso (regras financeiras)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 35 | planodescontopadrao | planodesconto.codigo | N:1 | Desconto padrão da condição |

#### cartaocreditodebitorecorrenciapessoa (cartões salvos)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 36 | pessoa | pessoa.codigo | N:1 | Dono do cartão |
| 37 | matricula | matricula.matricula | N:1 | Matrícula vinculada |
| 38 | responsavelfinanceiro | pessoa.codigo | N:1 | Responsável financeiro do cartão |

#### documentoassinado (contratos/documentos)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 39 | matricula | matricula.matricula | N:1 | Matrícula do documento |
| 40 | turma | turma.codigo | N:1 | Turma do documento |
| 41 | curso | curso.codigo | N:1 | Curso do documento |
| 42 | matriculaperiodo | matriculaperiodo.codigo | N:1 | Período do documento |
| 43 | negociacaocontareceber | negociacaocontareceber.codigo | N:1 | Negociação vinculada |
| 44 | bloqueadopor | documentoassinadopessoa.codigo | N:1 | Quem bloqueou |

#### documentoassinadopessoa (assinatura por pessoa)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 45 | pessoa | pessoa.codigo | N:1 | Quem assinou |
| 46 | documentoassinado | documentoassinado.codigo | N:1 | Documento assinado |

#### funcionario (staff)
| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 47 | pessoa | pessoa.codigo | 1:1 | Pessoa do funcionário (UNIQUE constraint em matricula) |

#### Tabelas customizadas
| # | De (tabela.coluna) | Para (tabela.coluna) | Tipo | Descrição |
|---|---------------------|----------------------|------|-----------|
| 48 | pf_alunos.matricula | matricula.matricula | 1:1 | Perfil consolidado → matrícula SEI |
| 49 | pf_plantoes.matricula | matricula.matricula | N:1 | Plantão → matrícula SEI |
| 50 | serasa.cpf_cnpj_numerico | pessoa.cpf | N:1 | Negativação → pessoa SEI |
| 51 | blip_contacts.cpf_sanitizado | pessoa.cpf | N:1 | Contato Blip → pessoa SEI |
| 52 | blip_tickets.customerIdentity | blip_contacts.identity | N:1 | Ticket → contato Blip |

> **Nota sobre JOINs cross-format (relações 50-51):**
> - `serasa.cpf_cnpj_numerico` = apenas dígitos (ex: `00306596121`)
> - `pessoa.cpf` = formatado (ex: `003.065.961-21`)
> - `blip_contacts.cpf_sanitizado` = formatado como pessoa.cpf
> - Para JOIN serasa↔pessoa, precisa remover formatação: `REPLACE(REPLACE(pessoa.cpf, '.', ''), '-', '') = serasa.cpf_cnpj_numerico`

---

## Seção B — Relações EXTERNAS (tabelas que não temos)

Relações dos DDLs que apontam para tabelas que **não clonamos** do SEI. Não servem para JOINs, mas explicam o significado dos campos.

### contareceber → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| contacorrente | contacorrente.codigo | Conta corrente bancária |
| centroreceita | centroreceita.codigo | Centro de receita contábil |
| descontoprogressivo | descontoprogressivo.codigo | Regra de desconto progressivo |
| unidadeensinofinanceira | unidadeensino.codigo | Unidade de ensino financeira |
| parceiro | parceiro.codigo | Parceiro comercial |
| fornecedor | fornecedor.codigo | Fornecedor |
| indicereajustepadraoporatraso | indicereajuste.codigo | Índice de reajuste por atraso |
| registrocobrancacontareceber | registronegativacaocobrancacontareceber.codigo | Registro de negativação |
| processamentointegracaofinanceiradetalhe | processamentointegracaofinanceiradetalhe.codigo | Integração financeira |
| notafiscalsaidaservico | notafiscalsaidaservico.codigo | Nota fiscal de saída |
| responsavelcancelamento | usuario.codigo | Usuário que cancelou |
| usuariodesbloqueoudescontorecebimento | usuario.codigo | Usuário que desbloqueou desconto |

### pessoa → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| cidade | cidade.codigo | Cidade do endereço |
| nacionalidade | paiz.codigo | País de nacionalidade |
| naturalidade | cidade.codigo | Cidade de nascimento |
| perfileconomico | perfileconomico.codigo | Perfil econômico |
| cidadefiador | cidade.codigo | Cidade do fiador |
| paisfiador | paiz.codigo | País do fiador |
| tipomidiacaptacao | tipomidiacaptacao.codigo | Mídia de captação |
| reponsavelultimaalteracao | usuario.codigo | Usuário que alterou |

### matricula → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| unidadeensino | unidadeensino.codigo | Unidade de ensino |
| turno | turno.codigo | Turno (manhã, tarde, noite) |
| inscricao | inscricao.codigo | Inscrição do vestibular |
| usuario | usuario.codigo | Usuário que criou |
| tranferenciaentrada | transferenciaentrada.codigo | Transferência de entrada |
| formacaoacademica | formacaoacademica.codigo | Formação acadêmica |
| autorizacaocurso | autorizacaocurso.codigo | Autorização MEC |
| gradecurricularatual | gradecurricular.codigo | Grade curricular |
| tipomidiacaptacao | tipomidiacaptacao.codigo | Mídia de captação |
| responsavelliberacaodesconto | usuario.codigo | Quem liberou desconto |

### matriculaperiodo → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| periodoletivomatricula | periodoletivo.codigo | Período letivo |
| gradecurricular | gradecurricular.codigo | Grade curricular |
| planofinanceirocurso | planofinanceirocurso.codigo | Plano financeiro |
| processomatricula | processomatricula.codigo | Processo de matrícula |
| unidadeensinocurso | unidadeensinocurso.codigo | Unidade+curso |
| contratomatricula | textopadrao.codigo | Texto do contrato |
| contratofiador | textopadrao.codigo | Contrato do fiador |
| contratoextensao | textopadrao.codigo | Contrato de extensão |
| responsavelliberacaomatricula | usuario.codigo | Quem liberou |
| responsavelemissaoboletomatricula | usuario.codigo | Quem emitiu boleto |
| responsavelrenovacaomatricula | usuario.codigo | Quem renovou |
| responsavelmatriculaforaprazo | usuario.codigo | Quem matriculou fora do prazo |

### turma → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| periodoletivo | periodoletivo.codigo | Período letivo |
| turno | turno.codigo | Turno |
| unidadeensino | unidadeensino.codigo | Unidade de ensino |
| gradecurricular | gradecurricular.codigo | Grade curricular |
| configuracaoacademico | configuracaoacademico.codigo | Config acadêmica |
| planofinanceirocurso | planofinanceirocurso.codigo | Plano financeiro |
| contacorrente | contacorrente.codigo | Conta corrente |
| chancela | chancela.codigo | Chancela |
| indicereajuste | indicereajuste.codigo | Índice de reajuste |
| configuracaoead | configuracaoead.codigo | Config EAD |
| avaliacaoonline | avaliacaoonline.codigo | Avaliação online |
| modalidadeturma | modalidadeturma.codigo | Modalidade |
| centroresultado | centroresultado.codigo | Centro de resultado |

### curso → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| configuracaoacademico | configuracaoacademico.codigo | Config acadêmica |
| areaconhecimento | areaconhecimento.codigo | Área de conhecimento |
| questionario | questionario.codigo | Questionário |
| configuracaoestagio | configuracaoestagio.codigo | Config de estágio |
| configuracaotcc | configuracaotcc.codigo | Config de TCC |

### negociacaocontareceber → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| contacorrente | contacorrente.codigo | Conta corrente |
| centroreceita | centroreceita.codigo | Centro de receita |
| unidadeensino | unidadeensino.codigo | Unidade de ensino |
| responsavel | usuario.codigo | Usuário responsável |
| descontoprogressivo | descontoprogressivo.codigo | Desconto progressivo |
| parceiro | parceiro.codigo | Parceiro |
| condicaorenegociacao | condicaorenegociacao.codigo | Condição de renegociação |
| itemcondicaorenegociacao | itemcondicaorenegociacao.codigo | Item da condição |
| fornecedor | fornecedor.codigo | Fornecedor |
| indicereajuste | indicereajuste.codigo | Índice de reajuste |
| agentenegativacaocobrancacontareceber | agentenegativacaocobrancacontareceber.codigo | Agente de negativação |
| requerimento | requerimento.codigo | Requerimento |

### negociacaorecebimento → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| contacorrentecaixa | contacorrente.codigo | Conta corrente do caixa |
| responsavel | usuario.codigo | Usuário responsável |
| unidadeensino | unidadeensino.codigo | Unidade de ensino |
| fornecedor | fornecedor.codigo | Fornecedor |
| parceiro | parceiro.codigo | Parceiro |

### formapagamentonegociacaorecebimento → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| cheque | cheque.codigo | Cheque |
| contacorrente | contacorrente.codigo | Conta corrente |
| operadoracartao | operadoracartao.codigo | Operadora de cartão |
| categoriadespesa | categoriadespesa.codigo | Categoria de despesa |
| configuracaorecebimentocartaocredito | configuracaorecebimentocartaoonline.codigo | Config cartão online |
| usuariodesbloqueouformarecebimentonorecebimento | usuario.codigo | Quem desbloqueou |

### cartaocreditodebitorecorrenciapessoa → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| operadoracartao | operadoracartao.codigo | Operadora do cartão |

### documentoassinado → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| arquivo | arquivo.codigo | Arquivo PDF/doc |
| arquivovisual | arquivo.codigo | Arquivo visual |
| usuario | usuario.codigo | Usuário que criou |
| gradecurricular | gradecurricular.codigo | Grade curricular |
| disciplina | disciplina.codigo | Disciplina |
| unidadeensino | unidadeensino.codigo | Unidade de ensino |
| planoensino | planoensino.codigo | Plano de ensino |
| expedicaodiploma | expedicaodiploma.codigo | Expedição de diploma |
| contapagar | contapagar.codigo | Conta a pagar |

### planodesconto → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| categoriadesconto | categoriadesconto.codigo | Categoria do desconto |
| responsavelativacao | usuario.codigo | Quem ativou |
| responsavelinativacao | usuario.codigo | Quem inativou |
| unidadeensino | unidadeensino.codigo | Unidade de ensino |

### planodescontocontareceber → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| convenio | convenio.codigo | Convênio |
| imposto | imposto.codigo | Imposto |
| usuarioresponsavel | usuario.codigo | Quem aplicou |
| categoriadesconto | categoriadesconto.codigo | Categoria |

### condicaopagamentoplanofinanceirocurso → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| planofinanceirocurso | planofinanceirocurso.codigo | Plano financeiro |
| descontoprogressivopadrao | descontoprogressivo.codigo | Desconto progressivo padrão |
| descontoprogressivopadraomatricula | descontoprogressivo.codigo | Desc. progressivo matrícula |
| descontoprogressivoprimeiraparcela | descontoprogressivo.codigo | Desc. progressivo 1a parcela |
| textopadraocontratomatricula | textopadrao.codigo | Texto do contrato |
| centroreceita | centroreceita.codigo | Centro de receita |
| responsavelativacao | usuario.codigo | Quem ativou |
| responsavelinativacao | usuario.codigo | Quem inativou |

### funcionario → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| certificadodigital | arquivo.codigo | Certificado digital |

### contarecebernegociado → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| itemcondicaodescontorenegociacao | itemcondicaodescontorenegociacao.codigo | Item condição desconto |

### contareceberrecebimento → tabelas externas
| Coluna | Referencia (não temos) | Descrição |
|--------|----------------------|-----------|
| responsavel | usuario.codigo | Usuário responsável |
| notafiscalsaidaservico | notafiscalsaidaservico.codigo | Nota fiscal |

---

## Seção C — Campos-chave de Negócios

### contareceber.situacao (status da parcela)
| Código | Significado |
|--------|------------|
| AR | A Receber (em aberto, não vencido ou vencido sem pagamento) |
| CF | Cancelado Financeiro (usar datacancelamento como proxy de churn) |
| NE | Negociado (substituído por nova negociação) |
| RE | Recebido (pagamento confirmado) |

### contareceber.tipoorigem (origem da parcela)
| Código | Significado |
|--------|------------|
| MAT | Matrícula (parcela regular do curso, entrada) |
| MEN | Mensalidade (parcela recorrente) |
| NCR | Negociação (parcela gerada por renegociação) |
| OUT | Outros |
| REQ | Requerimento |

### Flags de cobrança
| Campo | Tabela | Significado |
|-------|--------|------------|
| serasa | pessoa | Se está negativado no Serasa (Boolean) |
| bloquearcontatocrm | pessoa | Bloquear contato via CRM (Boolean) |
| naoenviarmensagemcobranca | matricula | Não enviar mensagem de cobrança (Boolean) |

### Fluxo financeiro (cadeia de tabelas)
```
pessoa ← matricula ← matriculaperiodo
   ↓                        ↓
   └→ contareceber ←────────┘
         ↓
         ├→ planodescontocontareceber → planodesconto
         ├→ contarecebernegociado → negociacaocontareceber
         └→ contarecebernegociacaorecebimento → negociacaorecebimento
                                                     ↓
                                              contareceberrecebimento → formapagamento
                                                     ↓
                                              formapagamentonegociacaorecebimento
```

### JOINs comuns

**Parcelas em aberto de um aluno (por CPF):**
```sql
SELECT cr.codigo, cr.valor, cr.datavencimento, cr.situacao,
       p.nome, p.cpf, p.celular
FROM contareceber cr
JOIN pessoa p ON cr.pessoa = p.codigo
WHERE p.cpf = '003.065.961-21'
  AND cr.situacao = 'AR';
```

**Aluno com dados de matrícula e turma:**
```sql
SELECT p.nome, p.cpf, m.matricula, m.situacao AS sit_matricula,
       t.identificadorturma, c.nome AS curso
FROM pessoa p
JOIN matricula m ON m.aluno = p.codigo
JOIN turma t ON m.turma = t.codigo
JOIN curso c ON m.curso = c.codigo;
```

**Verificar se aluno está no Serasa:**
```sql
SELECT p.nome, p.cpf, s.contrato, s.valor, s.situacao AS sit_serasa
FROM pessoa p
JOIN serasa s ON REPLACE(REPLACE(p.cpf, '.', ''), '-', '') = s.cpf_cnpj_numerico;
```

**Verificar se aluno tem ticket aberto no Blip (Financeiro):**
```sql
SELECT p.nome, bc.cpf_sanitizado, bt.id AS ticket_id, bt.status, bt.team
FROM pessoa p
JOIN blip_contacts bc ON bc.cpf_sanitizado = p.cpf
JOIN blip_tickets bt ON bt.customerIdentity = bc.identity
WHERE bt.team = 'Fila do Financeiro'
  AND bt.status IN ('Waiting', 'Open');
```

**Alunos inadimplentes SEM ticket aberto (prontos para cobrança):**
```sql
SELECT DISTINCT p.nome, p.cpf, p.celular
FROM contareceber cr
JOIN pessoa p ON cr.pessoa = p.codigo
LEFT JOIN blip_contacts bc ON bc.cpf_sanitizado = p.cpf
LEFT JOIN blip_tickets bt ON bt.customerIdentity = bc.identity
  AND bt.team = 'Fila do Financeiro'
  AND bt.status IN ('Waiting', 'Open')
WHERE cr.situacao = 'AR'
  AND cr.datavencimento < CURRENT_DATE
  AND bt.id IS NULL;
```

---

## Seção C — Tabelas CRM (novas, escrita do sistema)

Tabelas criadas para o CRM de Cobrança. Populadas pelo Worker Socket.io 24/7 e por ações dos agentes. Todas as relações são **documentais** (sem FK constraints), seguindo o padrão das tabelas SEI.

### Tabelas CRM (6)

**conversa_cobranca, mensagem_whatsapp, registro_ligacao, evento_ligacao_raw, webhook_event, ocorrencia**

### conversa_cobranca (entidade de domínio — conversa de cobrança)

Cada conversa WhatsApp recebida pelo Worker vira uma ConversaCobranca com enriquecimento financeiro.

| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 1 | chatId | 3C Plus (externo) | 1:1 | ID do chat na plataforma 3C Plus (UNIQUE) |
| 2 | instanciaId | 3C Plus (externo) | N:1 | Instância WhatsApp conectada (numero/canal) |
| 3 | pessoaCodigo | pessoa.codigo | N:1 | Aluno devedor vinculado (via telefone) |
| 4 | matricula | matricula.matricula | N:1 | Matrícula ativa do aluno |
| 5 | agenteId | (futuro: User.id) | N:1 | Agente interno atribuído |
| 6 | acordoId | (futuro: AcordoFinanceiro.id) | N:1 | Acordo ativo vinculado |

**Indexes:** `[status, ultimaMensagemCliente DESC]`, `[agenteId, status]`, `[pessoaCodigo]`, `[instanciaId, status]`

**Campos de status:** `AGUARDANDO`, `EM_ATENDIMENTO`, `SNOOZE`, `ENCERRADA`

**Motivos de encerramento:** `ACORDO_FECHADO`, `PAGO_AVISTA`, `SEM_RETORNO`, `RECUSOU`, `NAO_E_DEVEDOR`, `TRANSFERIDO_JURIDICO`, `OUTRO`

**Campos de snapshot financeiro:** `valorInadimplente`, `diasAtraso`, `serasaAtivo`, `temAcordoAtivo` — atualizados periodicamente pelo service de enriquecimento.

---

### mensagem_whatsapp (cada mensagem de WhatsApp)

| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 1 | chatId | conversa_cobranca.chatId | N:1 | Conversa à qual pertence (NOT FK, tipo Int) |
| 2 | pessoaCodigo | pessoa.codigo | N:1 | Aluno vinculado (nullable — preenchido pelo worker) |
| 3 | instanciaId | 3C Plus (externo) | N:1 | Instância WhatsApp |
| 4 | agenteId | (futuro: User.id) | N:1 | Agente que enviou (se fromMe=true) |

**UNIQUE:** `mensagemExternaId` (dedup — ID da mensagem na 3C Plus)

**Indexes:** `[contatoNumero, timestamp]`, `[pessoaCodigo, timestamp]`, `[chatId, timestamp]`

**Campos de conteúdo:** `tipo` (chat/audio/image/document/video), `corpo`, `mediaUrl`, `mediaNome`, `transcricaoAudio`, `ack` (null/device/read)

---

### registro_ligacao (registro consolidado de cada chamada)

| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 1 | pessoaCodigo | pessoa.codigo | N:1 | Aluno que foi ligado (nullable) |
| 2 | telefone | pessoa.celular (via regex) | N:1 | Número discado |
| 3 | agenteId | (futuro: User.id) | N:1 | Agente que fez a ligação |
| 4 | campanhaId | 3C Plus (externo) | N:1 | Campanha na 3C Plus |
| 5 | qualificacaoId | 3C Plus (externo) | N:1 | Qualificação selecionada |

**UNIQUE:** `telephonyId` (ID da chamada na plataforma telefônica)

**Indexes:** `[pessoaCodigo, dataHoraChamada]`, `[telefone, dataHoraChamada]`, `[agenteId, dataHoraChamada]`

**Campos de timeline:** `dataHoraChamada`, `dataHoraAtendida`, `dataHoraConectada`, `dataHoraDesligada`

**Campos de duração:** `tempoTotal`, `tempoEspera`, `tempoFalando`, `tempoComAgente`, `tempoAcw`

---

### evento_ligacao_raw (append-only — payloads brutos de eventos)

| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 1 | telephonyId | registro_ligacao.telephonyId | N:1 | Vincula ao registro consolidado |

**Indexes:** `[telephonyId]`, `[tipo, criadoEm]`

**Campos:** `tipo` (call-was-created, agent-is-idle, etc.), `payload` (JSON bruto)

---

### webhook_event (eventos de Asaas/ClickSign — idempotente)

| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 1 | pessoaCodigo | pessoa.codigo | N:1 | Pessoa relacionada |
| 2 | acordoId | (futuro: AcordoFinanceiro.id) | N:1 | Acordo relacionado |

**UNIQUE composto:** `[origem, eventoId]` (garante idempotência)

**Indexes:** `[processado, criadoEm]`, `[pessoaCodigo]`

---

### ocorrencia (timeline unificada — auditoria)

| # | Coluna | Referencia | Tipo | Descrição |
|---|--------|-----------|------|-----------|
| 1 | pessoaCodigo | pessoa.codigo | N:1 | Pessoa envolvida (obrigatório) |
| 2 | registroLigacaoId | registro_ligacao.id | N:1 | Se gerada por ligação |
| 3 | mensagemWhatsappId | mensagem_whatsapp.id | N:1 | Se gerada por mensagem |
| 4 | webhookEventId | webhook_event.id | N:1 | Se gerada por webhook |
| 5 | acordoId | (futuro: AcordoFinanceiro.id) | N:1 | Se gerada por negociação |

**Indexes:** `[pessoaCodigo, criadoEm]`, `[tipo, criadoEm]`, `[agenteCodigo, criadoEm]`

**Tipos de ocorrência:** LIGACAO_EFETUADA, LIGACAO_NAO_ATENDIDA, WHATSAPP_RECEBIDO, WHATSAPP_ENVIADO, NEGOCIACAO_CRIADA, NEGOCIACAO_CONCLUIDA, SERASA_INCLUSAO, DISPARO_INCLUIDO, CONTATO_MANUAL, etc.

---

### Exemplo de query: timeline completa do aluno

```sql
-- Todas as interacoes com um aluno (WhatsApp + ligacoes + ocorrencias)
SELECT 'whatsapp' AS fonte, tipo, corpo AS descricao, timestamp AS data
FROM cobranca.mensagem_whatsapp
WHERE "pessoaCodigo" = :codigo
UNION ALL
SELECT 'ligacao', modo, CONCAT('Ligacao para ', telefone), "dataHoraChamada"
FROM cobranca.registro_ligacao
WHERE "pessoaCodigo" = :codigo
UNION ALL
SELECT 'ocorrencia', tipo, descricao, "criadoEm"
FROM cobranca.ocorrencia
WHERE "pessoaCodigo" = :codigo
ORDER BY data DESC
LIMIT 50;
```

### Exemplo de query: conversas aguardando atendimento com dados financeiros

```sql
SELECT cc.id, cc."contatoNome", cc."contatoNumero",
       cc."valorInadimplente", cc."diasAtraso", cc."serasaAtivo",
       p.nome AS aluno_nome, p.cpf
FROM cobranca.conversa_cobranca cc
LEFT JOIN cobranca.pessoa p ON p.codigo = cc."pessoaCodigo"
WHERE cc.status = 'AGUARDANDO'
  AND cc."instanciaId" = '80e6ea859385137827c362646bf51222'
ORDER BY cc."ultimaMensagemCliente" DESC;
```

---

## Tabelas CRM — Disparo de Mensagens (sprint 2026-04-24)

Grupo novo para cobranca automatica via WhatsApp (Blip). **Todas em `cobranca.*`**.

### `template_blip`
Templates Meta aprovados na Blip com mapeamento estruturado de variaveis.

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | |
| nomeBlip | text UNIQUE | Nome aprovado na Meta (ex: `template_fluxo_antes_venc_rec_inativa1`) |
| titulo | text | Titulo interno amigavel |
| descricao | text? | |
| conteudoPreview | text | Corpo com `{{1}} {{2}}` etc — pra preview |
| variaveis | jsonb | `[{ indice, fonte }]` onde fonte mapeia pra um dos 9 resolvers |
| categoria | text | PRE_VENCIMENTO \| POS_VENCIMENTO \| OUTRO |
| escopo | text | AMBOS \| TITULO — inferido automaticamente pelas variaveis |
| ativo | boolean default true | |

**Indexes:** `(categoria, ativo)`

**Fontes de variaveis** (em `reguaExecutorService.listarFontesDisponiveis`):
- `NOME_ALUNO`, `PRIMEIRO_NOME` — escopo AMBOS
- `VALOR_PARCELA`, `DATA_VENCIMENTO`, `LINK_PAGAMENTO_SEI` — exigem contareceber → forcam escopo TITULO
- `DIAS_ATE_VENCIMENTO`, `DIAS_ATE_VENCIMENTO_FRIENDLY` — TITULO (ex: "em 7 dias", "amanha", "hoje")
- `DIAS_APOS_VENCIMENTO`, `DIAS_APOS_VENCIMENTO_FRIENDLY` — TITULO (ex: "ha 5 dias")

### `regua_cobranca`
Fluxo/regua de cobranca automatica. Aceita apenas segmentacoes tipo TITULO (regras ALUNO ficam pra Disparo Manual).

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | |
| nome | text | |
| ativo | boolean default false | Comeca inativa |
| horarioPadrao | text default '09:00' | HH:MM default das etapas |
| intervaloDisparoSeg | int default 2 | Wait entre disparos (rate limit Blip) |
| ultimaExecucao | timestamp? | |

**Indexes:** `(ativo)`

### `etapa_regua`
Cada "toque" da regua (ex: -7d antes, +2d depois).

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | |
| reguaId | uuid FK → regua_cobranca **CASCADE** | |
| nome | text | Ex: "7 dias antes — rec inativa" |
| diasRelativoVenc | int | Negativo = antes, zero = dia D, positivo = depois |
| horario | text? | HH:MM override do padrao da regua |
| templateBlipId | uuid FK → template_blip **RESTRICT** | Impede delete de template em uso |
| segmentacaoId | uuid? | **Sem FK constraint** — campo aponta para regra_segmentacao |
| ativo | boolean default true | |
| ultimaExecucaoEm | timestamp? | Barreira `jaRodouHoje` no scheduler |

**Indexes:** `(reguaId, ativo)`, `(templateBlipId)`, `(ultimaExecucaoEm)`

### `disparo_mensagem`
Cada envio — auditavel e idempotente.

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | |
| reguaId | uuid? | **Sem FK** (preserva historico se regua deletada) |
| etapaReguaId | uuid? | **Sem FK** — idem |
| templateBlipId | uuid | **Sem FK** — idem |
| templateNomeBlip | text | Snapshot textual do nome |
| pessoaCodigo | int | SEI |
| pessoaNome | text | Snapshot |
| contaReceberCodigo | int? | Titulo alvo (regra TITULO) |
| telefone | text | |
| parametros | jsonb | `{ "1": "R$ 100", "4": "https://sei.../..." }` — resolvido no enqueue |
| status | text default 'PENDENTE' | PENDENTE \| ENVIADO \| FALHOU \| CANCELADO |
| tentativas | int default 0 | Max 3 no worker |
| blipMessageId | text? | Retorno Blip |
| erroMensagem | text? | |
| origem | text default 'REGUA_AUTO' | REGUA_AUTO \| DISPARO_MANUAL |
| criadoEm, disparadoEm, atualizadoEm | timestamp | |
| convertido, convertidoEm, diasAteConversao | | Reconciliacao (fase futura) |

**Indexes:**
- `(status, criadoEm)` — worker drena PENDENTES ordenados
- `(reguaId, disparadoEm)` — historico por regua
- `(pessoaCodigo)` — timeline do aluno
- `(templateBlipId)` — metricas por template

**UNIQUE:** `(etapaReguaId, pessoaCodigo, contaReceberCodigo)` — idempotencia principal. `createMany({ skipDuplicates: true })` respeita.

### `regra_segmentacao` — colunas novas (sprint 2026-04-24)

| Coluna | Tipo | Descricao |
|---|---|---|
| tipo | text default 'ALUNO' | ALUNO \| TITULO — define o que a regra retorna |
| escopoUso | text default 'GLOBAL' | GLOBAL \| EMBUTIDA_REGUA |
| reguaOwnerId | uuid? FK regua_cobranca **CASCADE** | Quando EMBUTIDA_REGUA, aponta pra regua dona |
| totalTitulos | int? | Metrica cacheada para regras TITULO |

**Indexes novos:** `(escopoUso, reguaOwnerId)`

### Cascade delete — mapa completo

```
ReguaCobranca (delete)
  ├─ EtapaRegua                CASCADE
  └─ RegraSegmentacao (embutidas) CASCADE (via reguaOwnerId)

TemplateBlip (delete)
  └─ EtapaRegua                RESTRICT (impede delete em uso)

DisparoMensagem (historico preservado — SEM cascade em nenhuma FK)
  ├─ reguaId / etapaReguaId / templateBlipId sao nullable e sem constraint
  └─ Objetivo: auditoria permanente
```

### Relacoes N:1 sem FK (intencionais)

| De | Para | Por que sem FK |
|---|---|---|
| disparo_mensagem → regua_cobranca | reguaId | Historico preservado quando regua deletada |
| disparo_mensagem → etapa_regua | etapaReguaId | Idem |
| disparo_mensagem → template_blip | templateBlipId | Idem — templateNomeBlip e snapshot |
| disparo_mensagem → pessoa | pessoaCodigo | pessoa e SEI read-only |
| disparo_mensagem → contareceber | contaReceberCodigo | contareceber e SEI read-only; re-validado no worker |
| etapa_regua → regra_segmentacao | segmentacaoId | Flexibilidade — integridade garantida na app |

### Exemplo: metricas por etapa (30d)

```sql
SELECT
  e.id, e.nome, e."diasRelativoVenc",
  COUNT(d.*)::int AS total_30d,
  COUNT(d.*) FILTER (WHERE d.status = 'ENVIADO')::int AS enviados_30d,
  COUNT(d.*) FILTER (WHERE d.status = 'FALHOU')::int AS falhas_30d,
  COUNT(d.*) FILTER (WHERE d.convertido = true)::int AS convertidos_30d
FROM cobranca.etapa_regua e
LEFT JOIN cobranca.disparo_mensagem d
  ON d."etapaReguaId" = e.id AND d."criadoEm" >= NOW() - INTERVAL '30 days'
WHERE e."reguaId" = :reguaId
GROUP BY e.id, e.nome, e."diasRelativoVenc"
ORDER BY e."diasRelativoVenc";
```

### Exemplo: historico de disparos de um aluno

```sql
SELECT d.criadoEm, d.status, d.templateNomeBlip, d.erroMensagem,
       r.nome AS regua_nome, e.nome AS etapa_nome
FROM cobranca.disparo_mensagem d
LEFT JOIN cobranca.regua_cobranca r ON r.id = d."reguaId"
LEFT JOIN cobranca.etapa_regua e ON e.id = d."etapaReguaId"
WHERE d."pessoaCodigo" = :codigo
ORDER BY d."criadoEm" DESC
LIMIT 50;
```
