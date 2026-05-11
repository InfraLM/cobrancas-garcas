import { useState, useEffect } from 'react';
import { Search, X, ChevronDown, Filter } from 'lucide-react';
import { listarAgentesAcordos, type AgenteAcordo, type ListarAcordosParams } from '../../services/acordos';

// Quick filters pre-definidos
export interface QuickFilter {
  id: string;
  label: string;
  filtros: Partial<ListarAcordosParams>;
}

// hoje BRT
const hojeBrtISO = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
const semanaPassadaISO = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const QUICK_FILTERS: QuickFilter[] = [
  { id: 'todos', label: 'Todos', filtros: {} },
  { id: 'hoje', label: 'Hoje', filtros: { inicio: hojeBrtISO(), fim: hojeBrtISO() } },
  { id: 'semana', label: 'Últimos 7d', filtros: { inicio: semanaPassadaISO(), fim: hojeBrtISO() } },
  { id: 'abertos', label: 'Abertos', filtros: { etapa: 'SELECAO,TERMO_ENVIADO,ACORDO_GERADO,CHECANDO_PAGAMENTO' } },
  { id: 'concluidos', label: 'Concluídos', filtros: { etapa: 'CONCLUIDO' } },
  { id: 'cancelados', label: 'Cancelados', filtros: { etapa: 'CANCELADO' } },
  { id: 'termo-pendente', label: 'Termo pendente', filtros: { etapa: 'TERMO_ENVIADO', temTermoAssinado: 'false' } },
];

export const ETAPAS_OPTS = [
  { value: 'SELECAO', label: 'Seleção' },
  { value: 'TERMO_ENVIADO', label: 'Termo enviado' },
  { value: 'ACORDO_GERADO', label: 'Cobrança criada' },
  { value: 'SEI_VINCULADO', label: 'Vínculo SEI' },
  { value: 'CHECANDO_PAGAMENTO', label: 'Checando pagamento' },
  { value: 'CONCLUIDO', label: 'Concluído' },
  { value: 'CANCELADO', label: 'Cancelado' },
];

export const FORMAS_OPTS = [
  { value: 'PIX', label: 'PIX' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CREDIT_CARD', label: 'Cartão' },
];

export const AGING_OPTS = [
  { value: 'baixa', label: 'Baixa (0-60d)' },
  { value: 'media', label: 'Média (61-150d)' },
  { value: 'alta', label: 'Alta (150+d)' },
];

export const CANAL_OPTS = [
  { value: 'ligacao', label: '📞 Ligação' },
  { value: 'waba', label: '📱 WABA' },
  { value: '3cplus', label: '💬 3C+' },
  { value: 'sem_contato', label: '🚫 Sem contato' },
];

interface Props {
  filtros: ListarAcordosParams;
  setFiltros: (f: ListarAcordosParams) => void;
  quickAtivo: string;
  setQuickAtivo: (id: string) => void;
}

function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selecionados = value ? value.split(',') : [];
  const toggle = (v: string) => {
    const novos = selecionados.includes(v) ? selecionados.filter(s => s !== v) : [...selecionados, v];
    onChange(novos.join(','));
  };
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`h-8 px-3 rounded-lg border text-[0.75rem] flex items-center gap-1.5 transition-colors ${
          selecionados.length ? 'border-primary/40 bg-primary/5 text-primary font-semibold' : 'border-gray-200 bg-white text-on-surface-variant hover:border-gray-300'
        }`}
      >
        {label}
        {selecionados.length > 0 && <span className="bg-primary/15 px-1.5 rounded text-[0.625rem]">{selecionados.length}</span>}
        <ChevronDown size={12} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-9 left-0 z-20 bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-[180px]">
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className="w-full text-left px-3 py-1.5 text-[0.75rem] hover:bg-gray-50 flex items-center gap-2"
              >
                <input type="checkbox" checked={selecionados.includes(opt.value)} readOnly className="rounded" />
                {opt.label}
              </button>
            ))}
            {selecionados.length > 0 && (
              <button
                onClick={() => onChange('')}
                className="w-full text-left px-3 py-1.5 text-[0.6875rem] text-on-surface-variant hover:bg-gray-50 border-t border-gray-100 mt-1"
              >
                Limpar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function FiltrosNegociacoes({ filtros, setFiltros, quickAtivo, setQuickAtivo }: Props) {
  const [agentes, setAgentes] = useState<AgenteAcordo[]>([]);
  const [busca, setBusca] = useState(filtros.search || '');

  useEffect(() => {
    listarAgentesAcordos().then(r => setAgentes(r.agentes)).catch(() => {});
  }, []);

  // debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (busca !== filtros.search) setFiltros({ ...filtros, search: busca || undefined, page: 1 });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const update = (patch: Partial<ListarAcordosParams>) => {
    setFiltros({ ...filtros, ...patch, page: 1 });
    setQuickAtivo('');
  };

  const aplicarQuick = (qf: QuickFilter) => {
    setQuickAtivo(qf.id);
    setBusca('');
    setFiltros({ ...qf.filtros, page: 1, limit: filtros.limit, incluirFicouFacil: filtros.incluirFicouFacil });
  };

  const limparTodos = () => {
    setQuickAtivo('');
    setBusca('');
    setFiltros({ page: 1, limit: filtros.limit });
  };

  const temFiltro = Boolean(
    filtros.search || filtros.etapa || filtros.criadoPor || filtros.formaPagamento ||
    filtros.inicio || filtros.fim || filtros.aging || filtros.canalPrecedente ||
    filtros.temDesconto || filtros.temTermoAssinado || filtros.valorMin || filtros.valorMax ||
    filtros.pctPagoMin || filtros.pctPagoMax
  );

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      {/* Quick filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {QUICK_FILTERS.map(qf => (
          <button
            key={qf.id}
            onClick={() => aplicarQuick(qf)}
            className={`h-7 px-2.5 rounded-full text-[0.6875rem] font-medium transition-colors ${
              quickAtivo === qf.id ? 'bg-primary text-white' : 'bg-gray-100 text-on-surface-variant hover:bg-gray-200'
            }`}
          >
            {qf.label}
          </button>
        ))}
        <div className="flex-1" />
        {temFiltro && (
          <button onClick={limparTodos} className="h-7 px-2.5 rounded-full bg-red-50 text-red-600 text-[0.6875rem] font-medium hover:bg-red-100 flex items-center gap-1">
            <X size={12} /> Limpar filtros
          </button>
        )}
      </div>

      {/* Linha 1: busca + período */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou CPF..."
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-gray-200 text-[0.75rem] outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <input
          type="date"
          value={filtros.inicio || ''}
          onChange={(e) => update({ inicio: e.target.value || undefined })}
          className="h-8 px-2 rounded-lg border border-gray-200 text-[0.75rem]"
          title="Criado a partir de"
        />
        <span className="text-gray-400 text-[0.625rem]">→</span>
        <input
          type="date"
          value={filtros.fim || ''}
          onChange={(e) => update({ fim: e.target.value || undefined })}
          className="h-8 px-2 rounded-lg border border-gray-200 text-[0.75rem]"
          title="Criado até"
        />
      </div>

      {/* Linha 2: multi-selects */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={12} className="text-gray-400" />
        <MultiSelect label="Etapa" options={ETAPAS_OPTS} value={filtros.etapa || ''} onChange={(v) => update({ etapa: v || undefined })} />
        <MultiSelect
          label="Agente"
          options={agentes.map(a => ({ value: String(a.id), label: `${a.nome} (${a.total})` }))}
          value={filtros.criadoPor || ''}
          onChange={(v) => update({ criadoPor: v || undefined })}
        />
        <MultiSelect label="Forma" options={FORMAS_OPTS} value={filtros.formaPagamento || ''} onChange={(v) => update({ formaPagamento: v || undefined })} />
        <MultiSelect label="Aging" options={AGING_OPTS} value={filtros.aging || ''} onChange={(v) => update({ aging: v || undefined })} />
        <MultiSelect label="Canal" options={CANAL_OPTS} value={filtros.canalPrecedente || ''} onChange={(v) => update({ canalPrecedente: v || undefined })} />

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-[0.6875rem] text-on-surface-variant flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={filtros.incluirFicouFacil === 'true'}
              onChange={(e) => update({ incluirFicouFacil: e.target.checked ? 'true' : undefined })}
              className="rounded"
            />
            Incluir Ficou Fácil
          </label>
          <label className="text-[0.6875rem] text-on-surface-variant flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={filtros.temTermoAssinado === 'true'}
              onChange={(e) => update({ temTermoAssinado: e.target.checked ? 'true' : undefined })}
              className="rounded"
            />
            Só termo assinado
          </label>
        </div>
      </div>
    </div>
  );
}
