/**
 * Helper de busca por nome com ranking de relevancia.
 *
 * Centraliza a logica usada por todos os endpoints que filtram por nome de pessoa:
 *  - alunos, acordos, ocorrencias, recorrencias, ficou-facil, titulos
 *
 * Baseia-se em:
 *  - pg_trgm (similarity via operador %) com GIN index
 *  - unaccent (remove acentos)
 *  - Funcao cobranca.normalizar_busca(text) definida na migration
 *
 * Ranking:
 *   0. coluna_normalizada COMECA COM termo_normalizado
 *   1. coluna_normalizada tem PALAVRA INTEIRA que comeca com termo
 *   2. caso contrario (match por contains ou similarity)
 *   -> dentro de cada faixa, ordena por similarity() DESC, depois alfabetico
 */

/**
 * Normaliza um texto para busca (lower + remove acentos).
 * Espelha cobranca.normalizar_busca(text) do Postgres.
 */
export function normalizarBusca(texto) {
  if (!texto) return '';
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Quebra um termo em palavras, remove vazias e normaliza cada uma.
 * Ignora tokens com menos de 2 caracteres (reduz ruido).
 */
export function tokenizar(termo) {
  const normalized = normalizarBusca(termo);
  return normalized.split(/\s+/).filter(w => w.length >= 2);
}

/**
 * Extrai digitos de um termo (para busca por CPF ou matricula numerica).
 */
function extrairDigitos(termo) {
  return String(termo || '').replace(/\D/g, '');
}

/**
 * Detecta se o termo parece ser CPF ou matricula numerica (4+ digitos consecutivos).
 */
function pareceNumerico(termo) {
  const digitos = extrairDigitos(termo);
  return digitos.length >= 4;
}

/**
 * Monta clausula WHERE + params para busca de nome com ranking.
 *
 * @param {Object} opts
 * @param {string} opts.colunaNome   - expressao SQL da coluna de nome (ex: 'p.nome' ou '"pessoaNome"')
 * @param {string} opts.termo         - termo de busca bruto (string do usuario)
 * @param {Object} [opts.extras]     - campos adicionais para busca alternativa
 * @param {string} [opts.extras.colunaCpf]       - ex: 'p.cpf' ou '"pessoaCpf"' (usa REGEXP_REPLACE)
 * @param {string} [opts.extras.colunaMatricula] - ex: 'm.matricula' (ILIKE substring)
 * @param {number} [opts.paramStartIndex=1] - de onde comecar os $1, $2...
 *
 * @returns {{ whereClause: string, params: any[], nextIndex: number, termoNormalizado: string }}
 *   whereClause — string para concatenar no WHERE (sem 'AND' inicial)
 *   params      — array de parametros na ordem
 *   nextIndex   — proximo indice de parametro disponivel (para encadear)
 *   termoNormalizado — termo normalizado (para usar em ORDER BY depois)
 */
export function buildWhereNome({ colunaNome, termo, extras = {}, paramStartIndex = 1 }) {
  const termoTrim = String(termo || '').trim();
  if (!termoTrim) {
    return { whereClause: '', params: [], nextIndex: paramStartIndex, termoNormalizado: '' };
  }

  const termoNorm = normalizarBusca(termoTrim);
  const tokens = tokenizar(termoTrim);
  const params = [];
  let idx = paramStartIndex;
  const branches = [];

  // --- Branch 1: match por nome ---
  if (tokens.length > 0) {
    const nomeNormExpr = `cobranca.normalizar_busca(${colunaNome})`;
    const tokenClauses = tokens.map(tok => {
      params.push(`%${tok}%`);
      return `${nomeNormExpr} LIKE $${idx++}`;
    });
    // AND entre tokens — cada palavra do termo precisa aparecer no nome
    branches.push(`(${tokenClauses.join(' AND ')})`);
  }

  // --- Branch 2: match por CPF (se termo contem digitos) ---
  if (extras.colunaCpf && pareceNumerico(termoTrim)) {
    const digitos = extrairDigitos(termoTrim);
    params.push(`%${digitos}%`);
    branches.push(`REGEXP_REPLACE(COALESCE(${extras.colunaCpf}, ''), '[^0-9]', '', 'g') LIKE $${idx++}`);
  }

  // --- Branch 3: match por matricula (ILIKE simples, case-insensitive) ---
  if (extras.colunaMatricula) {
    params.push(`%${termoTrim}%`);
    branches.push(`COALESCE(${extras.colunaMatricula}, '') ILIKE $${idx++}`);
  }

  if (branches.length === 0) {
    return { whereClause: '', params: [], nextIndex: paramStartIndex, termoNormalizado: termoNorm };
  }

  return {
    whereClause: `(${branches.join(' OR ')})`,
    params,
    nextIndex: idx,
    termoNormalizado: termoNorm,
  };
}

/**
 * Monta ORDER BY com ranking de relevancia.
 * Usado depois de buildWhereNome, encadeando o proximo paramStartIndex.
 *
 * @param {Object} opts
 * @param {string} opts.colunaNome - mesma coluna usada em buildWhereNome
 * @param {string} opts.termoNormalizado - vindo do retorno de buildWhereNome
 * @param {number} opts.paramStartIndex
 * @param {string} [opts.fallbackOrderBy='nome'] - ordenacao quando nao ha termo
 *
 * @returns {{ orderClause: string, params: any[], nextIndex: number }}
 */
export function buildOrderByRelevancia({ colunaNome, termoNormalizado, paramStartIndex, fallbackOrderBy = null }) {
  if (!termoNormalizado) {
    const fb = fallbackOrderBy || colunaNome;
    return { orderClause: fb, params: [], nextIndex: paramStartIndex };
  }

  const nomeNormExpr = `cobranca.normalizar_busca(${colunaNome})`;
  const params = [
    `${termoNormalizado}%`,              // $idx   — comeca com termo (score 0)
    `%(^| )${termoNormalizado}%`,         // nao usado — placeholder para alinhar
    termoNormalizado,                     // $idx+1 — termo puro para similarity + regex prefix-palavra
  ];
  // Ajustar: vou usar regex com escape simples
  // Passos:
  //   score 0: nomeNorm LIKE termoNorm || '%'    -> parametro 'termoNorm%'
  //   score 1: nomeNorm ~ ('(^|\s)' || termoNorm) -> parametro termoNorm simples
  //   similarity(nomeNorm, termoNorm) DESC         -> parametro termoNorm simples
  // Reutiliza o mesmo param de termo puro para regex e similarity.

  // Limpar e usar dois params:
  //   $i   : termoNorm seguido de % para LIKE prefix
  //   $i+1 : termoNorm puro para regex e similarity
  const i0 = paramStartIndex;
  const i1 = paramStartIndex + 1;
  const finalParams = [`${termoNormalizado}%`, termoNormalizado];

  const orderClause = `
    CASE
      WHEN ${nomeNormExpr} LIKE $${i0} THEN 0
      WHEN ${nomeNormExpr} ~ ('(^|\\s)' || $${i1}) THEN 1
      ELSE 2
    END,
    similarity(${nomeNormExpr}, $${i1}) DESC,
    ${colunaNome}
  `.trim().replace(/\s+/g, ' ');

  return { orderClause, params: finalParams, nextIndex: i1 + 1 };
}

/**
 * Utilitario all-in-one: constroi a clausula combinada (WHERE + ORDER BY)
 * pronta para concatenar numa query. Retorna { filterClause, orderClause, params, termoNormalizado }.
 *
 * Uso tipico:
 *   const { filterClause, orderClause, params } = buildBuscaClauses({ ... });
 *   const sql = `SELECT ... WHERE ativo = true ${filterClause ? 'AND ' + filterClause : ''} ORDER BY ${orderClause} LIMIT ...`;
 */
export function buildBuscaClauses({ colunaNome, termo, extras = {}, paramStartIndex = 1, fallbackOrderBy = null }) {
  const w = buildWhereNome({ colunaNome, termo, extras, paramStartIndex });
  const o = buildOrderByRelevancia({
    colunaNome,
    termoNormalizado: w.termoNormalizado,
    paramStartIndex: w.nextIndex,
    fallbackOrderBy,
  });
  return {
    filterClause: w.whereClause,
    orderClause: o.orderClause,
    params: [...w.params, ...o.params],
    nextIndex: o.nextIndex,
    termoNormalizado: w.termoNormalizado,
  };
}
