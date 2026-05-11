import { Phone, Smartphone, MessageCircle, AlertCircle, Sparkles } from 'lucide-react';
import type { AcordoEnriquecido, AgingCategoria, CanalPrecedente } from '../../services/acordos';
import { etapaCor, etapaLabel, formaPagamentoLabel } from '../../types/acordo';

function fmtBRL(v: number | string | undefined | null) {
  const n = Number(v) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function relativo(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = diff / (1000 * 60);
  const h = min / 60;
  const dias = h / 24;
  if (dias >= 1) return `${Math.floor(dias)}d`;
  if (h >= 1) return `${Math.floor(h)}h`;
  if (min >= 1) return `${Math.floor(min)}m`;
  return 'agora';
}

const AGING_BADGE: Record<AgingCategoria, { bg: string; text: string; label: string }> = {
  baixa: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Baixa' },
  media: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Média' },
  alta: { bg: 'bg-red-50', text: 'text-red-700', label: 'Alta' },
};

const CANAL_ICON: Record<CanalPrecedente, { icon: typeof Phone; label: string; cor: string }> = {
  ligacao: { icon: Phone, label: 'Ligação', cor: 'text-blue-600' },
  waba: { icon: MessageCircle, label: 'WABA', cor: 'text-green-600' },
  '3cplus': { icon: Smartphone, label: '3C+', cor: 'text-violet-600' },
  sem_contato: { icon: AlertCircle, label: 'Sem contato', cor: 'text-gray-400' },
  ficou_facil: { icon: Sparkles, label: 'Ficou Fácil', cor: 'text-pink-600' },
};

function formaResumo(a: AcordoEnriquecido): string {
  if (a._tipo === 'ficou_facil') return 'Ficou Fácil';
  const pag = a.pagamentos?.[0];
  if (!pag) return '—';
  const forma = formaPagamentoLabel[pag.formaPagamento] || pag.formaPagamento;
  if (pag.parcelas > 1) return `${forma.replace('Cartão de Crédito', 'Cartão')} ${pag.parcelas}x`;
  return forma.replace('Cartão de Crédito', 'Cartão à vista');
}

interface Props {
  acordos: AcordoEnriquecido[];
  loading: boolean;
  onClickAcordo: (a: AcordoEnriquecido) => void;
}

export default function TabelaNegociacoes({ acordos, loading, onClickAcordo }: Props) {
  if (loading && acordos.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-on-surface-variant text-[0.8125rem]">
        Carregando...
      </div>
    );
  }
  if (acordos.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-on-surface-variant text-[0.8125rem]">
        Nenhuma negociação encontrada com os filtros aplicados.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <table className="w-full text-[0.75rem]">
        <thead className="bg-gray-50 text-on-surface-variant border-b border-gray-100">
          <tr>
            <th className="text-left py-2.5 px-4 font-semibold">Aluno</th>
            <th className="text-left py-2.5 px-2 font-semibold w-36">Etapa</th>
            <th className="text-left py-2.5 px-2 font-semibold w-20">Aging</th>
            <th className="text-right py-2.5 px-2 font-semibold w-24">Valor</th>
            <th className="text-left py-2.5 px-2 font-semibold w-28">Forma</th>
            <th className="text-left py-2.5 px-2 font-semibold w-32">Pago</th>
            <th className="text-center py-2.5 px-2 font-semibold w-12">Canal</th>
            <th className="text-left py-2.5 px-2 font-semibold w-28">Agente</th>
            <th className="text-right py-2.5 px-2 font-semibold w-16">Criado</th>
            <th className="text-right py-2.5 px-4 font-semibold w-16">Concl.</th>
          </tr>
        </thead>
        <tbody>
          {acordos.map((a) => {
            const cor = etapaCor[a.etapa] || etapaCor.SELECAO;
            const agingBadge = AGING_BADGE[a._agingCategoria] || AGING_BADGE.baixa;
            const canalIcon = CANAL_ICON[a._canalPrecedente] || CANAL_ICON.sem_contato;
            const Icon = canalIcon.icon;
            const pct = Math.min(100, Math.max(0, a._percentualPago));
            return (
              <tr
                key={a.id}
                onClick={() => onClickAcordo(a)}
                className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="py-2 px-4">
                  <div className="font-semibold text-on-surface truncate max-w-[260px]" title={a.pessoaNome}>
                    {a.pessoaNome}
                  </div>
                  <div className="text-[0.625rem] text-on-surface-variant truncate max-w-[260px]">
                    {a.pessoaCpf} {a.matricula ? `• ${a.matricula}` : ''} {a.turmaIdentificador ? `• ${a.turmaIdentificador}` : ''}
                  </div>
                </td>
                <td className="py-2 px-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[0.6875rem] font-medium ${cor.badge}`}>
                    {etapaLabel[a.etapa] || a.etapa}
                  </span>
                </td>
                <td className="py-2 px-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[0.625rem] font-medium ${agingBadge.bg} ${agingBadge.text}`}>
                    {agingBadge.label}
                  </span>
                </td>
                <td className="py-2 px-2 text-right">
                  <div className="font-bold text-on-surface">{fmtBRL(a.valorAcordo)}</div>
                  {a.descontoAcordo > 0 && a.valorSaldoDevedor > 0 && (
                    <div className="text-[0.5625rem] text-emerald-600">
                      -{Math.round((Number(a.descontoAcordo) / Number(a.valorSaldoDevedor)) * 100)}%
                    </div>
                  )}
                </td>
                <td className="py-2 px-2 text-on-surface-variant">{formaResumo(a)}</td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 99 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[0.625rem] text-on-surface-variant w-9 text-right">{Math.round(pct)}%</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-center" title={canalIcon.label}>
                  <Icon size={13} className={`inline ${canalIcon.cor}`} />
                </td>
                <td className="py-2 px-2 text-on-surface-variant truncate max-w-[120px]" title={a.criadoPorNome}>
                  {a.criadoPorNome?.split(' ')[0] || '—'}
                </td>
                <td className="py-2 px-2 text-right text-on-surface-variant" title={a.criadoEm}>
                  {relativo(a.criadoEm)}
                </td>
                <td className="py-2 px-4 text-right text-on-surface-variant">
                  {a._diasAteConcluir != null ? `${Math.round(a._diasAteConcluir)}d` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
