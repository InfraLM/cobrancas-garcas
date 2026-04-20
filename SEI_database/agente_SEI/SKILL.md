---
name: sei-database
description: Conhecimento profundo sobre a estrutura e regras de negócio do banco de dados do sistema acadêmico SEI. Use esta skill para consultar informações sobre tabelas, relacionamentos e fluxos de dados, especialmente para o desenvolvimento de sistemas de cobrança, negociação financeira e gestão acadêmica.
license: Complete terms in LICENSE.txt
---

# SEI Database Skill

Esta skill fornece conhecimento especializado sobre o banco de dados relacional do sistema acadêmico SEI. O SEI é um sistema complexo que gerencia a vida acadêmica, financeira e cadastral de alunos, professores e funcionários.

## Visão Geral do Banco de Dados

O banco de dados SEI é estruturado em torno de entidades centrais que se relacionam para formar fluxos de negócio completos. As principais áreas de domínio incluem a gestão de pessoas, matrículas acadêmicas, controle financeiro (contas a receber e negociações) e gestão de documentos.

Para o desenvolvimento de sistemas de cobrança, é fundamental compreender a interação entre as tabelas financeiras e acadêmicas, pois as regras de negócio de cobrança dependem do status acadêmico do aluno e das condições de pagamento do curso.

## Entidades Principais

O sistema é composto por diversas tabelas interligadas. A tabela `pessoa` atua como o núcleo central de cadastro, armazenando informações de todos os atores do sistema (alunos, professores, funcionários, etc.). A partir dela, derivam-se as matrículas (`matricula` e `matriculaperiodo`), que por sua vez geram as obrigações financeiras (`contareceber`).

As obrigações financeiras podem ser renegociadas através da tabela `negociacaocontareceber`, que gera novas condições de pagamento e vincula as contas originais através da tabela `contarecebernegociado`. Os pagamentos efetivados são registrados em `negociacaorecebimento` e detalhados em `contareceberrecebimento`.

## Fluxos de Negócio Críticos

### Fluxo de Cobrança e Inadimplência

O processo de cobrança inicia-se com a geração das parcelas na tabela `contareceber`. Cada registro nesta tabela representa uma obrigação financeira com uma data de vencimento (`datavencimento`), um valor original (`valor`) e um status (`situacao`).

Quando uma parcela não é paga até o vencimento, o sistema aplica regras de juros e multas. A situação financeira do aluno é refletida na tabela `matricula` através do campo `situacaofinanceira`. O sistema de cobrança deve monitorar as contas com situação em aberto (`AB`) e data de vencimento no passado, verificando também se o aluno possui flags de bloqueio de cobrança, como `naoenviarmensagemcobranca`.

### Fluxo de Negociação Financeira

Alunos inadimplentes podem renegociar suas dívidas. Este processo cria um registro na tabela `negociacaocontareceber`, que define as novas condições (número de parcelas, descontos concedidos, juros aplicados). As contas originais que foram renegociadas têm sua situação alterada e são vinculadas à nova negociação através da tabela `contarecebernegociado`.

É importante notar que uma negociação pode envolver múltiplas contas a receber e gerar um novo conjunto de parcelas com datas de vencimento futuras.

### Fluxo de Pagamento Recorrente

Para pagamentos via cartão de crédito, o sistema utiliza a tabela `cartaocreditodebitorecorrenciapessoa`. Esta tabela armazena os dados criptografados do cartão e as regras de recorrência. Os pagamentos processados com sucesso geram registros em `negociacaorecebimento` e atualizam o status das contas a receber correspondentes.

## Referências Detalhadas

Para informações específicas sobre a estrutura de cada tabela, relacionamentos (Foreign Keys), índices e regras de negócio detalhadas, consulte os arquivos de referência incluídos nesta skill:

- Leia `/home/ubuntu/skills/sei-database/references/nomenclaturas_valores.md` para uma referência completa de todos os códigos e valores de enumeração utilizados no sistema (situações, tipos de origem, formas de pagamento, etc.).
- Leia `/home/ubuntu/skills/sei-database/references/tabelas_financeiras.md` para detalhes sobre `contareceber`, `negociacaocontareceber`, `negociacaorecebimento` e tabelas relacionadas.
- Leia `/home/ubuntu/skills/sei-database/references/tabelas_academicas.md` para detalhes sobre `pessoa`, `matricula`, `matriculaperiodo`, `curso` e `turma`.
- Leia `/home/ubuntu/skills/sei-database/references/regras_cobranca.md` para a lógica de cálculo de juros, multas, descontos e identificação de inadimplência.
- Leia `/home/ubuntu/skills/sei-database/references/regras_negocio_avancadas.md` para premissas de modelagem analítica, tratamento de gaps, recorrência de cartão, filtros de turmas específicas e projeções de LTV.

## Diretrizes de Uso

Ao desenvolver consultas SQL ou lógicas de negócio para o sistema de cobrança:

1. Sempre utilize a tabela `pessoa` para obter os dados de contato atualizados do devedor.
2. Verifique o status da matrícula (`situacao` e `situacaofinanceira`) antes de iniciar ações de cobrança agressivas.
3. Considere os diversos tipos de descontos (progressivo, institucional, convênio) que podem ser aplicados a uma `contareceber`.
4. Respeite as flags de bloqueio de comunicação (`naoenviarmensagemcobranca`) presentes no cadastro do aluno.
5. Ao calcular o valor atualizado de uma dívida, some o valor original aos juros e multas calculados, subtraindo os descontos aplicáveis e os valores já recebidos.
