import { useState } from 'react';
import type { AcordoFinanceiro, PagamentoAcordo } from '../../../types/acordo';
import { formaPagamentoLabel } from '../../../types/acordo';
import StatusBadge from '../../ui/StatusBadge';
import { Clock, CheckCircle2, AlertTriangle, CreditCard, QrCode, Landmark, MessageCircle, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function formatarMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

interface Props {
  acordo: AcordoFinanceiro;
  onAtualizado?: () => void;
}

export default function EtapaChecandoPagamento({ acordo }: Props) {
  const [enviandoWpp, setEnviandoWpp] = useState<string | null>(null);

  // Mesmo handler usado em EtapaCobrancaCriada — reusa o endpoint
  // POST /acordos/:id/pagamentos/:pagamentoId/enviar-whatsapp e o template
  // do Blip (cobranca_link_de_pagamento_asaas) sem mudancas no backend.
  async function handleEnviarWhatsapp(pgto: PagamentoAcordo) {
    setEnviandoWpp(pgto.id);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/acordos/${acordo.id}/pagamentos/${pgto.id}/enviar-whatsapp`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro' }));
        throw new Error(err.error);
      }
      alert('Link enviado por WhatsApp!');
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setEnviandoWpp(null);
    }
  }

  const pagamentos = acordo.pagamentos || [];
  const confirmados = pagamentos.filter(p => p.situacao === 'CONFIRMADO');
  const vencidos = pagamentos.filter(p => p.situacao === 'VENCIDO');
  const pendentes = pagamentos.filter(p => p.situacao === 'PENDENTE');
  const progresso = pagamentos.length > 0 ? (confirmados.length / pagamentos.length) * 100 : 0;

  const totalPago = confirmados.reduce((acc, p) => acc + Number(p.valorPago || p.valor), 0);
  const totalTaxas = confirmados.reduce((acc, p) => acc + Number(p.taxaAsaas || 0), 0);
  const totalLiquido = totalPago - totalTaxas;
  const totalRestante = pagamentos.filter(p => p.situacao !== 'CONFIRMADO').reduce((acc, p) => acc + Number(p.valor), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Clock size={16} />
        <span className="text-[0.8125rem] font-semibold">Acompanhamento de pagamentos</span>
      </div>

      {/* Barra de progresso */}
      <div className="bg-white/50 rounded-2xl p-4 shadow-sm shadow-black/[0.03] space-y-3">
        <div className="flex items-center justify-between text-[0.8125rem]">
          <span className="text-on-surface-variant">{confirmados.length} de {pagamentos.length} pagamentos confirmados</span>
          <span className="font-bold text-on-surface">{progresso.toFixed(0)}%</span>
        </div>
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progresso}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-[0.75rem]">
          <div>
            <p className="font-bold text-emerald-600">{formatarMoeda(totalPago)}</p>
            <p className="text-on-surface-variant/60">Recebido</p>
          </div>
          <div>
            <p className="font-bold text-amber-600">{formatarMoeda(totalRestante)}</p>
            <p className="text-on-surface-variant/60">Restante</p>
          </div>
          <div>
            <p className="font-bold text-on-surface-variant">{formatarMoeda(totalTaxas)}</p>
            <p className="text-on-surface-variant/60">Taxas Asaas</p>
          </div>
        </div>
      </div>

      {/* Alerta de vencidos */}
      {vencidos.length > 0 && (
        <div className="flex items-center gap-2 text-[0.8125rem] text-red-600 bg-red-50 rounded-xl px-4 py-3">
          <AlertTriangle size={14} />
          <span className="font-medium">{vencidos.length} pagamento{vencidos.length > 1 ? 's' : ''} vencido{vencidos.length > 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Lista de pagamentos */}
      <div className="space-y-2">
        {pagamentos.map((pgto, idx) => {
          const FormaIcone = pgto.formaPagamento === 'PIX' ? QrCode : pgto.formaPagamento === 'BOLETO' ? Landmark : CreditCard;
          const forma = formaPagamentoLabel[pgto.formaPagamento as keyof typeof formaPagamentoLabel] || pgto.formaPagamento;
          const pago = pgto.situacao === 'CONFIRMADO';
          const vencido = pgto.situacao === 'VENCIDO';

          return (
            <div key={pgto.id} className={`rounded-xl p-3.5 space-y-2 ${pago ? 'bg-emerald-50/50' : vencido ? 'bg-red-50/50' : 'bg-white/50'} shadow-sm shadow-black/[0.02]`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FormaIcone size={14} className={pago ? 'text-emerald-500' : vencido ? 'text-red-500' : 'text-on-surface-variant/40'} />
                  <span className="text-[0.8125rem] font-medium text-on-surface">
                    Pgto {idx + 1} — {forma}{Number(pgto.parcelas) > 1 ? ` (${pgto.parcelas}x)` : ''}
                  </span>
                </div>
                <StatusBadge
                  texto={pago ? 'Pago' : vencido ? 'Vencido' : 'Pendente'}
                  variante={pago ? 'success' : vencido ? 'danger' : 'warning'}
                  comDot
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[0.75rem]">
                <div>
                  <span className="text-on-surface-variant/60">Vencimento</span>
                  <p className="font-medium text-on-surface">{formatarData(pgto.dataVencimento)}</p>
                </div>
                <div>
                  <span className="text-on-surface-variant/60">Valor</span>
                  <p className="font-medium text-on-surface">{formatarMoeda(Number(pgto.valor))}</p>
                </div>
                {pago && (
                  <>
                    <div>
                      <span className="text-on-surface-variant/60">Pago em</span>
                      <p className="font-medium text-emerald-600">{formatarData(pgto.dataPagamento)}</p>
                    </div>
                    <div>
                      <span className="text-on-surface-variant/60">Líquido</span>
                      <p className="font-medium text-on-surface">
                        {formatarMoeda(Number(pgto.valorLiquido || pgto.valorPago || pgto.valor))}
                        {Number(pgto.taxaAsaas) > 0 && (
                          <span className="text-on-surface-variant/50 ml-1">(-{formatarMoeda(Number(pgto.taxaAsaas))})</span>
                        )}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Botao reenviar link via WhatsApp — so quando a cobranca esta
                  pendente E ainda tem asaasPaymentId valido. Mesma logica de
                  EtapaCobrancaCriada — reforco quando aluno demora a pagar. */}
              {pgto.asaasPaymentId && pgto.situacao === 'PENDENTE' && (
                <button
                  onClick={() => handleEnviarWhatsapp(pgto)}
                  disabled={enviandoWpp === pgto.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-medium text-[0.75rem] hover:bg-emerald-100 transition-colors disabled:opacity-40"
                >
                  {enviandoWpp === pgto.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <MessageCircle size={13} />
                  )}
                  {enviandoWpp === pgto.id ? 'Enviando...' : 'Reenviar link via WhatsApp'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Todos confirmados */}
      {confirmados.length === pagamentos.length && pagamentos.length > 0 && (
        <div className="flex items-center gap-2 text-[0.8125rem] text-emerald-600 bg-emerald-50 rounded-xl px-4 py-3">
          <CheckCircle2 size={14} />
          <span className="font-medium">Todos os pagamentos confirmados! O acordo será movido para Concluído automaticamente.</span>
        </div>
      )}
    </div>
  );
}
