-- Indexes for /api/acordos/:id/contexto performance.
-- Each index targets one of the queries in acordosController.contexto().

-- Disparos da regua: filtra por (pessoaCodigo, disparadoEm DESC) com janela 14d
CREATE INDEX IF NOT EXISTS idx_disparo_pessoa_disparadoem
  ON cobranca.disparo_mensagem ("pessoaCodigo", "disparadoEm" DESC);

-- Outros acordos do mesmo aluno
CREATE INDEX IF NOT EXISTS idx_acordo_pessoa
  ON cobranca.acordo_financeiro ("pessoaCodigo");

-- Ocorrencias do aluno em janela +/-30d (segundo ramo do UNION)
CREATE INDEX IF NOT EXISTS idx_ocorrencia_pessoa_criadoem
  ON cobranca.ocorrencia ("pessoaCodigo", "criadoEm" DESC);
