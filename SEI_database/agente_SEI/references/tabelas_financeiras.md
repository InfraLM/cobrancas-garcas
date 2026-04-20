# Tabelas Financeiras do SEI

Este documento detalha as tabelas relacionadas à gestão financeira, cobrança e recebimentos no banco de dados SEI.

## CONTARECEBER
Representa uma parcela ou fatura a receber. É a tabela central para o sistema de cobrança.

**Campos Críticos:**
- `codigo` (PK): Identificador único.
- `pessoa` (FK): Quem deve pagar (referência à tabela `pessoa`).
- `matriculaaluno` (FK): Matrícula do aluno associada à cobrança.
- `valor` (numeric): Valor original da parcela.
- `valorrecebido` (numeric): Valor já recebido.
- `datavencimento` (timestamp): Data de vencimento da parcela.
- `situacao` (varchar): Status da conta (AB=Aberto, PA=Pago, CAN=Cancelado, NEG=Negociado).
- `tipoorigem` (varchar): Origem da conta (MAT=Matrícula, MEN=Mensalidade, etc.).
- `multa` e `juro` (numeric): Valores de multa e juros calculados por atraso.
- `valordesconto` (numeric): Desconto concedido.
- `descontoprogressivo` (FK): Referência ao plano de desconto progressivo aplicado.

**Índices Importantes:**
- `ch_contareceber_datavencimento`: Otimiza buscas por data de vencimento.
- `ch_contareceber_pessoa`: Otimiza buscas por devedor.
- `idx_contareceber_sit_datavenc_tporigem_unidade`: Otimiza filtros complexos de cobrança.

## NEGOCIACAOCONTARECEBER
Registra uma negociação ou renegociação de dívidas.

**Campos Críticos:**
- `codigo` (PK): Identificador único.
- `valortotal` (numeric): Valor total negociado.
- `desconto` (numeric): Desconto concedido na negociação.
- `nrparcela` (int): Número de parcelas acordadas.
- `intervaloparcela` (int): Intervalo entre as parcelas.
- `pessoa` (FK): Pessoa que realizou a negociação.
- `data` (timestamp): Data da negociação.
- `justificativa` (text): Justificativa para a negociação.

## CONTARECEBERNEGOCIADO
Tabela de ligação (N:N) que vincula as contas a receber originais à nova negociação.

**Campos Críticos:**
- `codigo` (PK): Identificador único.
- `contareceber` (FK): Referência à conta original.
- `negociacaocontareceber` (FK): Referência à negociação.
- `valor` (numeric): Valor da conta que foi negociado.
- `valororiginalconta` (numeric): Valor original antes da negociação.

## NEGOCIACAORECEBIMENTO
Registra o recebimento efetivo de valores (pagamentos).

**Campos Críticos:**
- `codigo` (PK): Identificador único.
- `pessoa` (FK): Pessoa que realizou o pagamento.
- `valortotalrecebimento` (numeric): Valor total recebido.
- `data` (timestamptz): Data e hora do recebimento.
- `recebimentoboletoautomatico` (bool): Flag indicando se foi via boleto automático.
- `empresafinanceira` (varchar): Empresa financeira responsável pelo processamento.

## CONTARECEBERRECEBIMENTO
Detalha quais contas a receber foram quitadas em um determinado recebimento.

**Campos Críticos:**
- `codigo` (PK): Identificador único.
- `contareceber` (FK): Conta a receber que foi paga.
- `formapagamento` (FK): Forma de pagamento utilizada.
- `valorrecebimento` (numeric): Valor recebido para esta conta específica.
- `negociacaorecebimento` (FK): Referência ao recebimento geral.
- `datarecebimento` (timestamp): Data do recebimento.

## FORMAPAGAMENTO e FORMAPAGAMENTONEGOCIACAORECEBIMENTO
Definem e registram as formas de pagamento utilizadas (Boleto, Cartão de Crédito, PIX, etc.).

**Campos Críticos em FORMAPAGAMENTONEGOCIACAORECEBIMENTO:**
- `formapagamento` (FK): Tipo de pagamento.
- `valorrecebimento` (numeric): Valor pago nesta forma.
- `qtdeparcelascartaocredito` (int): Número de parcelas (se cartão).
- `operadoracartao` (FK): Operadora do cartão.

## CARTAOCREDITODEBITORECORRENCIAPESSOA
Armazena dados de cartões para cobranças recorrentes.

**Campos Críticos:**
- `codigo` (PK): Identificador único.
- `pessoa` (FK): Titular do cartão.
- `numerocartao` (text): Número criptografado.
- `numerocartaomascarado` (varchar): Número mascarado para exibição.
- `mesvalidade` e `anovalidade` (int): Validade do cartão.
- `situacao` (varchar): Status do cartão (Ativo/Inativo).
