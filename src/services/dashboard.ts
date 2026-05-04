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
