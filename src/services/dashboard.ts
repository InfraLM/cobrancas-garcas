import { api } from './api';

export interface FunilEtapa {
  etapa: string;
  qtd: number;
  valor: number;
}

export interface FunilResponse {
  inicio: string;
  fim: string;
  snapshotData: string | null;
  aviso: string | null;
  funil: FunilEtapa[];
}

export async function obterFunilDashboard(inicio: string, fim: string, agenteIds?: number[]): Promise<FunilResponse> {
  const qs = new URLSearchParams({ inicio, fim });
  if (agenteIds && agenteIds.length > 0) qs.set('agenteIds', agenteIds.join(','));
  return api.get<FunilResponse>(`/dashboard/funil?${qs}`);
}

// ----------------------------------------------------------------------
// Graficos de Recorrencia parametrizados (granularidade + periodo)
// ----------------------------------------------------------------------
export type Granularidade = 'semana' | 'mes';

export interface OptsBucket {
  granularidade: Granularidade;
  inicio: string; // YYYY-MM-DD
  fim: string;    // YYYY-MM-DD
}

export interface BucketRecorrentes {
  semana: number;
  inicio: string;
  fim: string;
  label: string;
  totalAtivos: number;
  recorrentes: number;
  semRecorrencia: number;
  percentual: number;
}

export interface BucketAcumulado {
  semana: number;
  inicio: string;
  fim: string;
  label: string;
  novos: number;
  acumulado: number;
  recorrentesSemana: number;
  acumuladoRecorrentes: number;
  percentualRecorrentes: number;
}

interface BucketResponse<T> extends OptsBucket {
  data: T[];
}

function qsBucket(opts: OptsBucket) {
  const qs = new URLSearchParams();
  qs.set('granularidade', opts.granularidade);
  qs.set('inicio', opts.inicio);
  qs.set('fim', opts.fim);
  return qs.toString();
}

export async function obterRecorrentesHistorico(opts: OptsBucket): Promise<BucketResponse<BucketRecorrentes>> {
  return api.get<BucketResponse<BucketRecorrentes>>(`/dashboard/recorrentes-historico?${qsBucket(opts)}`);
}

export async function obterAcumuladoAlunos(opts: OptsBucket): Promise<BucketResponse<BucketAcumulado>> {
  return api.get<BucketResponse<BucketAcumulado>>(`/dashboard/acumulado-alunos?${qsBucket(opts)}`);
}

// ----------------------------------------------------------------------
// Aging Atual e Aging Historico — endpoints globais (sem filtro de agente)
// ----------------------------------------------------------------------
export interface AgingFaixa {
  faixa: string;
  qtd: number;
  valor: number;
}

export type CohortMatricula = 'total' | 'antes2026' | '2026';

export interface AgingHistoricoSemana {
  semana: number;
  inicio: string;
  fim: string;
  label: string;
  // Total (legado — soma de antes2026 + 2026)
  faixa_0_5: number;
  faixa_6_30: number;
  faixa_31_90: number;
  faixa_90_mais: number;
  // Cohort: matricula vinculada ao titulo data < 2026-01-01 (ou ausente / curso != 1)
  faixa_0_5_antes2026: number;
  faixa_6_30_antes2026: number;
  faixa_31_90_antes2026: number;
  faixa_90_mais_antes2026: number;
  // Cohort: matricula vinculada ao titulo data >= 2026-01-01
  faixa_0_5_2026: number;
  faixa_6_30_2026: number;
  faixa_31_90_2026: number;
  faixa_90_mais_2026: number;
}

export async function obterAging(): Promise<{ data: AgingFaixa[] }> {
  return api.get<{ data: AgingFaixa[] }>('/dashboard/aging');
}

export async function obterAgingHistorico(opts?: OptsBucket): Promise<BucketResponse<AgingHistoricoSemana>> {
  const url = opts ? `/dashboard/aging-historico?${qsBucket(opts)}` : '/dashboard/aging-historico';
  return api.get<BucketResponse<AgingHistoricoSemana>>(url);
}

// ----------------------------------------------------------------------
// Matriz de Recuperacao: Categoria de aging x Metodo de pagamento
// ----------------------------------------------------------------------
export type ModoFiltroMatriz = 'negociado' | 'pago';
export type CategoriaAging = 'Baixa' | 'Média' | 'Alta';

export interface CelulaMatriz {
  qtdAlunos: number;
  valorBruto: number;
  valorLiquido: number;
}

export interface LinhaCategoriaMatriz {
  categoria: CategoriaAging;
  metodos: Record<string, CelulaMatriz>;
  totalCategoria: CelulaMatriz;
}

export interface MatrizRecuperacaoResponse {
  filtros: { inicio: string; fim: string; modoFiltro: ModoFiltroMatriz; agenteIds: number[] | null };
  matriz: LinhaCategoriaMatriz[];
  totais: CelulaMatriz;
}

export async function obterMatrizRecuperacao(opts: {
  inicio: string;
  fim: string;
  modoFiltro?: ModoFiltroMatriz;
  agenteIds?: number[];
}): Promise<MatrizRecuperacaoResponse> {
  const qs = new URLSearchParams({ inicio: opts.inicio, fim: opts.fim });
  if (opts.modoFiltro) qs.set('modoFiltro', opts.modoFiltro);
  if (opts.agenteIds && opts.agenteIds.length > 0) qs.set('agenteIds', opts.agenteIds.join(','));
  return api.get<MatrizRecuperacaoResponse>(`/dashboard/matriz-recuperacao?${qs}`);
}

// Ordem fixa de metodos para renderizacao da matriz (mesmo que a planilha do user)
export const METODOS_MATRIZ = [
  'Cartão à vista',
  'Cartão 2-6x',
  'Cartão 7-12x',
  'Ficou Fácil',
  'Boleto',
  'Pix',
] as const;
