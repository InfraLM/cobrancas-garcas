import { api } from './api';

export interface FicouFacil {
  id: string;
  pessoaCodigo: number;
  pessoaNome: string;
  pessoaCpf: string;
  matricula?: string;
  turma?: string;
  celularAluno?: string;
  etapa: string;
  valorPos: number;
  valorRecebido: number;
  valorInadimplente: number;
  valorInadimplenteMJ: number;
  contaSantander: boolean;
  checkboxes: Record<string, boolean>;
  creditoAprovado?: boolean;
  creditoObservacao?: string;
  criadoPor: number;
  criadoPorNome: string;
  observacao?: string;
  criadoEm: string;
  concluidoEm?: string;
  canceladoEm?: string;
  documentos?: { id: string; tipo: string; nomeArquivo: string; criadoEm: string }[];
}

export interface ValoresCalculados {
  valorPos: number;
  valorRecebido: number;
  valorInadimplente: number;
  valorInadimplenteMJ: number;
}

export async function calcularValores(pessoaCodigo: number): Promise<ValoresCalculados> {
  return api.get<ValoresCalculados>(`/ficou-facil/calcular/${pessoaCodigo}`);
}

export async function listarFicouFacil(params?: { etapa?: string; search?: string }): Promise<FicouFacil[]> {
  const query = new URLSearchParams();
  if (params?.etapa) query.set('etapa', params.etapa);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  return api.get<FicouFacil[]>(`/ficou-facil${qs ? `?${qs}` : ''}`);
}

export async function obterFicouFacil(id: string): Promise<FicouFacil> {
  return api.get<FicouFacil>(`/ficou-facil/${id}`);
}

export async function criarFicouFacil(payload: {
  pessoaCodigo: number; pessoaNome: string; pessoaCpf: string;
  matricula?: string; turma?: string; celularAluno?: string;
  valorPos: number; valorRecebido: number; valorInadimplente: number; valorInadimplenteMJ: number;
  contaSantander?: boolean; observacao?: string;
}): Promise<FicouFacil> {
  return api.post<FicouFacil>('/ficou-facil', payload);
}

export async function atualizarEtapaFF(id: string, etapa: string): Promise<FicouFacil> {
  return api.put<FicouFacil>(`/ficou-facil/${id}/etapa`, { etapa });
}

export async function atualizarCheckboxes(id: string, checkboxes: Record<string, boolean>): Promise<FicouFacil> {
  return api.put<FicouFacil>(`/ficou-facil/${id}/checkboxes`, { checkboxes });
}

export async function atualizarCredito(id: string, creditoAprovado: boolean, creditoObservacao?: string): Promise<FicouFacil> {
  return api.put<FicouFacil>(`/ficou-facil/${id}/credito`, { creditoAprovado, creditoObservacao });
}

export async function cancelarFicouFacil(id: string): Promise<FicouFacil> {
  return api.delete<FicouFacil>(`/ficou-facil/${id}`);
}

export async function uploadDocumentoFF(id: string, arquivo: File, tipo: string): Promise<any> {
  const API_URL = import.meta.env.VITE_API_URL || '/api';
  const token = localStorage.getItem('auth_token');
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  formData.append('tipo', tipo);

  const res = await fetch(`${API_URL}/ficou-facil/${id}/documentos`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error('Erro ao enviar documento');
  return res.json();
}

export async function baixarDocumentoFF(docId: string, nomeArquivo: string): Promise<void> {
  const API_URL = import.meta.env.VITE_API_URL || '/api';
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_URL}/ficou-facil/documentos/${docId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Documento nao encontrado');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

export async function listarPorAlunoFF(codigo: number): Promise<FicouFacil[]> {
  return api.get<FicouFacil[]>(`/ficou-facil/por-aluno/${codigo}`);
}
