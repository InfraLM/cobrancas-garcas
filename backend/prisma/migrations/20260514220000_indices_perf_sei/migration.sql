-- Indices de performance em tabelas SEI espelho.
-- F-07 da auditoria 14/05/2026: tabelas SEI nao tinham indices secundarios,
-- forcando seq scan em queries do dashboard, segmentacao, regua, etc.
--
-- Aplicacao via script (CREATE INDEX CONCURRENTLY nao pode rodar em transacao
-- e prisma migrate engloba tudo em uma). Ver backend/scripts/aplicarIndicesPerf.js.
--
-- Indices criados com CONCURRENTLY: nao travam a tabela em produc?ao.
-- IF NOT EXISTS: idempotente, pode rodar 2x sem erro.

-- contareceber (~50k registros — coracao do sistema)
CREATE INDEX CONCURRENTLY IF NOT EXISTS contareceber_situacao_datavencimento_idx
  ON cobranca.contareceber (situacao, datavencimento);
CREATE INDEX CONCURRENTLY IF NOT EXISTS contareceber_pessoa_idx
  ON cobranca.contareceber (pessoa);
CREATE INDEX CONCURRENTLY IF NOT EXISTS contareceber_matriculaaluno_idx
  ON cobranca.contareceber (matriculaaluno);
CREATE INDEX CONCURRENTLY IF NOT EXISTS contareceber_tipoorigem_idx
  ON cobranca.contareceber (tipoorigem);
CREATE INDEX CONCURRENTLY IF NOT EXISTS contareceber_turma_idx
  ON cobranca.contareceber (turma);

-- pessoa (~2k registros — JOIN frequente)
CREATE INDEX CONCURRENTLY IF NOT EXISTS pessoa_aluno_idx
  ON cobranca.pessoa (aluno);
CREATE INDEX CONCURRENTLY IF NOT EXISTS pessoa_funcionario_idx
  ON cobranca.pessoa (funcionario);

-- matricula (~2k registros)
CREATE INDEX CONCURRENTLY IF NOT EXISTS matricula_aluno_idx
  ON cobranca.matricula (aluno);
CREATE INDEX CONCURRENTLY IF NOT EXISTS matricula_curso_idx
  ON cobranca.matricula (curso);

-- negociacaocontareceber (~700 registros mas crescendo)
CREATE INDEX CONCURRENTLY IF NOT EXISTS negociacaocontareceber_matriculaaluno_idx
  ON cobranca.negociacaocontareceber (matriculaaluno);
CREATE INDEX CONCURRENTLY IF NOT EXISTS negociacaocontareceber_data_idx
  ON cobranca.negociacaocontareceber ("data");

-- contarecebernegociado (~11k registros)
CREATE INDEX CONCURRENTLY IF NOT EXISTS contarecebernegociado_negociacaocontareceber_idx
  ON cobranca.contarecebernegociado (negociacaocontareceber);
CREATE INDEX CONCURRENTLY IF NOT EXISTS contarecebernegociado_contareceber_idx
  ON cobranca.contarecebernegociado (contareceber);

-- cartaocreditodebitorecorrenciapessoa (~321 registros — usado em dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS cartaorec_pessoa_idx
  ON cobranca.cartaocreditodebitorecorrenciapessoa (pessoa);
