import { api } from './api';
import type { User, UserFormData } from '../types';

export async function listarUsuarios(): Promise<User[]> {
  return api.get<User[]>('/users');
}

export async function obterUsuario(id: number): Promise<User> {
  return api.get<User>(`/users/${id}`);
}

export async function criarUsuario(data: UserFormData): Promise<User> {
  return api.post<User>('/users', data);
}

export async function atualizarUsuario(id: number, data: Partial<UserFormData>): Promise<User> {
  return api.put<User>(`/users/${id}`, data);
}

export async function excluirUsuario(id: number): Promise<void> {
  return api.delete<void>(`/users/${id}`);
}

export async function criarAgente3CPlus(userId: number): Promise<User> {
  return api.post<User>(`/users/${userId}/criar-agente-3cplus`, {});
}

export async function coletarToken3CPlus(userId: number): Promise<User> {
  return api.post<User>(`/users/${userId}/coletar-token-3cplus`, {});
}

export async function listarInstanciasWhatsapp(): Promise<Array<{ id: string; name: string; phone: string; status: string }>> {
  return api.get('/users/instancias-whatsapp');
}

export async function listarGruposCanais(): Promise<Array<{ id: string; name: string }>> {
  return api.get('/users/grupos-canais');
}

export async function listarCampanhas(): Promise<Array<{ id: number; name: string }>> {
  return api.get('/users/campanhas');
}

export interface CampanhaVinculada {
  id: number;
  name: string;
  vinculado: boolean;
}

export async function listarCampanhasVinculadas(userId: number): Promise<CampanhaVinculada[]> {
  return api.get<CampanhaVinculada[]>(`/users/${userId}/campanhas`);
}

export async function syncCampanhas(userId: number, adicionar: number[], remover: number[]): Promise<void> {
  await api.post(`/users/${userId}/campanhas/sync`, { adicionar, remover });
}

export async function listarEquipes(): Promise<Array<{ id: number; name: string }>> {
  return api.get('/users/grupos-canais');
}

export interface EquipeVinculada {
  id: number;
  name: string;
  vinculado: boolean;
}

export async function listarEquipesVinculadas(userId: number): Promise<EquipeVinculada[]> {
  return api.get<EquipeVinculada[]>(`/users/${userId}/equipes`);
}

export async function syncEquipes(userId: number, equipeSelecionadas: number[]): Promise<void> {
  await api.post(`/users/${userId}/equipes/sync`, { equipeSelecionadas });
}

export async function vincularAgente3CPlus(userId: number): Promise<User> {
  return api.post<User>(`/users/${userId}/vincular-agente-3cplus`, {});
}

export interface Agente3CPlus {
  userId: number;
  agentId: number;
  extension: string | null;
  name: string;
  apiToken: string | null;
}

export async function buscarAgente3CPlus(email: string): Promise<Agente3CPlus | null> {
  const result = await api.get<Agente3CPlus | { encontrado: false }>(`/users/buscar-agente-3cplus?email=${encodeURIComponent(email)}`);
  if ('encontrado' in result && !result.encontrado) return null;
  return result as Agente3CPlus;
}
