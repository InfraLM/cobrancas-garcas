/**
 * Cache em memoria simples com TTL para endpoints "frios" do dashboard.
 *
 * Uso:
 *   import { getOrSet, invalidate } from '../utils/memCache.js';
 *
 *   const data = await getOrSet('dashboard:funil:inicio=...&fim=...', 30, async () => {
 *     return await calcularFunil(...);
 *   });
 *
 *   invalidate('dashboard:');  // limpa todas chaves com esse prefixo
 *
 * NAO usar em rotas mutaveis (POST/PATCH/DELETE) ou listas que mudam em tempo real
 * (conversas, acordos, etc.). Cache se encaixa em metricas agregadas.
 *
 * Caracteristicas:
 * - Storage em-process. Reinicio do server limpa o cache.
 * - Sem limite de tamanho (uso esperado: <100 chaves de dashboard).
 * - Garbage collection passiva: chaves expiradas sao removidas no proximo getOrSet.
 */

const store = new Map();

function isExpired(entry) {
  return entry.expiresAt <= Date.now();
}

/**
 * Retorna o valor cacheado para a chave; se ausente ou expirado, executa
 * computeFn(), guarda com TTL, e retorna.
 *
 * @param {string} key
 * @param {number} ttlSec
 * @param {() => Promise<any>} computeFn
 */
export async function getOrSet(key, ttlSec, computeFn) {
  const entry = store.get(key);
  if (entry && !isExpired(entry)) {
    return entry.value;
  }
  const value = await computeFn();
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSec * 1000,
  });
  return value;
}

/**
 * Remove todas as chaves que comecam com o prefix informado.
 * Util quando uma mutacao invalida varios endpoints relacionados.
 */
export function invalidate(prefix) {
  let removidos = 0;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removidos++;
    }
  }
  return removidos;
}

/**
 * Limpa todo o cache (uso em dev/teste).
 */
export function clearAll() {
  store.clear();
}

/**
 * Util para gerar chave estavel a partir de query params.
 *   chaveDe('dashboard:funil', { inicio: '2026-04-28', fim: '2026-04-28' })
 *   => 'dashboard:funil:fim=2026-04-28&inicio=2026-04-28'
 */
export function chaveDe(prefix, params = {}) {
  const ordenadas = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return ordenadas ? `${prefix}:${ordenadas}` : prefix;
}
