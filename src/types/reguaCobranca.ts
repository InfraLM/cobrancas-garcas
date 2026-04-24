import type { TemplateBlip } from './templateBlip';
import type { RegraSegmentacao, TipoSegmentacao } from './segmentacao';

export interface EtapaRegua {
  id: string;
  reguaId: string;
  nome: string;
  ordem: number;
  diasRelativoVenc: number; // negativo = antes, positivo = depois
  horario: string | null;
  templateBlipId: string;
  segmentacaoId: string;
  filtroRecorrencia: string;
  filtroSituacao: string;
  tiposOrigem: string[];
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;

  // Populado pelo GET /:id
  template?: Pick<TemplateBlip, 'id' | 'nomeBlip' | 'titulo' | 'escopo' | 'categoria' | 'variaveis' | 'conteudoPreview'>;
  segmentacao?: Pick<RegraSegmentacao, 'id' | 'nome' | 'tipo' | 'escopoUso' | 'condicoes' | 'reguaOwnerId'>;
}

export interface ReguaCobranca {
  id: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  horarioPadrao: string; // HH:MM
  intervaloDisparoSeg: number;
  criadoPor: number;
  criadoPorNome?: string | null;
  criadoEm: string;
  atualizadoEm: string;
  ultimaExecucao?: string | null;
  etapas: EtapaRegua[];
  totalEtapas?: number;
  etapasAtivas?: number;
  metricas30d?: {
    total_30d: number;
    enviados_30d: number;
    falhas_30d: number;
    convertidos_30d: number;
  };
}

export interface MetricaEtapa {
  etapa_id: string;
  total_30d: number;
  enviados_30d: number;
  falhas_30d: number;
  pendentes_30d: number;
  convertidos_30d: number;
}

export interface SimulacaoEtapa {
  total: number;
  alunosUnicos: number;
  valorTotal: number;
  totalComTelefone: number;
  amostra: {
    codigo: number;
    nome: string;
    tituloValor: number;
    tituloVencimento: string;
    diasAteVenc: number;
  }[];
}

// Para expor no frontend
export type { TipoSegmentacao };
