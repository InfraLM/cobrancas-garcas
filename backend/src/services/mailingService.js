/**
 * Service para mailing lists da 3C Plus.
 * Cria listas e adiciona contatos na campanha de massa.
 *
 * API: https://liberdademedica.3c.plus/api/v1
 * Auth: ?api_token=MANAGER_TOKEN
 */

const DISCADOR_API = 'https://liberdademedica.3c.plus/api/v1';
const CAMPANHA_MASSA = 257976;

function getToken() {
  return process.env.THREECPLUS_MANAGER_TOKEN;
}

function url(path) {
  return `${DISCADOR_API}${path}?api_token=${getToken()}`;
}

/**
 * Cria uma mailing list na campanha.
 * @returns {Promise<{listId: number, name: string}>}
 */
export async function criarLista(campaignId, nome) {
  // Criar lista com headers definidos (identifier + phone)
  const formBody = new URLSearchParams();
  formBody.append('name', nome);
  formBody.append('header[0]', 'identifier');
  formBody.append('header[1]', 'areacodephone');

  const res = await fetch(url(`/campaigns/${campaignId}/lists`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ao criar lista (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const listId = data.data?.id || data.id;
  console.log(`[Mailing] Lista criada: ${nome} (ID: ${listId})`);
  return { listId, name: nome };
}

/**
 * Adiciona contatos a uma mailing list via JSON.
 * @param {Array<{phone: string, name: string}>} contatos
 * @returns {Promise<{total: number}>}
 */
export async function adicionarContatos(campaignId, listId, contatos) {
  if (contatos.length === 0) return { total: 0 };

  // Formato correto: array raiz para endpoint .json
  const body = contatos.map(c => ({
    identifier: c.identifier || c.name || '',
    phone: c.phone,
  }));

  const res = await fetch(url(`/campaigns/${campaignId}/lists/${listId}/mailing.json`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Erro ao adicionar contatos (${res.status}): ${text.slice(0, 200)}`);
  }

  console.log(`[Mailing] ${contatos.length} contatos adicionados à lista ${listId}`);
  return { total: contatos.length };
}

/**
 * Fluxo completo: cria lista e adiciona contatos de uma segmentacao.
 * @param {Array<{codigo: number, nome: string, celular: string|null}>} alunos
 * @param {string} nomeRegra
 * @returns {Promise<{listId: number, totalSubidos: number, totalSemTelefone: number}>}
 */
/**
 * Lista mailing lists de uma campanha.
 */
export async function listarListas(campaignId) {
  const res = await fetch(url(`/campaigns/${campaignId}/lists`));
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

/**
 * Deleta uma mailing list.
 */
export async function deletarLista(campaignId, listId) {
  await fetch(url(`/campaigns/${campaignId}/lists/${listId}`), { method: 'DELETE' });
  console.log(`[Mailing] Lista ${listId} deletada`);
}

/**
 * Limpa TODAS as listas de uma campanha.
 */
export async function limparListasCampanha(campaignId = CAMPANHA_MASSA) {
  const listas = await listarListas(campaignId);
  for (const lista of listas) {
    if (lista.id) await deletarLista(campaignId, lista.id);
  }
  console.log(`[Mailing] ${listas.length} listas removidas da campanha ${campaignId}`);
}

export async function subirSegmentacaoParaCampanha(alunos, nomeRegra) {
  const comTelefone = [];
  const semTelefone = [];

  for (const aluno of alunos) {
    const tel = (aluno.celular || '').replace(/\D/g, '');
    if (tel.length >= 10 && tel.length <= 11) {
      comTelefone.push({
        phone: tel,
        identifier: String(aluno.codigo),
        name: aluno.nome,
      });
    } else {
      semTelefone.push(aluno);
    }
  }

  if (comTelefone.length === 0) {
    throw new Error('Nenhum aluno da segmentacao possui telefone valido');
  }

  // Criar lista com nome da regra + data
  const dataHoje = new Date().toISOString().slice(0, 10);
  const nomeLista = `${nomeRegra} (${dataHoje})`;
  const { listId } = await criarLista(CAMPANHA_MASSA, nomeLista);

  // Adicionar contatos em batches de 100
  const BATCH_SIZE = 100;
  let totalSubidos = 0;

  for (let i = 0; i < comTelefone.length; i += BATCH_SIZE) {
    const batch = comTelefone.slice(i, i + BATCH_SIZE);
    await adicionarContatos(CAMPANHA_MASSA, listId, batch);
    totalSubidos += batch.length;
  }

  console.log(`[Mailing] Segmentacao "${nomeRegra}" subida: ${totalSubidos} contatos, ${semTelefone.length} sem telefone`);

  return {
    listId,
    totalSubidos,
    totalSemTelefone: semTelefone.length,
    campanha: CAMPANHA_MASSA,
  };
}
