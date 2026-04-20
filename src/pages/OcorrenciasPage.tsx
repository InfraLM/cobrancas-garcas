import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import SearchInput from '../components/ui/SearchInput';
import StatusBadge from '../components/ui/StatusBadge';
import { getAvatarColor, getIniciais } from '../utils/avatarColor';
import {
  Clock, Loader2, ChevronLeft, ChevronRight, Phone, PhoneOff,
  MessageSquare, MessageCircle, FileText, AlertTriangle, CheckCircle2,
  CreditCard, Link2, Handshake, RefreshCw, Shield, Headphones, Stethoscope,
  Send, XCircle, Eye
} from 'lucide-react';

interface Ocorrencia {
  id: string;
  tipo: string;
  descricao: string;
  origem: string;
  pessoaCodigo: number;
  pessoaNome: string | null;
  agenteCodigo: string | null;
  agenteNome: string | null;
  criadoEm: string;
}

const TIPO_CONFIG: Record<string, { label: string; icone: typeof Clock; cor: string; variante: 'success' | 'warning' | 'danger' | 'blue' | 'default' }> = {
  LIGACAO_EFETUADA: { label: 'Ligação efetuada', icone: Phone, cor: 'text-blue-500', variante: 'blue' },
  LIGACAO_RECEBIDA: { label: 'Ligação recebida', icone: Phone, cor: 'text-green-500', variante: 'success' },
  LIGACAO_NAO_ATENDIDA: { label: 'Ligação não atendida', icone: PhoneOff, cor: 'text-red-500', variante: 'danger' },
  LIGACAO_ABANDONADA: { label: 'Ligação abandonada', icone: PhoneOff, cor: 'text-amber-500', variante: 'warning' },
  WHATSAPP_ENVIADO: { label: 'WhatsApp enviado', icone: Send, cor: 'text-blue-500', variante: 'blue' },
  WHATSAPP_RECEBIDO: { label: 'WhatsApp recebido', icone: MessageCircle, cor: 'text-emerald-500', variante: 'success' },
  NEGOCIACAO_CRIADA: { label: 'Negociação criada', icone: Handshake, cor: 'text-sky-500', variante: 'blue' },
  NEGOCIACAO_TERMO_ENVIADO: { label: 'Termo enviado', icone: FileText, cor: 'text-violet-500', variante: 'neutral' },
  NEGOCIACAO_TERMO_ASSINADO: { label: 'Termo assinado', icone: CheckCircle2, cor: 'text-emerald-500', variante: 'success' },
  NEGOCIACAO_COBRANCA_CRIADA: { label: 'Cobrança gerada', icone: CreditCard, cor: 'text-amber-500', variante: 'warning' },
  NEGOCIACAO_SEI_VINCULADO: { label: 'SEI vinculado', icone: Link2, cor: 'text-indigo-500', variante: 'blue' },
  NEGOCIACAO_PAGAMENTO_CONFIRMADO: { label: 'Pagamento confirmado', icone: CheckCircle2, cor: 'text-emerald-500', variante: 'success' },
  NEGOCIACAO_CONCLUIDA: { label: 'Negociação concluída', icone: Handshake, cor: 'text-emerald-600', variante: 'success' },
  NEGOCIACAO_CANCELADA: { label: 'Negociação cancelada', icone: XCircle, cor: 'text-red-500', variante: 'danger' },
  CONVERSAO_RECORRENCIA: { label: 'Conversão recorrência', icone: RefreshCw, cor: 'text-emerald-500', variante: 'success' },
  RECORRENCIA_ATIVADA: { label: 'Recorrência ativada', icone: RefreshCw, cor: 'text-emerald-500', variante: 'success' },
  RECORRENCIA_DESATIVADA: { label: 'Recorrência desativada', icone: RefreshCw, cor: 'text-red-500', variante: 'danger' },
  SERASA_NEGATIVADO: { label: 'Serasa negativado', icone: AlertTriangle, cor: 'text-red-500', variante: 'danger' },
  SERASA_BAIXADO: { label: 'Serasa baixado', icone: Shield, cor: 'text-emerald-500', variante: 'success' },
  DISPARO_INCLUIDO: { label: 'Incluído em campanha', icone: Send, cor: 'text-blue-400', variante: 'blue' },
  CONTATO_ATUALIZADO: { label: 'Contato atualizado', icone: Eye, cor: 'text-gray-500', variante: 'neutral' },
  OBSERVACAO_ADICIONADA: { label: 'Observação', icone: MessageSquare, cor: 'text-gray-500', variante: 'neutral' },
};

const ORIGEM_LABEL: Record<string, string> = {
  SISTEMA: 'Sistema',
  AGENTE: 'Agente',
  WEBHOOK_ASAAS: 'Asaas',
  WEBHOOK_CLICKSIGN: 'ClickSign',
  SOCKET_3CPLUS: '3C Plus',
  SYNC_SEI: 'SEI Sync',
};

function formatarDataHora(d: string) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function OcorrenciasPage() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [metricas, setMetricas] = useState({ total: 0, hoje: 0, semana: 0 });
  const [tiposDisponiveis, setTiposDisponiveis] = useState<{ tipo: string; count: number }[]>([]);
  const limit = 30;

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (busca) params.set('search', busca);
      if (filtroTipo) params.set('tipo', filtroTipo);
      params.set('page', String(page));
      params.set('limit', String(limit));
      const qs = params.toString();

      const res = await api.get<{ data: Ocorrencia[]; total: number }>(`/ocorrencias?${qs}`);
      setOcorrencias(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error('Erro ao carregar ocorrencias:', err);
    } finally {
      setLoading(false);
    }
  }, [busca, filtroTipo, page]);

  useEffect(() => {
    const timer = setTimeout(carregar, 400);
    return () => clearTimeout(timer);
  }, [carregar]);

  useEffect(() => {
    api.get<{ total: number; hoje: number; semana: number }>('/ocorrencias/metricas').then(setMetricas).catch(() => {});
    api.get<{ tipo: string; count: number }[]>('/ocorrencias/tipos').then(setTiposDisponiveis).catch(() => {});
  }, []);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-on-surface">
          <Clock size={20} />
          <h1 className="text-lg font-bold">Ocorrências</h1>
        </div>

        <div className="w-72 ml-4">
          <SearchInput valor={busca} onChange={(v) => { setBusca(v); setPage(1); }} placeholder="Buscar por nome ou descrição..." />
        </div>

        <select value={filtroTipo} onChange={(e) => { setFiltroTipo(e.target.value); setPage(1); }}
          className="h-10 px-4 rounded-xl bg-white/70 text-[0.8125rem] text-on-surface outline-none focus:bg-white focus:shadow-sm transition-all appearance-none cursor-pointer">
          <option value="">Todos os tipos</option>
          {tiposDisponiveis.map(t => {
            const cfg = TIPO_CONFIG[t.tipo];
            return <option key={t.tipo} value={t.tipo}>{cfg?.label || t.tipo} ({t.count})</option>;
          })}
        </select>

        <div className="ml-auto flex items-center gap-4 text-[0.8125rem] text-on-surface-variant">
          {loading && <Loader2 size={14} className="animate-spin" />}
          <span>{metricas.hoje} hoje</span>
          <span className="text-on-surface-variant/20">·</span>
          <span>{metricas.semana} esta semana</span>
          <span className="text-on-surface-variant/20">·</span>
          <span className="font-medium text-on-surface">{total} total</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl shadow-sm shadow-black/[0.03] overflow-hidden">
        {ocorrencias.map((oc) => {
          const cfg = TIPO_CONFIG[oc.tipo] || { label: oc.tipo, icone: Clock, cor: 'text-gray-400', variante: 'neutral' };
          const variante = (cfg.variante || 'neutral') as 'success' | 'warning' | 'danger' | 'blue' | 'neutral';
          const Icone = cfg.icone;
          const cor = getAvatarColor(oc.pessoaNome || '');

          return (
            <div key={oc.id} className="flex items-start gap-4 px-5 py-4 border-b border-gray-50 hover:bg-surface-container-low/30 transition-colors">
              {/* Icone do tipo */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.cor} bg-opacity-10`}
                style={{ backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}>
                <Icone size={15} className={cfg.cor} />
              </div>

              {/* Conteudo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <StatusBadge texto={cfg.label} variante={variante} />
                  <span className="text-[0.6875rem] text-on-surface-variant/50">
                    {ORIGEM_LABEL[oc.origem] || oc.origem}
                  </span>
                </div>
                <p className="text-[0.8125rem] text-on-surface mt-1">{oc.descricao}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[0.75rem] text-on-surface-variant">
                  <span>{formatarDataHora(oc.criadoEm)}</span>
                  {oc.agenteNome && (
                    <>
                      <span className="text-on-surface-variant/20">·</span>
                      <span>Agente: {oc.agenteNome}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Aluno */}
              {oc.pessoaNome && (
                <button onClick={() => navigate(`/alunos?codigo=${oc.pessoaCodigo}`)}
                  className="flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-lg hover:bg-surface-container-high transition-colors">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center text-[0.5rem] font-bold"
                    style={{ backgroundColor: cor.bg, color: cor.text }}>
                    {getIniciais(oc.pessoaNome)}
                  </div>
                  <span className="text-[0.75rem] font-medium text-on-surface max-w-[120px] truncate">{oc.pessoaNome}</span>
                </button>
              )}
            </div>
          );
        })}

        {ocorrencias.length === 0 && !loading && (
          <div className="px-5 py-16 text-center text-[0.8125rem] text-on-surface-variant">
            {busca || filtroTipo ? 'Nenhuma ocorrência encontrada com os filtros aplicados' : 'Nenhuma ocorrência registrada ainda'}
          </div>
        )}
      </div>

      {/* Paginacao */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[0.8125rem] text-on-surface-variant">{page} de {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
