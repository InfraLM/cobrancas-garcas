import { api } from './api';
import type { AcordoFinanceiro, PagamentoAcordo } from '../types/acordo';

interface ListarAcordosParams {
  etapa?: string;
  criadoPor?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface ListarAcordosResponse {
  acordos: AcordoFinanceiro[];
  total: number;
}

export async function listarAcordos(params: ListarAcordosParams = {}): Promise<ListarAcordosResponse> {
  const searchParams = new URLSearchParams();
  if (params.etapa) searchParams.set('etapa', params.etapa);
  if (params.criadoPor) searchParams.set('criadoPor', params.criadoPor);
  if (params.search) searchParams.set('search', params.search);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  return api.get<ListarAcordosResponse>(`/acordos${qs ? `?${qs}` : ''}`);
}

export async function obterAcordo(id: string): Promise<AcordoFinanceiro> {
  return api.get<AcordoFinanceiro>(`/acordos/${id}`);
}

interface CriarAcordoPayload {
  pessoaCodigo: number;
  pessoaNome: string;
  pessoaCpf: string;
  matricula?: string;
  turmaIdentificador?: string;
  cursoNome?: string;
  celularAluno?: string;
  emailAluno?: string;
  valorOriginal: number;
  valorMultaJuros: number;
  valorDescontos?: number;
  valorRecebidoPrevio?: number;
  valorSaldoDevedor: number;
  descontoAcordo?: number;
  descontoAcordoPercentual?: number;
  valorAcordo: number;
  vincularRecorrencia?: boolean;
  observacao?: string;
  parcelasOriginais: {
    contaReceberCodigo: number;
    parcela?: string;
    valor: number;
    multa?: number;
    juro?: number;
    descontos?: number;
    valorRecebido?: number;
    saldoDevedor: number;
    dataVencimento: string;
    tipoOrigem?: string;
  }[];
  pagamentos: {
    numeroPagamento?: number;
    valor: number;
    formaPagamento: string;
    parcelas?: number;
    dataVencimento: string;
  }[];
}

export async function criarAcordo(payload: CriarAcordoPayload): Promise<AcordoFinanceiro> {
  return api.post<AcordoFinanceiro>('/acordos', payload);
}

export async function atualizarEtapa(id: string, etapa: string): Promise<AcordoFinanceiro> {
  return api.put<AcordoFinanceiro>(`/acordos/${id}/etapa`, { etapa });
}

export async function vincularSei(id: string, codigoNegociacao: number): Promise<AcordoFinanceiro> {
  return api.put<AcordoFinanceiro>(`/acordos/${id}/vincular-sei`, { codigoNegociacao });
}

export async function cancelarAcordo(id: string, motivo: string): Promise<AcordoFinanceiro> {
  return api.delete<AcordoFinanceiro>(`/acordos/${id}`, { motivo });
}

export interface PreviewCancelamento {
  podeCancelar: boolean;
  motivo: string | null;
  etapa: string;
  pagamentosACancelar: Array<{
    id: string;
    numero: number;
    valor: number;
    situacao: string;
    vencimento: string;
    asaasPaymentId: string | null;
  }>;
  pagamentosConfirmados: Array<{
    numero: number;
    valor: number;
    pagoEm: string | null;
  }>;
  termo: {
    envelopeId: string | null;
    assinado: boolean;
    seraCanceladoNaClicksign: boolean;
  };
}

export async function previewCancelamento(id: string): Promise<PreviewCancelamento> {
  return api.get<PreviewCancelamento>(`/acordos/${id}/preview-cancelamento`);
}

export async function enviarAssinatura(id: string): Promise<AcordoFinanceiro> {
  return api.post<AcordoFinanceiro>(`/acordos/${id}/enviar-assinatura`, {});
}

export async function baixarDocumentoAssinado(id: string, nomeAluno: string): Promise<void> {
  const API_URL = import.meta.env.VITE_API_URL || '/api';
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_URL}/acordos/${id}/documento-assinado`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) throw new Error('Documento nao encontrado');

  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/pdf')) {
    // PDF direto do banco
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `termo_assinado_${nomeAluno.replace(/\s+/g, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    // URL (fallback)
    const { url } = await res.json();
    window.open(url, '_blank');
  }
}

export async function listarPorAluno(codigo: number): Promise<AcordoFinanceiro[]> {
  return api.get<AcordoFinanceiro[]>(`/acordos/por-aluno/${codigo}`);
}

export async function cancelarPagamento(acordoId: string, pagamentoId: string): Promise<PagamentoAcordo> {
  return api.post<PagamentoAcordo>(`/acordos/${acordoId}/pagamentos/${pagamentoId}/cancelar`, {});
}
