// Tipos compartilhados da aplicacao

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENTE';

export interface User {
  id: number;
  email: string;
  nome: string;
  role: UserRole;
  ativo: boolean;
  avatarUrl: string | null;
  googleId: string | null;

  threecplusUserId: number | null;
  threecplusAgentId: number | null;
  threecplusAgentToken: string | null;
  threecplusExtension: string | null;

  instanciaWhatsappId: string | null;
  instanciaWhatsappNome: string | null;
  grupoCanaisId: string | null;
  grupoCanaisNome: string | null;

  campanhaId: number | null;
  campanhaNome: string | null;

  criadoEm: string;
  atualizadoEm: string;
}

export interface UserFormData {
  email: string;
  nome: string;
  role: UserRole;
  ativo?: boolean;
  threecplusExtension?: string;
  instanciaWhatsappId?: string;
  grupoCanaisId?: string;
  campanhaId?: number;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  AGENTE: 'Agente',
};

export interface ApiError {
  error: string;
}

export interface InstanciaWhatsappUser {
  id: string;
  userId: number;
  instanciaId: string;
  apelido: string;
  telefone: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface NovaInstanciaWhatsapp {
  instanciaId: string;
  apelido: string;
  telefone?: string;
}
