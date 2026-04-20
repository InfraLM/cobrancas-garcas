import { useState, useEffect } from 'react';
import type { Aluno, ResumoFinanceiro, Parcela, SerasaRegistro } from '../../types/aluno';
import { tipoOrigemLabel } from '../../types/aluno';
import DataCard from '../ui/DataCard';
import StatusBadge, { varianteSituacaoParcela, labelSituacaoParcela } from '../ui/StatusBadge';
import { Handshake, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { listarParcelas, listarSerasaRegistros } from '../../services/alunos';

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(data: string) {
  return new Date(data).toLocaleDateString('pt-BR');
}

interface Props {
  aluno: Aluno;
  onNegociar?: () => void;
}

export default function AlunoTabFinanceiro({ aluno, onNegociar }: Props) {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [serasaRegs, setSerasaRegs] = useState<SerasaRegistro[]>([]);
  const [loading, setLoading] = useState(true);

  const fin: ResumoFinanceiro = (aluno as any).resumoFinanceiro || aluno.financeiro || {
    totalParcelas: 0, parcelasEmAtraso: 0, parcelasAVencer: 0,
    parcelasPagas: 0, parcelasNegociadas: 0, parcelasCanceladas: 0,
    valorEmAberto: 0, valorInadimplente: 0, valorPago: 0, vencimentoMaisAntigo: null,
  };

  useEffect(() => {
    Promise.all([
      listarParcelas(aluno.codigo).catch(() => []),
      listarSerasaRegistros(aluno.codigo).catch(() => []),
    ]).then(([parc, serasa]) => {
      setParcelas(parc);
      setSerasaRegs(serasa);
    }).finally(() => setLoading(false));
  }, [aluno.codigo]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5">
        <DataCard label="Parcelas em atraso" valor={fin.parcelasEmAtraso.toString()} cor={fin.parcelasEmAtraso > 0 ? 'danger' : 'default'} />
        <DataCard label="Valor inadimplente" valor={formatarMoeda(fin.valorInadimplente)} cor={fin.valorInadimplente > 0 ? 'danger' : 'default'} />
        <DataCard label="Parcelas pagas" valor={fin.parcelasPagas.toString()} cor="success" />
        <DataCard label="Total pago" valor={formatarMoeda(fin.valorPago)} cor="success" />
      </div>

      {fin.parcelasEmAtraso > 0 && onNegociar && (
        <button onClick={onNegociar}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-red-600 text-white font-medium text-[0.8125rem] hover:bg-red-700 transition-colors">
          <Handshake size={16} />
          Negociar parcelas em atraso
        </button>
      )}

      <div className="flex items-center gap-3 text-[0.75rem] text-gray-400 flex-wrap">
        <span>Total: <strong className="text-gray-600">{fin.totalParcelas}</strong></span>
        {fin.parcelasAVencer > 0 && <span>A vencer: <strong className="text-gray-600">{fin.parcelasAVencer}</strong></span>}
        {fin.parcelasNegociadas > 0 && <span>Negociadas: <strong className="text-amber-600">{fin.parcelasNegociadas}</strong></span>}
        {fin.vencimentoMaisAntigo && <span>Mais antiga: <strong className="text-red-600">{formatarData(fin.vencimentoMaisAntigo)}</strong></span>}
      </div>

      {/* Serasa */}
      {serasaRegs.length > 0 && (
        <div>
          <p className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium mb-2">Serasa</p>
          <div className="bg-white rounded-xl border border-red-100 divide-y divide-red-50">
            {serasaRegs.map(s => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                {s.situacao === 'Ativa' ? (
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                ) : (
                  <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[0.8125rem] font-medium text-on-surface">
                    Contrato {s.contrato} · R$ {s.valor}
                  </span>
                  <div className="text-[0.6875rem] text-gray-400">
                    Negativado: {s.enviadoEm || '—'}
                    {s.baixadoEm && ` · Baixado: ${s.baixadoEm}`}
                  </div>
                </div>
                <span className={`text-[0.625rem] font-semibold px-2 py-0.5 rounded ${
                  s.situacao === 'Ativa' ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50'
                }`}>
                  {s.situacao}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <div>
          <p className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium mb-2">Parcelas</p>
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {parcelas.length === 0 && (
              <p className="px-4 py-8 text-center text-[0.8125rem] text-gray-400">Nenhuma parcela encontrada</p>
            )}
            {parcelas.map((p) => {
              const vencida = p.situacao === 'AR' && new Date(p.dataVencimento) < new Date();
              return (
                <div key={p.codigo} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[0.8125rem] font-medium text-gray-900">{formatarMoeda(p.valor)}</span>
                      <StatusBadge
                        texto={labelSituacaoParcela(p.situacao, vencida)}
                        variante={varianteSituacaoParcela(p.situacao, vencida)}
                        comDot
                      />
                    </div>
                    <span className="text-[0.6875rem] text-gray-400">
                      Venc. {formatarData(p.dataVencimento)} · {tipoOrigemLabel[p.tipoOrigem] || p.tipoOrigem}
                    </span>
                  </div>
                  {p.valorRecebido > 0 && (
                    <span className="text-[0.75rem] text-emerald-600">{formatarMoeda(p.valorRecebido)}</span>
                  )}
                  {p.multa && p.multa > 0 && (
                    <span className="text-[0.6875rem] text-red-500">+{formatarMoeda(p.multa + (p.juro || 0))}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
