export type TipoOcorrencia =
  // Negociação
  | 'NEGOCIACAO_CRIADA'
  | 'NEGOCIACAO_TERMO_ENVIADO'
  | 'NEGOCIACAO_TERMO_ASSINADO'
  | 'NEGOCIACAO_COBRANCA_CRIADA'
  | 'NEGOCIACAO_SEI_VINCULADO'
  | 'NEGOCIACAO_PAGAMENTO_CONFIRMADO'
  | 'NEGOCIACAO_CONCLUIDA'
  | 'NEGOCIACAO_CANCELADA'
  // Comunicação
  | 'LIGACAO_EFETUADA'
  | 'LIGACAO_RECEBIDA'
  | 'LIGACAO_NAO_ATENDIDA'
  | 'LIGACAO_ABANDONADA'
  | 'WHATSAPP_ENVIADO'
  | 'WHATSAPP_RECEBIDO'
  // Mailing / Disparos
  | 'DISPARO_INCLUIDO'
  | 'DISPARO_REMOVIDO'
  // Serasa
  | 'SERASA_NEGATIVADO'
  | 'SERASA_BAIXADO'
  // Cadastro
  | 'CONTATO_ATUALIZADO'
  | 'OBSERVACAO_ADICIONADA';

export type OrigemOcorrencia =
  | 'SISTEMA'
  | 'AGENTE'
  | 'WEBHOOK_ASAAS'
  | 'WEBHOOK_CLICKSIGN'
  | 'SOCKET_3CPLUS'
  | 'SYNC_SEI';

export interface Ocorrencia {
  id: string;
  tipo: TipoOcorrencia;
  pessoaCodigo: number;
  pessoaNome: string;
  agenteCodigo: string;
  agenteNome: string;
  descricao: string;
  metadados?: Record<string, unknown>;
  origem: OrigemOcorrencia;
  criadoEm: string;
}

// Labels para exibição
export const tipoOcorrenciaLabel: Record<TipoOcorrencia, string> = {
  NEGOCIACAO_CRIADA: 'Negociação criada',
  NEGOCIACAO_TERMO_ENVIADO: 'Termo enviado para assinatura',
  NEGOCIACAO_TERMO_ASSINADO: 'Termo assinado pelo aluno',
  NEGOCIACAO_COBRANCA_CRIADA: 'Cobrança criada no Asaas',
  NEGOCIACAO_SEI_VINCULADO: 'Negociação vinculada ao SEI',
  NEGOCIACAO_PAGAMENTO_CONFIRMADO: 'Pagamento confirmado',
  NEGOCIACAO_CONCLUIDA: 'Negociação concluída',
  NEGOCIACAO_CANCELADA: 'Negociação cancelada',
  LIGACAO_EFETUADA: 'Ligação efetuada',
  LIGACAO_RECEBIDA: 'Ligação recebida',
  LIGACAO_NAO_ATENDIDA: 'Ligação não atendida',
  LIGACAO_ABANDONADA: 'Ligação abandonada',
  WHATSAPP_ENVIADO: 'WhatsApp enviado',
  WHATSAPP_RECEBIDO: 'WhatsApp recebido',
  DISPARO_INCLUIDO: 'Incluído em lista de disparo',
  DISPARO_REMOVIDO: 'Removido de lista de disparo',
  SERASA_NEGATIVADO: 'Negativado no Serasa',
  SERASA_BAIXADO: 'Baixa no Serasa',
  CONTATO_ATUALIZADO: 'Contato atualizado',
  OBSERVACAO_ADICIONADA: 'Observação adicionada',
};

export const origemLabel: Record<OrigemOcorrencia, string> = {
  SISTEMA: 'Sistema',
  AGENTE: 'Agente',
  WEBHOOK_ASAAS: 'Asaas',
  WEBHOOK_CLICKSIGN: 'ClickSign',
  SOCKET_3CPLUS: '3C Plus',
  SYNC_SEI: 'Sync SEI',
};

// Ícone e cor por categoria
export function categoriaOcorrencia(tipo: TipoOcorrencia): { cor: string; icone: string } {
  if (tipo.startsWith('NEGOCIACAO_')) return { cor: 'amber', icone: 'Handshake' };
  if (tipo.startsWith('LIGACAO_')) return { cor: 'sky', icone: 'Phone' };
  if (tipo.startsWith('WHATSAPP_')) return { cor: 'emerald', icone: 'MessageSquare' };
  if (tipo.startsWith('DISPARO_')) return { cor: 'violet', icone: 'Megaphone' };
  if (tipo.startsWith('SERASA_')) return { cor: 'red', icone: 'AlertTriangle' };
  return { cor: 'stone', icone: 'FileText' };
}
