import { api } from './api';

export type PeriodoFunil = '7d' | '30d' | '90d';

export interface FunilEtapa {
  etapa: string;
  qtd: number;
  valor: number;
}

export interface FunilResponse {
  periodo: string;
  funil: FunilEtapa[];
}

export async function obterFunilDashboard(periodo: PeriodoFunil): Promise<FunilResponse> {
  return api.get<FunilResponse>(`/dashboard/funil?periodo=${periodo}`);
}
