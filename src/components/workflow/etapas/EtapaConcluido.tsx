import { useState } from 'react';
import type { AcordoFinanceiro } from '../../../types/acordo';
import { formaPagamentoLabel } from '../../../types/acordo';
import { vincularSei } from '../../../services/acordos';
import { CheckCircle2, AlertTriangle, CreditCard, QrCode, Landmark, Link2, Loader2 } from 'lucide-react';

function formatarMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function formatarDataHora(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  acordo: AcordoFinanceiro;
  onAtualizado?: () => void;
}

export default function EtapaConcluido({ acordo, onAtualizado }: Props) {
  const pagamentos = acordo.pagamentos || [];
  const totalPago = pagamentos.reduce((acc, p) => acc + Number(p.valorPago || p.valor), 0);
  const totalTaxas = pagamentos.reduce((acc, p) => acc + Number(p.taxaAsaas || 0), 0);
  const totalLiquido = totalPago - totalTaxas;

  const diasParaConcluir = acordo.criadoEm
    ? Math.ceil((Date.now() - new Date(acordo.criadoEm).getTime()) / 86400000)
    : 0;

  const [codigoSei, setCodigoSei] = useState('');
  const [vinculando, setVinculando] = useState(false);
  const [erro, setErro] = useState('');
  const seiVinculado = !!acordo.negociacaoContaReceberCodigo;

  async function handleVincularRetroativo() {
    if (!codigoSei.trim()) return;
    setVinculando(true);
    setErro('');
    try {
      await vincularSei(acordo.id, parseInt(codigoSei));
      onAtualizado?.();
    } catch (err: any) {
      setErro(err.message || 'Erro ao vincular');
    } finally {
      setVinculando(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Banner de sucesso */}
      <div className="bg-emerald-50 rounded-2xl p-5 text-center space-y-2">
        <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
        <p className="text-lg font-bold text-emerald-700">Acordo concluído</p>
        <p className="text-[0.875rem] text-emerald-600">Valor recuperado: {formatarMoeda(totalPago)}</p>
      </div>

      {/* Alerta + vinculo SEI (permite vincular retroativamente se aluno pagou
          antes do agente conseguir criar a negociacao no SEI) */}
      {seiVinculado ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <div>
              <p className="text-[0.8125rem] font-semibold text-amber-800">Lembre-se de dar baixa no SEI</p>
              <p className="text-[0.75rem] text-amber-700 mt-0.5">
                Negociação SEI #{acordo.negociacaoContaReceberCodigo} — realize a baixa das parcelas recebidas.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[0.8125rem] font-semibold text-amber-800">Negociação SEI não vinculada</p>
              <p className="text-[0.75rem] text-amber-700 mt-0.5">
                O aluno pagou antes do vínculo. Crie a negociação no SEI agora e cole o código abaixo para manter o registro completo.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={codigoSei}
              onChange={(e) => setCodigoSei(e.target.value.replace(/\D/g, ''))}
              placeholder="Código da negociação SEI"
              className="flex-1 h-9 px-3 rounded-lg bg-white text-[0.8125rem] font-mono text-on-surface border border-amber-200 placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-amber-400/30"
            />
            <button
              onClick={handleVincularRetroativo}
              disabled={!codigoSei.trim() || vinculando}
              className="px-4 h-9 rounded-lg bg-amber-600 text-white font-semibold text-[0.75rem] hover:bg-amber-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {vinculando ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
              Vincular
            </button>
          </div>
          {erro && <p className="text-[0.75rem] text-red-600">{erro}</p>}
        </div>
      )}

      {/* Resumo financeiro */}
      <div className="bg-white/50 rounded-2xl p-4 shadow-sm shadow-black/[0.03] space-y-3">
        <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Resumo financeiro</span>
        <div className="space-y-2 text-[0.8125rem]">
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Valor bruto recebido</span>
            <span className="font-bold text-on-surface">{formatarMoeda(totalPago)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Taxas Asaas</span>
            <span className="font-medium text-red-500">-{formatarMoeda(totalTaxas)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-2">
            <span className="font-semibold text-on-surface">Valor líquido</span>
            <span className="font-bold text-lg text-emerald-600">{formatarMoeda(totalLiquido)}</span>
          </div>
        </div>
      </div>

      {/* Detalhes */}
      <div className="bg-surface-container-low rounded-2xl p-4 space-y-2 text-[0.8125rem]">
        <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Detalhes</span>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Criado em</span>
          <span>{formatarDataHora(acordo.criadoEm)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Dias para conclusão</span>
          <span>{diasParaConcluir} dias</span>
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Agente</span>
          <span className="font-medium">{acordo.criadoPorNome}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Desconto aplicado</span>
          <span>{Number(acordo.descontoAcordoPercentual) > 0 ? `${Number(acordo.descontoAcordoPercentual).toFixed(1)}%` : '—'}</span>
        </div>
      </div>

      {/* Pagamentos confirmados */}
      <div className="space-y-2">
        <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Pagamentos confirmados</span>
        {pagamentos.map((pgto, idx) => {
          const FormaIcone = pgto.formaPagamento === 'PIX' ? QrCode : pgto.formaPagamento === 'BOLETO' ? Landmark : CreditCard;
          return (
            <div key={pgto.id} className="bg-emerald-50/50 rounded-xl p-3 flex items-center gap-3">
              <FormaIcone size={14} className="text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[0.8125rem] font-medium text-on-surface">
                  Pgto {idx + 1} — {formaPagamentoLabel[pgto.formaPagamento as keyof typeof formaPagamentoLabel] || pgto.formaPagamento}
                </span>
                <p className="text-[0.6875rem] text-on-surface-variant">Pago em {formatarData(pgto.dataPagamento)}</p>
              </div>
              <div className="text-right text-[0.75rem]">
                <p className="font-bold text-on-surface">{formatarMoeda(Number(pgto.valorPago || pgto.valor))}</p>
                {Number(pgto.taxaAsaas) > 0 && (
                  <p className="text-on-surface-variant/50">-{formatarMoeda(Number(pgto.taxaAsaas))} taxa</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
