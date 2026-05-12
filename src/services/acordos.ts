import { api } from './api';
import type { AcordoFinanceiro, PagamentoAcordo } from '../types/acordo';

export type AgingCategoria = 'baixa' | 'media' | 'alta';
export type CanalPrecedente = 'ligacao' | 'waba' | '3cplus' | 'sem_contato' | 'ficou_facil';
export type TipoNegociacao = 'acordo' | 'ficou_facil';

export interface AcordoEnriquecido extends AcordoFinanceiro {
  _agingCategoria: AgingCategoria;
  _canalPrecedente: CanalPrecedente;
  // Caixa real (auditoria): SUM(valorPago) das parcelas CONFIRMADO
  _valorPagoEfetivo: number;
  // Competencia (UX): cartao parcelado conta inteiro (creditCardCaptured)
  _valorPagoGarantido: number;
  // Alias de _valorPagoGarantido, mantido para retrocompat
  _valorPago: number;
  _percentualPago: number;
  _diasAteConcluir: number | null;
  _tipo: TipoNegociacao;
}

export interface ListarAcordosParams {
  search?: string;
  etapa?: string;             // CSV
  criadoPor?: string;         // CSV de IDs
  formaPagamento?: string;    // CSV: PIX,BOLETO,CREDIT_CARD
  inicio?: string;            // YYYY-MM-DD
  fim?: string;
  inicioConcluido?: string;
  fimConcluido?: string;
  temDesconto?: 'true' | 'false';
  temTermoAssinado?: 'true' | 'false';
  valorMin?: number;
  valorMax?: number;
  pctPagoMin?: number;
  pctPagoMax?: number;
  aging?: string;             // CSV: baixa,media,alta
  canalPrecedente?: string;   // CSV: ligacao,waba,3cplus,sem_contato
  incluirFicouFacil?: 'true' | 'false';
  page?: number;
  limit?: number;
}

interface ListarAcordosResponse {
  acordos: AcordoEnriquecido[];
  total: number;
}

export async function listarAcordos(params: ListarAcordosParams = {}): Promise<ListarAcordosResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const q = qs.toString();
  return api.get<ListarAcordosResponse>(`/acordos${q ? `?${q}` : ''}`);
}

// Resumo agregado (cards header)
export interface ResumoAcordos {
  total: number;
  concluidos: number;
  cancelados: number;
  abertos: number;
  valorAcordoTotal: number;
  descontoTotal: number;
  valorPago: number;
  valorPagoEfetivo: number;
  valorPagoGarantido: number;
  diasMedioConcluir: number | null;
  porAgente: Array<{ agente: string; qtd: number; valor: number }>;
}

export async function obterResumoAcordos(params: Partial<ListarAcordosParams> = {}): Promise<ResumoAcordos> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const q = qs.toString();
  return api.get<ResumoAcordos>(`/acordos/resumo${q ? `?${q}` : ''}`);
}

// Lista de agentes que ja criaram acordo (alimenta dropdown de filtro)
export interface AgenteAcordo {
  id: number;
  nome: string;
  total: number;
}

export async function listarAgentesAcordos(): Promise<{ agentes: AgenteAcordo[] }> {
  return api.get<{ agentes: AgenteAcordo[] }>('/acordos/agentes');
}

// Detalhe completo do acordo (drawer)
export interface CanalAtribuido {
  atribuido: CanalPrecedente;
  detalhe: Record<string, unknown> | null;
}

// Resposta rapida de /:id/detalhado: acordo + canal precedente.
// Templates/disparos/ligacoes/outrosAcordos/ocorrencias agora chegam via /:id/contexto
// quando o usuario abre as abas Comunicacao/Timeline/Historico.
export interface AcordoDetalhado {
  acordo: AcordoFinanceiro;
  canal: CanalAtribuido;
}

export interface AcordoContexto {
  templatesEnviados: Array<{
    timestamp: string;
    templateMetaNome: string | null;
    instanciaTipo: string;
    fromMe: boolean;
    corpo: string | null;
  }>;
  disparosRegua: Array<{
    id: string;
    disparadoEm: string;
    templateNomeBlip: string;
    status: string;
  }>;
  ligacoesHistorico: Array<{
    id: string;
    dataHoraChamada: string;
    tempoFalando: number;
    agenteNome: string | null;
    qualificacaoNome: string | null;
    qualificacaoPositiva: boolean | null;
    modo: string | null;
    status: number | null;
    statusTexto: string | null;
  }>;
  outrosAcordos: Array<{
    id: string;
    etapa: string;
    valorAcordo: number;
    criadoEm: string;
    concluidoEm: string | null;
    canceladoEm: string | null;
    criadoPorNome: string | null;
  }>;
  ocorrencias: Array<{
    id: string;
    tipo: string;
    origem: string;
    descricao: string;
    agenteNome: string | null;
    criadoEm: string;
    metadados: Record<string, unknown> | null;
  }>;
}

export async function obterAcordoDetalhado(id: string): Promise<AcordoDetalhado> {
  return api.get<AcordoDetalhado>(`/acordos/${id}/detalhado`);
}

export async function obterAcordoContexto(id: string): Promise<AcordoContexto> {
  return api.get<AcordoContexto>(`/acordos/${id}/contexto`);
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
