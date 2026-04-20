# Nomenclaturas e Valores do SEI

Este documento detalha todos os códigos e valores de enumeração utilizados no banco de dados SEI, baseado nos dados reais do sistema.

## CONTARECEBER - Coluna `situacao`

A coluna `situacao` na tabela `contareceber` indica o status atual de uma parcela ou fatura a receber.

| Código | Significado | Descrição | Quantidade |
|--------|-------------|-----------|-----------|
| **AR** | A Receber | Título pagável que ainda não foi pago. Pode estar vencido ou não. Significa que a obrigação financeira está aberta e aguardando pagamento. | 23.772 |
| **CF** | Cancelado Financeiro | O título foi cancelado através de um processo de liberação de cancelamento. A data de cancelamento (`datacancelamento`) pode ser usada como proxy para identificar churn. | 8.172 |
| **NE** | Negociado | Conta original que foi incluída em uma negociação. Ela não está mais disponível para pagamento direto. Sua situação muda para `NE` para indicar que foi negociada, e uma ou mais novas contas são geradas na tabela `contareceber` com `tipoorigem = 'NCR'`. | 11.139 |
| **RE** | Recebido | O título foi pago integralmente. O valor em `valorrecebido` deve ser igual ou superior ao `valor` original. | 7.540 |

## CONTARECEBER - Coluna `tipoorigem`

A coluna `tipoorigem` indica a origem ou tipo de cobrança que gerou a parcela.

| Código | Significado | Descrição | Quantidade |
|--------|-------------|-----------|-----------|
| **MAT** | Matrícula | Parcela gerada a partir da matrícula de um aluno em um curso. Geralmente é a primeira parcela ou taxa de matrícula. | 1.566 |
| **MEN** | Mensalidade | Parcela gerada como mensalidade recorrente durante o período letivo. É o tipo mais comum de cobrança. | 39.533 |
| **NCR** | Negociação | Parcela gerada como resultado de uma negociação de dívidas. Estas são as novas contas criadas quando um aluno renegocia suas dívidas originais. | 9.410 |
| **OUT** | Outros | Parcelas geradas por outras razões não classificadas nas categorias anteriores. | 111 |
| **REQ** | Requerimento | Cobrança administrativa por requerimento. Pouco utilizado no sistema. | 3 |

## FORMAPAGAMENTO - Coluna `tipo`

A coluna `tipo` na tabela `formapagamento` indica a forma ou meio de pagamento aceito.

| Código | Significado | Descrição |
|--------|-------------|-----------|
| **BO** | Boleto | Boleto bancário (código de barras). |
| **CA** | Cartão de Crédito | Pagamento via cartão de crédito. |
| **CD** | Cartão de Débito | Pagamento via cartão de débito. |
| **CH** | Cheque | Pagamento via cheque. |
| **DC** | Débito em Conta | Débito direto em conta corrente do pagador. |
| **DE** | Débito Eletrônico | Débito eletrônico (similar a débito em conta, mas processado eletronicamente). |
| **DI** | Dinheiro | Pagamento em dinheiro (geralmente presencial). |
| **IS** | Isenção | Não é uma forma de pagamento, mas uma isenção de cobrança. |

## MATRICULA - Coluna `situacao`

A coluna `situacao` na tabela `matricula` indica o status acadêmico geral da matrícula.

| Código | Significado | Descrição | Quantidade |
|--------|-------------|-----------|-----------|
| **AT** | Ativo | Aluno está regularmente matriculado e cursando. | 1.853 |
| **CA** | Cancelado | Matrícula foi cancelada (aluno desistiu ou foi desligado). | 139 |
| **IN** | Inativo | Matrícula está inativa (pode ser temporária ou permanente). | 2 |
| **TR** | Trancado | Matrícula foi trancada (aluno pausou temporariamente). | 1 |

## MATRICULA - Coluna `situacaofinanceira`

A coluna `situacaofinanceira` na tabela `matricula` indica o status financeiro do aluno em relação às suas obrigações de pagamento.

| Código | Significado | Descrição | Quantidade |
|--------|-------------|-----------|-----------|
| **PF** | Pendente Financeiro | Aluno possui obrigações financeiras pendentes (parcelas não pagas). | 216 |
| **QU** | Quitado | Aluno está em dia com suas obrigações financeiras (todas as parcelas pagas). | 1.779 |

## MATRICULAPERIODO - Coluna `situacao`

A coluna `situacao` na tabela `matriculaperiodo` indica o status da matrícula em um período letivo específico.

| Código | Significado | Descrição | Quantidade |
|--------|-------------|-----------|-----------|
| **AT** | Ativo | Aluno está ativo neste período letivo. | 1.900 |
| **CO** | Concluído | Aluno concluiu este período letivo. | 3 |
| **PF** | Pendente Financeiro | Aluno possui pendências financeiras neste período. | 92 |

## MATRICULAPERIODO - Coluna `situacaomatriculaperiodo`

A coluna `situacaomatriculaperiodo` na tabela `matriculaperiodo` fornece um detalhamento adicional do status da matrícula no período.

| Código | Significado | Descrição | Quantidade |
|--------|-------------|-----------|-----------|
| **AT** | Ativo | Matrícula ativa no período. | 1.853 |
| **CA** | Cancelado | Matrícula foi cancelada neste período. | 139 |
| **ER** | Erro | Status desconhecido ou erro no sistema. Requer investigação. | 2 |
| **TR** | Trancado | Matrícula foi trancada neste período. | 1 |

## NEGOCIACAOCONTARECEBER - Coluna `tiporenegociacao`

A coluna `tiporenegociacao` na tabela `negociacaocontareceber` indica o tipo de acordo negociado.

| Código | Significado | Descrição | Quantidade |
|--------|-------------|-----------|-----------|
| **AV** | Avulso | Negociação realizada de forma avulsa, sem seguir um padrão predefinido. | 156 |
| **VE** | Vencimento Estendido | Negociação onde o vencimento das parcelas foi estendido (prazo maior). | 164 |
| **NULL** | Não Classificado / Legado | Negociações antigas ou não classificadas. Pode indicar dados legados do sistema anterior. | 385 |

## NEGOCIACAORECEBIMENTO - Coluna `tipopessoa`

A coluna `tipopessoa` na tabela `negociacaorecebimento` indica o tipo de pessoa que realizou o recebimento.

| Código | Significado | Descrição | Quantidade |
|--------|-------------|-----------|-----------|
| **AL** | Aluno | Recebimento realizado pelo próprio aluno. | 7.450 |

## CONTARECEBERRECEBIMENTO - Coluna `tiporecebimento`

A coluna `tiporecebimento` na tabela `contareceberrecebimento` indica o tipo de recebimento realizado.

| Código | Significado | Descrição | Quantidade |
|--------|-------------|-----------|-----------|
| **CR** | Cartão de Crédito | Recebimento via cartão de crédito. | 7.545 |
| **DE** | Débito Eletrônico | Recebimento via débito eletrônico. | 5 |

## Notas Importantes

### Sobre o status `NE` (Negociado)

Quando uma conta tem `situacao = 'NE'`, isso significa que ela foi incluída em uma negociação e não deve mais ser cobrada isoladamente. As novas parcelas geradas pela negociação terão `tipoorigem = 'NCR'` e `codorigem` apontando para o `codigo` da negociação na tabela `negociacaocontareceber`.

### Sobre o campo `tiporenegociacao` vazio

Negociações com `tiporenegociacao = NULL` ou vazio são consideradas "não classificadas" ou dados legados. Estas podem ser negociações criadas antes de uma mudança de sistema ou que não foram categorizadas corretamente.

### Sobre o status `CF` (Cancelado Financeiro)

O cancelamento financeiro é diferente de um cancelamento simples. Quando uma conta é cancelada financeiramente, ela passa por um processo de liberação de cancelamento. O campo `datacancelamento` registra quando isso ocorreu e pode ser usado para análises de churn.

### Sobre o status `ER` em `situacaomatriculaperiodo`

O status `ER` aparece em apenas 2 registros e indica um possível erro ou inconsistência nos dados. Recomenda-se investigar estes registros para entender a causa.
