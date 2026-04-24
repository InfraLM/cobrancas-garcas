-- ============================================================
-- Busca por nome com ranking (pg_trgm + unaccent)
--
-- Instala extensoes, cria funcao de normalizacao imutavel e
-- adiciona indexes GIN trigram expression em todas as tabelas
-- onde ha busca por nome na UI.
--
-- Sem alteracao de schema Prisma (nenhuma coluna nova).
-- Migration idempotente (IF NOT EXISTS em tudo).
--
-- IMPORTANTE: search_path do banco aponta para 'cobranca', entao
-- CREATE EXTENSION cria as funcoes no schema cobranca (nao public).
-- A funcao usa 'cobranca.unaccent' explicitamente.
-- ============================================================

-- 1. Extensoes (trusted desde PG13, Cloud SQL permite).
--    Criadas no schema cobranca por causa do search_path.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Funcao imutavel de normalizacao.
--    unaccent() nao e imutavel por default (depende de dicionario),
--    mas dentro deste wrapper IMMUTABLE, o Postgres aceita usar
--    em indexes expression. Isso e padrao documentado.
CREATE OR REPLACE FUNCTION cobranca.normalizar_busca(texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(cobranca.unaccent(coalesce(texto, '')))
$$;

-- 3. Indexes GIN trigram expression (um por tabela com busca por nome)

CREATE INDEX IF NOT EXISTS idx_aluno_resumo_nome_trgm
  ON cobranca.aluno_resumo USING gin (cobranca.normalizar_busca(nome) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pessoa_nome_trgm
  ON cobranca.pessoa USING gin (cobranca.normalizar_busca(nome) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_acordo_pessoa_nome_trgm
  ON cobranca.acordo_financeiro USING gin (cobranca.normalizar_busca("pessoaNome") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_ocorrencia_pessoa_nome_trgm
  ON cobranca.ocorrencia USING gin (cobranca.normalizar_busca("pessoaNome") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cadastro_recorrencia_nome_trgm
  ON cobranca.cadastro_recorrencia USING gin (cobranca.normalizar_busca("pessoaNome") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_ficou_facil_nome_trgm
  ON cobranca.ficou_facil USING gin (cobranca.normalizar_busca("pessoaNome") gin_trgm_ops);
