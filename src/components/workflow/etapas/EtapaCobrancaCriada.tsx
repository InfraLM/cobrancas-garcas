import { useState } from 'react';
import type { AcordoFinanceiro, PagamentoAcordo } from '../../../types/acordo';
import { formaPagamentoLabel } from '../../../types/acordo';
import StatusBadge from '../../ui/StatusBadge';
import { CreditCard, Copy, Check, MessageCircle, Loader2, ArrowRight, QrCode, Landmark } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function formatarMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(d: string) {
  return new Date(d).toLocaleDateString('pt-BR');
}

interface Props {
  acordo: AcordoFinanceiro;
  onAtualizado?: () => void;
}

function CopyButton({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}
      className="p-1 rounded text-on-surface-variant/30 hover:text-on-surface transition-colors" title="Copiar">
      {copiado ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
    </button>
  );
}

function situacaoBadge(sit: string) {
  switch (sit) {
    case 'CONFIRMADO': return <StatusBadge texto="Pago" variante="success" comDot />;
    case 'VENCIDO': return <StatusBadge texto="Vencido" variante="danger" comDot />;
    case 'CANCELADO': return <StatusBadge texto="Cancelado" variante="default" />;
    default: return <StatusBadge texto="Pendente" variante="warning" comDot />;
  }
}

export default function EtapaCobrancaCriada({ acordo, onAtualizado }: Props) {
  const [gerando, setGerando] = useState(false);
  const [enviandoWpp, setEnviandoWpp] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const temCobrancas = acordo.pagamentos.some(p => p.asaasPaymentId);

  async function handleGerarCobrancas() {
    setGerando(true);
    setErro('');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/acordos/${acordo.id}/gerar-cobrancas`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error);
      }
      onAtualizado?.();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setGerando(false);
    }
  }

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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <CreditCard size={16} />
        <span className="text-[0.8125rem] font-semibold">Cobranças</span>
      </div>

      {/* Botao gerar cobrancas (se ainda nao gerou) */}
      {!temCobrancas && (
        <div className="space-y-3">
          <p className="text-[0.8125rem] text-on-surface-variant">
            Clique abaixo para gerar as cobranças no Asaas. Os links de pagamento serão criados automaticamente.
          </p>
          {erro && <p className="text-[0.75rem] text-red-600 bg-red-50 rounded-xl px-4 py-2.5">{erro}</p>}
          <button onClick={handleGerarCobrancas} disabled={gerando}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-semibold text-[0.875rem] hover:bg-primary-container transition-colors shadow-sm disabled:opacity-40">
            {gerando ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
            {gerando ? 'Gerando cobranças...' : 'Gerar cobranças no Asaas'}
          </button>
        </div>
      )}

      {/* Lista de cobrancas geradas */}
      {temCobrancas && (
        <div className="space-y-3">
          {acordo.pagamentos.map((pgto, idx) => {
            const forma = formaPagamentoLabel[pgto.formaPagamento as keyof typeof formaPagamentoLabel] || pgto.formaPagamento;
            const FormaIcone = pgto.formaPagamento === 'PIX' ? QrCode : pgto.formaPagamento === 'BOLETO' ? Landmark : CreditCard;

            return (
              <div key={pgto.id} className="bg-white/50 rounded-2xl p-4 shadow-sm shadow-black/[0.03] space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FormaIcone size={14} className="text-primary" />
                    </div>
                    <div>
                      <span className="text-[0.8125rem] font-semibold text-on-surface">
                        Pgto {idx + 1} — {forma}
                        {Number(pgto.parcelas) > 1 ? ` (${pgto.parcelas}x)` : ''}
                      </span>
                      <p className="text-[0.6875rem] text-on-surface-variant">Venc. {formatarData(pgto.dataVencimento)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[0.875rem] font-bold text-on-surface">{formatarMoeda(Number(pgto.valor))}</p>
                    {situacaoBadge(pgto.situacao)}
                  </div>
                </div>

                {/* Link de pagamento */}
                {pgto.asaasInvoiceUrl && (
                  <div className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3 py-2">
                    <span className="text-[0.6875rem] text-on-surface-variant truncate flex-1">{pgto.asaasInvoiceUrl}</span>
                    <CopyButton texto={pgto.asaasInvoiceUrl} />
                    <a href={pgto.asaasInvoiceUrl} target="_blank" rel="noopener noreferrer"
                      className="text-[0.6875rem] text-primary font-medium hover:underline">Abrir</a>
                  </div>
                )}

                {/* PIX QR Code */}
                {pgto.asaasPixQrCode && (
                  <div className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3 py-2">
                    <QrCode size={12} className="text-on-surface-variant/40 shrink-0" />
                    <span className="text-[0.6875rem] text-on-surface-variant truncate flex-1">
                      {pgto.asaasPixQrCode.slice(0, 40)}...
                    </span>
                    <CopyButton texto={pgto.asaasPixQrCode} />
                  </div>
                )}

                {/* Botao WhatsApp */}
                {pgto.asaasPaymentId && pgto.situacao === 'PENDENTE' && (
                  <button onClick={() => handleEnviarWhatsapp(pgto)} disabled={enviandoWpp === pgto.id}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 font-medium text-[0.8125rem] hover:bg-emerald-100 transition-colors disabled:opacity-40">
                    {enviandoWpp === pgto.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <MessageCircle size={14} />
                    )}
                    {enviandoWpp === pgto.id ? 'Enviando...' : 'Enviar link via WhatsApp'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Proximo passo */}
      {temCobrancas && (
        <button className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-semibold text-[0.875rem] hover:bg-primary-container transition-colors shadow-sm"
          onClick={() => {
            const token = localStorage.getItem('auth_token');
            fetch(`${API_URL}/acordos/${acordo.id}/etapa`, {
              method: 'PUT',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ etapa: 'SEI_VINCULADO' }),
            }).then(() => onAtualizado?.());
          }}>
          Próximo: Vincular SEI
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
