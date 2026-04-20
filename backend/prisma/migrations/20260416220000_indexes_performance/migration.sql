-- Indexes para performance da listagem de alunos
CREATE INDEX IF NOT EXISTS idx_matricula_aluno_curso ON cobranca.matricula(aluno, curso, data DESC);
CREATE INDEX IF NOT EXISTS idx_contareceber_pessoa_sit ON cobranca.contareceber(pessoa, situacao, datavencimento);
CREATE INDEX IF NOT EXISTS idx_contareceber_turma ON cobranca.contareceber(turma);
CREATE INDEX IF NOT EXISTS idx_contareceber_matriculaaluno ON cobranca.contareceber(matriculaaluno);
CREATE INDEX IF NOT EXISTS idx_pessoa_aluno_nome ON cobranca.pessoa(nome) WHERE aluno = true;
CREATE INDEX IF NOT EXISTS idx_pessoa_cpf_digits ON cobranca.pessoa(codigo) WHERE aluno = true;
