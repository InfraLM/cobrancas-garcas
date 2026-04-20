# Regras de Cobrança do SEI

Este documento detalha as regras de negócio, cálculos e lógicas aplicadas no sistema de cobrança do banco de dados SEI.

## Identificação de Inadimplência

A inadimplência é identificada através da combinação de fatores nas tabelas `contareceber` e `matricula`.

**Critérios para considerar uma conta em atraso:**
1. A `situacao` na tabela `contareceber` deve ser `AR` (A Receber).
2. A `datavencimento` deve ser anterior à data atual.
3. O `valorrecebido` deve ser menor que o `valor` original.



## Cálculo de Valores Atualizados

O valor atualizado de uma dívida é calculado aplicando juros, multas e descontos sobre o valor original.

**Fórmula Básica:**
`Valor Atualizado = Valor Original + Multa + Juros - Descontos - Valor Recebido`

**Campos Envolvidos (`contareceber`):**
- `valor`: Valor original da parcela.
- `multa`: Valor da multa calculada por atraso.
- `juro`: Valor dos juros calculados por atraso.
- `valordesconto`: Desconto concedido (pode ser a soma de vários tipos de desconto).
- `valorrecebido`: Valor já pago (em caso de pagamentos parciais).

## Tipos de Desconto

O sistema SEI suporta múltiplos tipos de desconto que podem ser aplicados a uma conta a receber.

**Descontos Comuns:**
- `descontoinstituicao`: Desconto concedido pela instituição.
- `descontoconvenio`: Desconto por convênio com empresas/parceiros.
- `valordesconto`: Desconto concedido (pode ser a soma de vários tipos de desconto).
- `descontoprogressivo`: Desconto progressivo (geralmente baseado na pontualidade do pagamento).

**Planos de Desconto (`planodesconto`):**
- Podem ser do tipo Valor Absoluto (`VA`) ou Percentual (`PE`).
- Podem ter validade vinculada à data de vencimento (`descontovalidoatedatavencimento`).
- A ordem de aplicação é definida pelo campo `ordemprioridadeparacalculo`.

## Negociação de Dívidas

Quando um aluno renegocia suas dívidas, o sistema cria um novo acordo financeiro.

**Processo de Negociação:**
1. As contas originais (`contareceber`) têm sua situação alterada para `NE` (Negociado).
2. Um registro é criado em `negociacaocontareceber` com o valor total, descontos e acréscimos da negociação.
3. A tabela `contarecebernegociado` vincula as contas originais à nova negociação.
4. Novas parcelas (`contareceber`) são geradas com base nas condições da negociação (número de parcelas, intervalo, etc.), com `tipoorigem = 'NCR'` e `codorigem` apontando para o código da negociação.

**Acréscimos na Negociação:**
- Podem ser aplicados acréscimos gerais (`acrescimogeral`) ou por parcela (`acrescimoporparcela`).
- O sistema permite isenção total ou parcial de juros e multas originais (`valorisencaototaljuro`, `valorisencaototalmulta`).

Consulte o arquivo `nomenclaturas_valores.md` para uma referência completa de todos os códigos utilizados no sistema.
