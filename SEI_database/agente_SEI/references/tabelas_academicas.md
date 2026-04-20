# Tabelas Acadêmicas do SEI

Este documento detalha as tabelas relacionadas à gestão acadêmica e de pessoas no banco de dados SEI.

## PESSOA
Tabela central de cadastro. Armazena informações de todos os atores do sistema.

**Campos Críticos:**
- `codigo` (PK): Identificador único.
- `cpf` (varchar): CPF único (constraint UNIQUE).
- `nome` (varchar): Nome completo.
- `email`, `celular` (varchar): Dados de contato.
- `endereco`, `cep`, `cidade` (FK): Dados de endereço.
- `ativo` (bool): Status ativo/inativo.
- `aluno`, `professor`, `funcionario`, `candidato` (bool): Flags que indicam os papéis da pessoa no sistema.
- `idcrmeducacional` (varchar): Integração com CRM.

## MATRICULA
Registra a matrícula de um aluno em um curso.

**Campos Críticos:**
- `matricula` (PK): Identificador único (varchar 20).
- `aluno` (FK): Referência à tabela `pessoa`.
- `curso` (FK): Curso matriculado.
- `unidadeensino` (FK): Unidade de ensino.
- `situacao` (varchar): Status acadêmico (AT=Ativo, TR=Trancado, etc.).
- `situacaofinanceira` (varchar): Status financeiro (EM=Em dia, AD=Inadimplente, etc.).
- `data` (timestamp): Data da matrícula.
- `anoingresso`, `semestreingresso` (varchar): Período de ingresso.
- `naoenviarmensagemcobranca` (bool): Flag importante para o sistema de cobrança.
- `liberarbloqueioalunoinadimplente` (bool): Desbloqueio de aluno inadimplente.

## MATRICULAPERIODO
Registra a matrícula de um aluno em um período letivo específico.

**Campos Críticos:**
- `codigo` (PK): Identificador único.
- `matricula` (FK): Referência à tabela `matricula`.
- `periodoletivomatricula` (FK): Período letivo.
- `ano`, `semestre` (varchar): Ano e semestre.
- `situacao` (varchar): Status (AT=Ativo, TR=Trancado, etc.).
- `contareceber` (FK): Conta a receber associada.
- `planofinanceirocurso` (FK): Plano financeiro.
- `condicaopagamentoplanofinanceirocurso` (FK): Condição de pagamento.

## CURSO
Define os cursos oferecidos pela instituição.

**Campos Críticos:**
- `codigo` (PK): Identificador único.
- `nome` (text): Nome do curso.
- `niveleducacional` (varchar): Nível (GR=Graduação, PG=Pós-graduação, etc.).
- `modalidadecurso` (varchar): Modalidade (PRESENCIAL, EAD, etc.).

## TURMA
Define as turmas de um curso.

**Campos Críticos:**
- `codigo` (PK): Identificador único.
- `identificadorturma` (varchar): Identificador (UNIQUE).
- `curso` (FK): Curso.
- `periodoletivo` (FK): Período letivo.
- `situacao` (varchar): Status.
