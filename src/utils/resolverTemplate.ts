import type { Aluno } from '../types/aluno';
import type { ConversaCobranca } from '../types/conversa';
import type { User } from '../types/index';

export interface DadosResolucao {
  aluno: Aluno | null;
  conversa: ConversaCobranca | null;
  agente: User | null;
}

export interface ResultadoResolucao {
  texto: string;
  variaveisUsadas: string[];
  variaveisVazias: string[];
  variaveisInvalidas: string[];
}

const REGEX_VARIAVEL = /\{\{(\w+)\}\}/g;

const formatadorBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatarData(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return null;
  }
}

function capitalizar(texto: string): string {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
}

function primeiroNome(nomeCompleto: string | null | undefined): string | null {
  if (!nomeCompleto) return null;
  const primeiro = nomeCompleto.trim().split(/\s+/)[0];
  if (!primeiro) return null;
  return capitalizar(primeiro);
}

function resolverVariavel(nome: string, dados: DadosResolucao): string | null {
  const { aluno, conversa, agente } = dados;
  const fin = aluno?.resumoFinanceiro || aluno?.financeiro;

  switch (nome) {
    case 'nome':
      return aluno?.nome || null;
    case 'primeiroNome':
      return primeiroNome(aluno?.nome);
    case 'cpf':
      return aluno?.cpf || null;
    case 'matricula':
      return aluno?.matricula || null;
    case 'celular':
      return aluno?.celular || null;
    case 'cursoNome':
      return aluno?.cursoNome || null;
    case 'turma':
      return aluno?.turmaIdentificador || null;
    case 'valorDivida': {
      const valor = fin?.valorInadimplente ?? conversa?.valorInadimplente;
      if (valor == null || valor === 0) return null;
      return formatadorBRL.format(Number(valor));
    }
    case 'parcelasAtraso': {
      const qtd = fin?.parcelasEmAtraso;
      if (qtd == null) return null;
      return String(qtd);
    }
    case 'diasAtraso': {
      const dias = conversa?.diasAtraso;
      if (dias == null) return null;
      return String(dias);
    }
    case 'vencimentoAntigo':
      return formatarData(fin?.vencimentoMaisAntigo);
    case 'meuNome':
      return agente?.nome || null;
    case 'primeiroNomeAgente':
      return primeiroNome(agente?.nome);
    default:
      return null;
  }
}

const VARIAVEIS_CONHECIDAS = new Set([
  'nome',
  'primeiroNome',
  'cpf',
  'matricula',
  'celular',
  'cursoNome',
  'turma',
  'valorDivida',
  'parcelasAtraso',
  'diasAtraso',
  'vencimentoAntigo',
  'meuNome',
  'primeiroNomeAgente',
]);

export function resolverTemplate(conteudo: string, dados: DadosResolucao): ResultadoResolucao {
  const variaveisUsadas: string[] = [];
  const variaveisVazias: string[] = [];
  const variaveisInvalidas: string[] = [];

  const texto = conteudo.replace(REGEX_VARIAVEL, (match, nome) => {
    if (!VARIAVEIS_CONHECIDAS.has(nome)) {
      if (!variaveisInvalidas.includes(nome)) variaveisInvalidas.push(nome);
      return match; // mantém literal para o autor corrigir
    }

    if (!variaveisUsadas.includes(nome)) variaveisUsadas.push(nome);

    const valor = resolverVariavel(nome, dados);
    if (valor == null || valor === '') {
      if (!variaveisVazias.includes(nome)) variaveisVazias.push(nome);
      return match; // mantém literal; o modal bloqueia com base na lista
    }
    return valor;
  });

  return { texto, variaveisUsadas, variaveisVazias, variaveisInvalidas };
}

export function extrairVariaveisDoTexto(conteudo: string): string[] {
  const encontradas: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(REGEX_VARIAVEL.source, 'g');
  while ((match = regex.exec(conteudo)) !== null) {
    if (!encontradas.includes(match[1])) encontradas.push(match[1]);
  }
  return encontradas;
}
