import type { Aluno } from './aluno';

// --- Estado da Página ---
export type EstadoPaginaLigacao =
  | 'IDLE'
  | 'SELECAO_TIPO'
  | 'CONFIG_CAMPANHA'
  | 'TESTE_AUDIO'
  | 'CONECTANDO'
  | 'EM_LIGACAO'
  | 'QUALIFICACAO';

export type TipoLigacao = 'individual' | 'massa';

// --- Status do Agente 3C Plus ---
export type StatusAgente3C = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 21 | 22;

export const statusAgenteLabel: Record<StatusAgente3C, string> = {
  0: 'Offline',
  1: 'Disponível',
  2: 'Em ligação',
  3: 'Pós-atendimento',
  4: 'Chamada manual',
  5: 'Manual conectada',
  6: 'Pausa',
  21: 'Manual pós-atendimento',
  22: 'Manual TPA conectada',
};

// --- Eventos Socket.io ---
export type TipoEventoLigacao =
  | 'agent-is-idle'
  | 'agent-in-acw'
  | 'agent-login-failed'
  | 'agent-was-logged-out'
  | 'call-was-created'
  | 'call-was-answered'
  | 'call-was-connected'
  | 'call-was-hung-up'
  | 'call-was-finished'
  | 'call-was-unanswered'
  | 'call-was-abandoned'
  | 'call-history-was-created';

export const eventoLabel: Record<TipoEventoLigacao, string> = {
  'agent-is-idle': 'Agente disponível',
  'agent-in-acw': 'Pós-atendimento',
  'agent-login-failed': 'Falha no login',
  'agent-was-logged-out': 'Agente deslogado',
  'call-was-created': 'Chamada criada',
  'call-was-answered': 'Cliente atendeu',
  'call-was-connected': 'Conectado ao agente',
  'call-was-hung-up': 'Chamada desligada',
  'call-was-finished': 'Chamada finalizada',
  'call-was-unanswered': 'Não atendida',
  'call-was-abandoned': 'Abandonada',
  'call-history-was-created': 'Histórico criado',
};

export type CategoriaEvento = 'sucesso' | 'erro' | 'info' | 'neutro';

export const categoriaEvento: Record<TipoEventoLigacao, CategoriaEvento> = {
  'agent-is-idle': 'info',
  'agent-in-acw': 'neutro',
  'agent-login-failed': 'erro',
  'agent-was-logged-out': 'erro',
  'call-was-created': 'neutro',
  'call-was-answered': 'info',
  'call-was-connected': 'sucesso',
  'call-was-hung-up': 'neutro',
  'call-was-finished': 'neutro',
  'call-was-unanswered': 'erro',
  'call-was-abandoned': 'erro',
  'call-history-was-created': 'info',
};

export interface EventoLigacao {
  id: string;
  tipo: TipoEventoLigacao;
  timestamp: string; // ISO 8601
  telefone?: string;
  pessoaNome?: string;
  pessoaCodigo?: number;
  duracao?: number; // seconds
  qualificacao?: string;
  metadados?: Record<string, unknown>;
}

// --- Campanha / Mailing ---
export interface ListaCampanha {
  regraId: string;
  regraNome: string;
  totalAlunos: number;
  peso: number; // 1-10
}

export interface ConfiguracaoCampanha {
  nome: string;
  listas: ListaCampanha[];
  totalContatos: number;
}

// --- Audio ---
export interface DispositivoAudio {
  deviceId: string;
  label: string;
  isJabra: boolean;
}

export type EstadoTesteAudio =
  | 'DETECTANDO_MIC'
  | 'MIC_PRONTO'
  | 'GRAVANDO'
  | 'REPRODUZINDO'
  | 'PRONTO';

// --- Conexao ---
export interface StatusConexao {
  agenteOnline: boolean;
  socketConectado: boolean;
  webrtcAtivo: boolean;
  sipRegistrado: boolean;
}

// --- Ligacao Ativa ---
export interface LigacaoAtiva {
  id: string;
  callId?: string;      // telephony_id da 3C Plus (usado para hangup)
  telefone: string;
  inicio: string; // ISO timestamp
  aluno: Aluno | null;
  alunoBuscando?: boolean;       // true enquanto o lookup /aluno-por-telefone esta pendente
  alunoNaoEncontrado?: boolean;  // true quando o lookup retornou sem match no SEI
  status: 'discando' | 'tocando' | 'conectada' | 'encerrada';
  amdStatus?: 'human' | 'voicemail';
}

// --- Qualificacao ---
export interface QualificacaoLigacao {
  id: number;
  nome: string;
  cor: string;
  conversion: boolean;
  is_positive: boolean;
}

// --- Callback ---
export interface AgendamentoCallback {
  pessoaCodigo: number;
  pessoaNome: string;
  telefone: string;
  dataHora: string;
  observacao?: string;
}

// --- Config do Agente (referencia para backend) ---
export interface ConfigAgente3C {
  agenteId: number;
  nome: string;
  extensao: number;
  email: string;
  subdomain: string;
  webphoneHabilitado: boolean;
}
