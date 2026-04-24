/**
 * reguaExecutorService — helpers de resolucao de variaveis para templates Blip.
 *
 * As fontes de variaveis sao declaradas em TemplateBlip.variaveis como:
 *   [{ indice: 1, fonte: 'VALOR_PARCELA' }, { indice: 2, fonte: 'DATA_VENCIMENTO' }, ...]
 *
 * Aqui a gente transforma essas declaracoes em array de strings na ordem correta,
 * dado um "contexto" (aluno + parcela).
 */

const LINK_BASE_SEI = 'https://sei.liberdademedicaedu.com.br/pagamento.xhtml?token=';

function formatarMoeda(valor) {
  if (valor == null) return 'R$ 0,00';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(data) {
  if (!data) return '';
  return new Date(data).toLocaleDateString('pt-BR');
}

function primeiroNome(nomeCompleto) {
  if (!nomeCompleto) return '';
  const parts = String(nomeCompleto).trim().split(/\s+/);
  return parts[0] || '';
}

function diffDias(hoje, alvo) {
  // Retorna diferenca em DIAS INTEIROS (alvo - hoje).
  // Positivo = alvo no futuro (antes do vencimento ainda).
  const MS = 24 * 60 * 60 * 1000;
  const h = new Date(hoje);
  h.setHours(0, 0, 0, 0);
  const a = new Date(alvo);
  a.setHours(0, 0, 0, 0);
  return Math.round((a - h) / MS);
}

function diasAteFriendly(dias) {
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias === -1) return 'ontem';
  if (dias > 0) return `em ${dias} dias`;
  return `há ${Math.abs(dias)} dias`;
}

function diasAposFriendly(dias) {
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'há 1 dia';
  return `há ${dias} dias`;
}

/**
 * Fontes disponiveis + resolvers.
 * Cada fonte recebe um "contexto" { pessoa, conta, hoje } e retorna string formatada.
 */
const FONTES = {
  NOME_ALUNO: (ctx) => String(ctx.pessoa?.nome || '').trim(),
  PRIMEIRO_NOME: (ctx) => primeiroNome(ctx.pessoa?.nome),
  VALOR_PARCELA: (ctx) => formatarMoeda(ctx.conta?.valor),
  DATA_VENCIMENTO: (ctx) => formatarData(ctx.conta?.datavencimento),
  DIAS_ATE_VENCIMENTO: (ctx) => {
    const d = diffDias(ctx.hoje || new Date(), ctx.conta?.datavencimento);
    return String(d);
  },
  DIAS_ATE_VENCIMENTO_FRIENDLY: (ctx) => {
    const d = diffDias(ctx.hoje || new Date(), ctx.conta?.datavencimento);
    return diasAteFriendly(d);
  },
  DIAS_APOS_VENCIMENTO: (ctx) => {
    const d = -diffDias(ctx.hoje || new Date(), ctx.conta?.datavencimento);
    return String(Math.max(0, d));
  },
  DIAS_APOS_VENCIMENTO_FRIENDLY: (ctx) => {
    const d = -diffDias(ctx.hoje || new Date(), ctx.conta?.datavencimento);
    return diasAposFriendly(Math.max(0, d));
  },
  LINK_PAGAMENTO_SEI: (ctx) => {
    const token = ctx.conta?.token;
    return token ? `${LINK_BASE_SEI}${token}` : '';
  },
};

/**
 * Retorna lista de fontes disponiveis (para UI de cadastro de template).
 */
export function listarFontesDisponiveis() {
  return [
    { fonte: 'NOME_ALUNO', descricao: 'Nome completo do aluno', exemplo: 'ANDRÉ GARCIA RIBEIRO' },
    { fonte: 'PRIMEIRO_NOME', descricao: 'Primeiro nome', exemplo: 'André' },
    { fonte: 'VALOR_PARCELA', descricao: 'Valor da parcela', exemplo: 'R$ 1.234,56' },
    { fonte: 'DATA_VENCIMENTO', descricao: 'Data de vencimento', exemplo: '25/04/2026' },
    { fonte: 'DIAS_ATE_VENCIMENTO', descricao: 'Dias até o vencimento (número)', exemplo: '7' },
    { fonte: 'DIAS_ATE_VENCIMENTO_FRIENDLY', descricao: 'Dias até o vencimento (amigável)', exemplo: 'em 7 dias / amanhã / hoje' },
    { fonte: 'DIAS_APOS_VENCIMENTO', descricao: 'Dias após vencimento (número)', exemplo: '5' },
    { fonte: 'DIAS_APOS_VENCIMENTO_FRIENDLY', descricao: 'Dias após vencimento (amigável)', exemplo: 'há 5 dias' },
    { fonte: 'LINK_PAGAMENTO_SEI', descricao: 'Link de pagamento SEI', exemplo: LINK_BASE_SEI + '...' },
  ];
}

/**
 * Resolve as variaveis de um template dado o contexto.
 *
 * @param {Array<{indice:number, fonte:string}>} variaveisMap - config do TemplateBlip.variaveis
 * @param {Object} contexto - { pessoa, conta, hoje }
 * @returns {{ parametrosOrdenados: Array<string>, parametrosPorIndice: Object }}
 *    parametrosOrdenados: array na ordem dos indices (1, 2, 3...)
 *    parametrosPorIndice: { "1": "...", "2": "..." } (para guardar em DisparoMensagem.parametros)
 */
export function resolverVariaveis(variaveisMap, contexto) {
  const arr = Array.isArray(variaveisMap) ? variaveisMap : [];
  // Ordena por indice ascendente
  const ordenadas = [...arr].sort((a, b) => (a.indice || 0) - (b.indice || 0));
  const parametrosOrdenados = [];
  const parametrosPorIndice = {};
  for (const v of ordenadas) {
    const resolver = FONTES[v.fonte];
    const valor = resolver ? resolver(contexto) : '';
    parametrosOrdenados.push(valor);
    parametrosPorIndice[String(v.indice)] = valor;
  }
  return { parametrosOrdenados, parametrosPorIndice };
}

/**
 * Detecta indices de variaveis no conteudo do template (ex: "texto com {{1}} e {{4}}" -> [1, 4]).
 */
export function detectarIndicesNoConteudo(conteudo) {
  if (!conteudo) return [];
  const matches = String(conteudo).matchAll(/\{\{\s*(\d+)\s*\}\}/g);
  const indices = new Set();
  for (const m of matches) {
    indices.add(Number(m[1]));
  }
  return [...indices].sort((a, b) => a - b);
}

/**
 * Gera um preview do conteudo substituindo {{n}} pelos valores de exemplo.
 */
export function previewConteudo(conteudo, variaveisMap) {
  if (!conteudo) return '';
  const fontes = listarFontesDisponiveis();
  const byFonte = Object.fromEntries(fontes.map(f => [f.fonte, f.exemplo]));
  const porIndice = {};
  for (const v of (variaveisMap || [])) {
    porIndice[v.indice] = byFonte[v.fonte] ?? `[${v.fonte}]`;
  }
  return String(conteudo).replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => porIndice[n] || `{{${n}}}`);
}
