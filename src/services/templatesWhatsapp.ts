import { api } from './api';
import type { TemplateWhatsapp, NovoTemplateWhatsapp, CategoriaTemplate } from '../types/templateWhatsapp';

export async function listarTemplates(categoria?: CategoriaTemplate): Promise<TemplateWhatsapp[]> {
  const query = categoria ? `?categoria=${encodeURIComponent(categoria)}` : '';
  const res = await api.get<{ data: TemplateWhatsapp[] }>(`/templates-whatsapp${query}`);
  return res.data;
}

export async function obterTemplate(id: number): Promise<TemplateWhatsapp> {
  const res = await api.get<{ data: TemplateWhatsapp }>(`/templates-whatsapp/${id}`);
  return res.data;
}

export async function criarTemplate(data: NovoTemplateWhatsapp): Promise<TemplateWhatsapp> {
  const res = await api.post<{ data: TemplateWhatsapp }>('/templates-whatsapp', data);
  return res.data;
}

export async function atualizarTemplate(
  id: number,
  data: Partial<NovoTemplateWhatsapp & { ativo: boolean }>
): Promise<TemplateWhatsapp> {
  const res = await api.put<{ data: TemplateWhatsapp }>(`/templates-whatsapp/${id}`, data);
  return res.data;
}

export async function removerTemplate(id: number): Promise<void> {
  await api.delete(`/templates-whatsapp/${id}`);
}
