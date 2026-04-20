import type {
  EventoLigacao,
  QualificacaoLigacao,
  DispositivoAudio,
  TipoEventoLigacao,
} from '../types/ligacao';
import { alunosMock } from './alunos';

// --- Qualificações (simulando campaign.dialer.qualification_list.qualifications) ---
export const qualificacoesMock: QualificacaoLigacao[] = [
  { id: 1, nome: 'Acordo realizado', cor: '#22c55e', conversion: true, is_positive: true },
  { id: 2, nome: 'Retornar depois', cor: '#3b82f6', conversion: false, is_positive: true },
  { id: 3, nome: 'Sem interesse', cor: '#ef4444', conversion: false, is_positive: false },
  { id: 4, nome: 'Número errado', cor: '#f59e0b', conversion: false, is_positive: false },
  { id: 5, nome: 'Caixa postal', cor: '#8b5cf6', conversion: false, is_positive: false },
  { id: 6, nome: 'Não atendeu', cor: '#6b7280', conversion: false, is_positive: false },
  { id: 7, nome: 'Desligou', cor: '#dc2626', conversion: false, is_positive: false },
];

// --- Dispositivos de áudio ---
export const dispositivosMock: DispositivoAudio[] = [
  { deviceId: 'jabra-001', label: 'Jabra Evolve2 50 (USB)', isJabra: true },
  { deviceId: 'default-001', label: 'Microfone padrão (Realtek)', isJabra: false },
  { deviceId: 'webcam-001', label: 'Webcam HD Microphone', isJabra: false },
  { deviceId: 'bt-001', label: 'Headset Bluetooth', isJabra: false },
];

// --- Telefones fictícios para simulação ---
const telefonesMock = [
  '5531998765432',
  '5562991088407',
  '5511987654321',
  '5521976543210',
  '5579998841145',
  '5534999887766',
  '5541988776655',
  '5548977665544',
];

const nomesMock = [
  'Maria Clara Oliveira Santos',
  'João Pedro Almeida',
  'Ana Carolina Ferreira',
  'Lucas Gabriel Costa',
  'Isabela Martins Silva',
  'Pedro Henrique Souza',
  'Camila Rodrigues Lima',
  'Rafael Santos Oliveira',
];

// --- Helper: criar evento ---
let eventoCounter = 0;
function criarEvento(
  tipo: TipoEventoLigacao,
  overrides?: Partial<EventoLigacao>
): EventoLigacao {
  eventoCounter++;
  const idx = eventoCounter % telefonesMock.length;
  return {
    id: `evt-${Date.now()}-${eventoCounter}`,
    tipo,
    timestamp: new Date().toISOString(),
    telefone: telefonesMock[idx],
    pessoaNome: nomesMock[idx],
    pessoaCodigo: 596 + idx,
    ...overrides,
  };
}

// --- Eventos pré-montados para o log ---
export const eventosLigacaoMock: EventoLigacao[] = [
  criarEvento('agent-is-idle', { timestamp: '2026-04-13T09:00:00', telefone: undefined, pessoaNome: undefined }),
  criarEvento('call-was-created', { timestamp: '2026-04-13T09:00:15', telefone: '5531998765432', pessoaNome: 'Maria Clara Oliveira Santos' }),
  criarEvento('call-was-answered', { timestamp: '2026-04-13T09:00:22', telefone: '5531998765432', pessoaNome: 'Maria Clara Oliveira Santos' }),
  criarEvento('call-was-connected', { timestamp: '2026-04-13T09:00:24', telefone: '5531998765432', pessoaNome: 'Maria Clara Oliveira Santos' }),
  criarEvento('call-was-hung-up', { timestamp: '2026-04-13T09:05:48', telefone: '5531998765432', pessoaNome: 'Maria Clara Oliveira Santos', duracao: 324 }),
  criarEvento('call-was-finished', { timestamp: '2026-04-13T09:05:49', telefone: '5531998765432', pessoaNome: 'Maria Clara Oliveira Santos' }),
  criarEvento('call-history-was-created', { timestamp: '2026-04-13T09:06:10', telefone: '5531998765432', pessoaNome: 'Maria Clara Oliveira Santos', duracao: 324 }),
  criarEvento('agent-is-idle', { timestamp: '2026-04-13T09:06:30', telefone: undefined, pessoaNome: undefined }),
  criarEvento('call-was-created', { timestamp: '2026-04-13T09:06:45', telefone: '5562991088407', pessoaNome: 'João Pedro Almeida' }),
  criarEvento('call-was-unanswered', { timestamp: '2026-04-13T09:07:15', telefone: '5562991088407', pessoaNome: 'João Pedro Almeida' }),
  criarEvento('call-was-created', { timestamp: '2026-04-13T09:07:20', telefone: '5511987654321', pessoaNome: 'Ana Carolina Ferreira' }),
  criarEvento('call-was-answered', { timestamp: '2026-04-13T09:07:28', telefone: '5511987654321', pessoaNome: 'Ana Carolina Ferreira' }),
  criarEvento('call-was-abandoned', { timestamp: '2026-04-13T09:07:35', telefone: '5511987654321', pessoaNome: 'Ana Carolina Ferreira' }),
  criarEvento('call-was-created', { timestamp: '2026-04-13T09:07:40', telefone: '5521976543210', pessoaNome: 'Lucas Gabriel Costa' }),
  criarEvento('call-was-answered', { timestamp: '2026-04-13T09:07:48', telefone: '5521976543210', pessoaNome: 'Lucas Gabriel Costa' }),
  criarEvento('call-was-connected', { timestamp: '2026-04-13T09:07:50', telefone: '5521976543210', pessoaNome: 'Lucas Gabriel Costa' }),
];

// --- Simulador de fluxo de chamada ---
export function simularFluxoLigacao(
  callback: (evento: EventoLigacao) => void
): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const idx = Math.floor(Math.random() * telefonesMock.length);
  const telefone = telefonesMock[idx];
  const nome = nomesMock[idx];
  const aluno = alunosMock[0]; // usa o primeiro aluno mock

  // call-was-created (imediato)
  timers.push(setTimeout(() => {
    callback(criarEvento('call-was-created', { telefone, pessoaNome: nome, pessoaCodigo: aluno.codigo }));
  }, 500));

  // call-was-answered (2s)
  timers.push(setTimeout(() => {
    callback(criarEvento('call-was-answered', { telefone, pessoaNome: nome, pessoaCodigo: aluno.codigo }));
  }, 2500));

  // call-was-connected (3s)
  timers.push(setTimeout(() => {
    callback(criarEvento('call-was-connected', { telefone, pessoaNome: nome, pessoaCodigo: aluno.codigo }));
  }, 3500));

  // call-was-hung-up (random 15-30s after connected)
  const duracao = Math.floor(Math.random() * 15 + 15);
  timers.push(setTimeout(() => {
    callback(criarEvento('call-was-hung-up', { telefone, pessoaNome: nome, pessoaCodigo: aluno.codigo, duracao }));
  }, 3500 + duracao * 1000));

  // call-was-finished (1s after hung-up)
  timers.push(setTimeout(() => {
    callback(criarEvento('call-was-finished', { telefone, pessoaNome: nome, pessoaCodigo: aluno.codigo }));
  }, 4500 + duracao * 1000));

  // call-history-was-created (3s after finished)
  timers.push(setTimeout(() => {
    callback(criarEvento('call-history-was-created', { telefone, pessoaNome: nome, pessoaCodigo: aluno.codigo, duracao }));
  }, 7500 + duracao * 1000));

  return () => timers.forEach(clearTimeout);
}

// --- Simular evento de não atendimento ---
export function simularNaoAtendida(
  callback: (evento: EventoLigacao) => void
): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const idx = Math.floor(Math.random() * telefonesMock.length);
  const telefone = telefonesMock[idx];
  const nome = nomesMock[idx];

  timers.push(setTimeout(() => {
    callback(criarEvento('call-was-created', { telefone, pessoaNome: nome }));
  }, 500));

  timers.push(setTimeout(() => {
    callback(criarEvento('call-was-unanswered', { telefone, pessoaNome: nome }));
  }, 8000));

  return () => timers.forEach(clearTimeout);
}

// --- Formato de telefone para exibição ---
export function formatarTelefone(tel: string): string {
  // Remove +55 se presente
  const clean = tel.replace(/^55/, '');
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return tel;
}
