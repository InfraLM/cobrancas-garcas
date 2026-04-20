import { useState, useEffect } from 'react';
import type { AcordoFinanceiro } from '../../types/acordo';
import { etapaLabel, formaPagamentoLabel } from '../../types/acordo';
import StatusBadge from '../ui/StatusBadge';
import { listarPorAluno, baixarDocumentoAssinado } from '../../services/acordos';
import { FileDown, FileSignature, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

function formatarMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataHora(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusAcordo(acordo: AcordoFinanceiro): { texto: string; variante: 'success' | 'warning' | 'danger' | 'blue' | 'default' } {
  if (acordo.etapa === 'CANCELADO') return { texto: 'Cancelado', variante: 'danger' };
  if (acordo.etapa === 'INADIMPLENTE') return { texto: 'Descumprido', variante: 'danger' };
  if (acordo.etapa === 'CONCLUIDO') return { texto: 'Cumprido', variante: 'success' };
  if (acordo.etapa === 'SELECAO') return { texto: 'Pendente', variante: 'default' };
  if (acordo.etapa === 'TERMO_ENVIADO' && !acordo.termoAssinadoEm) return { texto: 'Aguardando assinatura', variante: 'warning' };
  if (acordo.termoAssinadoEm) return { texto: 'Assinado', variante: 'blue' };
  return { texto: etapaLabel[acordo.etapa], variante: 'default' };
}

export default function AlunoTabRepositorio({ codigo }: { codigo: number }) {
  const [acordos, setAcordos] = useState<AcordoFinanceiro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await listarPorAluno(codigo);
        setAcordos(data);
      } catch {
        setAcordos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [codigo]);

  async function handleBaixar(acordo: AcordoFinanceiro) {
    try {
      await baixarDocumentoAssinado(acordo.id, acordo.pessoaNome);
    } catch {
      alert('Documento nao disponivel para download');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-on-surface-variant/40" />
      </div>
    );
  }

  if (acordos.length === 0) {
    return (
      <div className="text-center py-12 text-[0.8125rem] text-on-surface-variant">
        Nenhuma negociação registrada para este aluno.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium">
        {acordos.length} negociação{acordos.length !== 1 ? 'ões' : ''} registrada{acordos.length !== 1 ? 's' : ''}
      </p>

      {acordos.map((acordo) => {
        const status = statusAcordo(acordo);
        return (
          <div key={acordo.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50">
              <div className="flex items-center gap-3">
                <StatusBadge texto={status.texto} variante={status.variante} comDot />
                <span className="text-[0.8125rem] font-bold text-on-surface">{formatarMoeda(Number(acordo.valorAcordo))}</span>
                {Number(acordo.descontoAcordo) > 0 && (
                  <span className="text-[0.6875rem] text-emerald-600">-{Number(acordo.descontoAcordoPercentual || 0).toFixed(1)}%</span>
                )}
              </div>
              <button onClick={() => handleBaixar(acordo)} title="Baixar documento"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.75rem] font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors">
                <FileDown size={13} />
                PDF
              </button>
            </div>

            {/* Detalhes */}
            <div className="px-4 py-3 space-y-2 text-[0.8125rem]">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Agente</span>
                <span className="font-medium">{acordo.criadoPorNome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Parcelas</span>
                <span className="font-medium">{acordo.pagamentos?.length || 0}</span>
              </div>
              {acordo.pagamentos?.map((pg, idx) => (
                <div key={pg.id} className="flex justify-between text-[0.75rem] text-on-surface-variant pl-3">
                  <span>Pgto {idx + 1}: {formaPagamentoLabel[pg.formaPagamento as keyof typeof formaPagamentoLabel] || pg.formaPagamento}</span>
                  <span>{formatarMoeda(Number(pg.valor))}</span>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-50">
              <div className="space-y-1.5">
                {acordo.criadoEm && (
                  <div className="flex items-center gap-2 text-[0.75rem]">
                    <Clock size={11} className="text-sky-400 shrink-0" />
                    <span className="text-on-surface-variant">Criado {formatarDataHora(acordo.criadoEm)}</span>
                  </div>
                )}
                {acordo.termoEnviadoEm && (
                  <div className="flex items-center gap-2 text-[0.75rem]">
                    <FileSignature size={11} className="text-violet-400 shrink-0" />
                    <span className="text-on-surface-variant">Termo enviado {formatarDataHora(acordo.termoEnviadoEm)}</span>
                  </div>
                )}
                {acordo.termoAssinadoEm && (
                  <div className="flex items-center gap-2 text-[0.75rem]">
                    <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                    <span className="text-on-surface-variant">Assinado {formatarDataHora(acordo.termoAssinadoEm)}</span>
                  </div>
                )}
                {acordo.canceladoEm && (
                  <div className="flex items-center gap-2 text-[0.75rem]">
                    <XCircle size={11} className="text-red-400 shrink-0" />
                    <span className="text-on-surface-variant">Cancelado {formatarDataHora(acordo.canceladoEm)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
