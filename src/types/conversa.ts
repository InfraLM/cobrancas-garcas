// --- Conversa de Cobranca (entidade do nosso dominio) ---
export type StatusConversa = 'AGUARDANDO' | 'EM_ATENDIMENTO' | 'SNOOZE' | 'ENCERRADA';

export type MotivoEncerramento =
  | 'ACORDO_FECHADO'
  | 'PAGO_AVISTA'
  | 'SEM_RETORNO'
  | 'RECUSOU'
  | 'NAO_E_DEVEDOR'
  | 'TRANSFERIDO_JURIDICO'
  | 'OUTRO';

export interface ConversaCobranca {
  id: string;
  chatId: string;
  instanciaId: string;
  contatoNumero: string;
  contatoNome: string | null;
  contatoImagem: string | null;
  pessoaCodigo: number | null;
  matricula: string | null;
  status: StatusConversa;
  motivoEncerramento: MotivoEncerramento | null;
  observacaoEncerramento: string | null;
  agenteId: number | null;
  agenteNome: string | null;
  assumidoEm: string | null;
  valorInadimplente: number | null;
  diasAtraso: number | null;
  serasaAtivo: boolean;
  temAcordoAtivo: boolean;
  acordoId: string | null;
  prioridadeScore: number;
  prioridadeFaixa: 'ALTA' | 'MEDIA' | 'BAIXA';
  ultimaMensagemCliente: string | null;
  ultimaMensagemAgente: string | null;
  aguardandoRespostaDesde: string | null;
  reativarEm: string | null;
  ultimaMensagemTexto: string | null;
  ultimaMensagemTipo: string | null;
  ultimaMensagemFromMe: boolean | null;
  criadoEm: string;
  atualizadoEm: string;
  encerradoEm: string | null;
}

export const MOTIVOS_ENCERRAMENTO_LABELS: Record<MotivoEncerramento, string> = {
  ACORDO_FECHADO: 'Acordo fechado',
  PAGO_AVISTA: 'Pago à vista',
  SEM_RETORNO: 'Sem retorno',
  RECUSOU: 'Recusou negociar',
  NAO_E_DEVEDOR: 'Não é devedor',
  TRANSFERIDO_JURIDICO: 'Transferido ao jurídico',
  OUTRO: 'Outro',
};

// --- Chat da 3C Plus ---
export interface Chat3CPlus {
  id: number | string;
  contatoNome: string;
  contatoNumero: string;
  contatoImagem?: string;
  instanciaId: string;
  instanciaNome: string;
  instanciaTipo: 'whatsapp-3c' | 'waba';
  agenteId: number | null;
  agenteNome: string | null;
  ultimaMensagem: string;
  ultimaMensagemTipo: TipoMensagem;
  ultimaMensagemData: number; // unix timestamp
  naoLidos: number;
  finalizado: boolean;
  emSnooze: boolean;
  transferido: boolean;
  pessoaCodigo?: number; // vinculacao com aluno SEI
}

// --- Mensagem ---
export type TipoMensagem =
  | 'chat'
  | 'audio'
  | 'voice'
  | 'image'
  | 'document'
  | 'video'
  | 'internal-message'
  | 'protocol-message'
  | 'transfer'
  | 'qualification-message'
  | 'snooze-message'
  | 'template';

export interface Mensagem3CPlus {
  id: string;
  chatId: number | string;
  tipo: TipoMensagem;
  corpo: string;
  mediaUrl: string | null;
  mediaNome: string | null;
  fromMe: boolean;
  agenteId: number | null;
  agenteNome: string | null;
  timestamp: number; // unix seconds
  ack: string | null; // null, 'device', 'read'
  mensagemCitada?: {
    corpo: string | null;
    id: string | null;
  };
  interno: boolean;
  deletado: boolean;
}

// --- Estado ---
export type TabConversa = 'meus' | 'fila' | 'todos' | 'finalizados';

// --- Labels ---
export function previewMensagem(tipo: TipoMensagem, corpo: string): string {
  switch (tipo) {
    case 'audio':
    case 'voice':
      return '\u{1F3A4} Áudio';
    case 'image':
      return '\u{1F4F7} Imagem';
    case 'video':
      return '\u{1F3AC} Vídeo';
    case 'document':
      return '\u{1F4CE} Documento';
    case 'internal-message':
      return '\u{1F512} ' + (corpo || 'Nota interna');
    case 'protocol-message':
      return corpo || 'Protocolo';
    case 'transfer':
      return 'Transferido';
    case 'qualification-message':
      return 'Qualificado';
    case 'snooze-message':
      return 'Adiado';
    case 'template':
      return 'Template';
    default:
      return corpo || '';
  }
}

export function formatarTimestampChat(ts: number): string {
  const d = new Date(ts * 1000);
  const agora = new Date();
  const diff = agora.getTime() - d.getTime();
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (dias === 0) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  if (dias === 1) return 'Ontem';
  if (dias < 7) {
    return d.toLocaleDateString('pt-BR', { weekday: 'short' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function agruparMensagensPorDia(mensagens: Mensagem3CPlus[]): Map<string, Mensagem3CPlus[]> {
  const grupos = new Map<string, Mensagem3CPlus[]>();
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);

  for (const msg of mensagens) {
    const d = new Date(msg.timestamp * 1000);
    let label: string;

    if (d.toDateString() === hoje.toDateString()) {
      label = 'HOJE';
    } else if (d.toDateString() === ontem.toDateString()) {
      label = 'ONTEM';
    } else {
      label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    if (!grupos.has(label)) {
      grupos.set(label, []);
    }
    grupos.get(label)!.push(msg);
  }

  return grupos;
}
