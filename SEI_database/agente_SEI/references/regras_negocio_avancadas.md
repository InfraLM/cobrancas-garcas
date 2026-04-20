# Regras de Negócio Avançadas e Modelagem Analítica

Este documento consolida o conhecimento avançado sobre as regras de negócio, premissas de modelagem e estratégias de análise financeira aplicadas no banco de dados SEI, especialmente para o curso principal "PÓS GRADUAÇÃO EM PACIENTE GRAVE".

## 1. Trancamento e GAP Financeiro

O trancamento de matrícula pode ser identificado de duas formas no sistema:

### Trancamento Formal
Ocorre quando há um registro explícito de negociação com a justificativa contendo a palavra "TRANCAMENTO". Este é o caminho oficial onde o aluno formaliza a pausa no curso.

### Trancamento Inferido (GAP)
Como proxy operacional, a modelagem analítica infere um trancamento quando há um intervalo anormalmente grande (5 meses ou mais) entre vencimentos consecutivos de parcelas regulares. 
- **Filtro de Origem:** Para esta análise, excluem-se parcelas de matrícula (`MAT`) e outros (`OUT`), focando apenas na trilha regular de obrigações financeiras (mensalidades e negociações).
- **Premissa:** A query não "sabe" o motivo acadêmico, mas identifica uma quebra incompatível com a sequência financeira usual, tratando-a como evento de trancamento para fins analíticos.

## 2. Recorrência de Cartão de Crédito

A análise de recorrência de cartão de crédito (`cartaocreditodebitorecorrenciapessoa`) exige cuidado com o viés temporal:

- **Ativação Temporal:** Uma recorrência só é considerada "Ativa" para uma determinada parcela se o cartão foi cadastrado **antes** do evento financeiro (data de recebimento ou vencimento). Se um cartão foi cadastrado depois de um pagamento antigo, esse pagamento é tratado como "Inativo" para recorrência.
- **Classificação Operacional:** Para análise de carteira futura, se a recorrência está ativa, a parcela é classificada como "RECORRÊNCIA", mesmo que o método base projetado seja PIX ou boleto. A regra relevante é o fato de o aluno estar sob um mecanismo ativo de cobrança recorrente, não apenas o último meio pontual de liquidação.

## 3. Cancelamento Financeiro

Para análises de cohort e histórico, utiliza-se a **primeira data de cancelamento** (`MIN(datacancelamento)`) como o marco inicial em que o vínculo entrou em processo de cancelamento.
- **Saneamento de Dados:** Existe um ruído conhecido no sistema onde a data `2025-02-04` foi marcada indevidamente para alunos ativos (`situacao_aluno = 'AT'`). Esta data específica deve ser ignorada (zerada) nas queries analíticas.

## 4. Inferência de Método de Pagamento

Quando uma parcela não possui um método de pagamento explícito, o sistema infere o método mais plausível baseado no comportamento do aluno:
- **Fallback Anterior (`ult_pag`):** Busca o último método pago anterior ou na data da parcela.
- **Fallback Posterior (`prox_pag`):** Busca o próximo método pago. Isso resolve o problema de alunos que não pagaram a primeira parcela, mas estabeleceram um padrão financeiro nas parcelas seguintes.
- **Exceção:** O método "ABONO MULTA BIBLIOTECA" é ignorado nesta inferência, pois representa um lançamento administrativo/compensação, não um meio de pagamento real que deva ser projetado.

## 5. Hierarquia de Data Base de Parcelas

Para determinar quando o financeiro começou a gerar parcelas para um vínculo, utiliza-se uma hierarquia de confiança:
1. `mp.databasegeracaoparcelas`: A referência mais precisa e aderente ao conceito.
2. `MIN(datavencimento)`: Menor vencimento de contas não `MAT` e não `OUT` (aproximação empírica).
3. `data_matricula + 31 dias`: Fallback operacional baseado na suposição de um primeiro ciclo financeiro mensal após a matrícula, evitando nulos em massa.

## 6. Filtros de Turmas (Pós Graduação em Paciente Grave)

Para o curso principal (código 1), nem todas as turmas devem ser analisadas financeiramente. O filtro padrão inclui apenas turmas regulares e exclui turmas de teste, financiamento ou sem lançamento de mensalidades.

**Turmas Válidas para Análise (Filtro `IN (2,4,8,11,21,28)`):**
- TURMA 3 (código 2)
- TURMA 3 -V2 (código 4)
- TURMA 4 (código 8)
- TURMA 4-V2 (com desconto pontualidade) (código 11)
- TURMA 5 A - COM DESCONTO DE PONTUALIDADE (código 21)
- TURMA 5 B - COM DESCONTO DE PONTUALIDADE (código 28)

**Turmas Excluídas (Não Analisar):**
- TURMA 1 E 2 (código 1): Alunos não pagam pelo sistema.
- TURMA TESTE (código 10), RELM (código 7), etc.: Turmas de teste.
- Turmas de FINANCIAMENTO (códigos 19, 22, 29): Não possuem mensalidades lançadas, apenas matrícula.

## 7. Desconto de Pontualidade e Projeções (LTV)

O campo `valordescontocalculadoprimeirafaixadescontos` representa o valor do título após a aplicação da primeira faixa de desconto (geralmente desconto de pontualidade).
- **Lógica de Venda:** A venda é ancorada no valor com desconto (ex: parcela nominal de 2.000, mas 1.800 se pago em dia).
- **Projeções:** Para cálculos de LTV (Life Time Value) ou projeções de receita, deve-se utilizar este campo (`primeirafaixadedesconto`), pois a expectativa base é que o aluno pague em dia e utilize o valor ancorado na venda.

## 8. Identificação Bancária

O campo `nossonumero` na tabela `contareceber` é o identificador bancário do título/boleto, utilizado para cobrança e conciliação com a instituição financeira.
