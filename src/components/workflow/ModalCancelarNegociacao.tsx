import { useState, useEffect } from 'react';
import { X, AlertTriangle, FileSignature, CreditCard, Info } from 'lucide-react';
import type { AcordoFinanceiro } from '../../types/acordo';
import { cancelarAcordo, previewCancelamento } from '../../services/acordos';
import type { PreviewCancelamento } from '../../services/acordos';

interface ModalCancelarNegociacaoProps {
  acordo: AcordoFinanceiro;
  aberto: boolean;
  onFechar: () => void;
  onCancelado?: () => void;
}

function formatarMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const MIN_MOTIVO = 10;

export default function ModalCancelarNegociacao({
  acordo,
  aberto,
  onFechar,
  onCancelado,
}: ModalCancelarNegociacaoProps) {
  const [preview, setPreview] = useState<PreviewCancelamento | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setMotivo('');
    setErro(null);
    setPreview(null);
    setCarregandoPreview(true);
    previewCancelamento(acordo.id)
      .then(setPreview)
      .catch((e) => setErro(e?.message || 'Falha ao carregar preview'))
      .finally(() => setCarregandoPreview(false));
  }, [aberto, acordo.id]);

  if (!aberto) return null;

  const motivoOk = motivo.trim().length >= MIN_MOTIVO;
  const podeConfirmar = motivoOk && preview?.podeCancelar && !enviando;

  async function handleConfirmar() {
    if (!podeConfirmar) return;
    setEnviando(true);
    setErro(null);
    try {
      await cancelarAcordo(acordo.id, motivo.trim());
      onCancelado?.();
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao cancelar negociacao');
    } finally {
      setEnviando(false);
    }
  }

  const totalConfirmado = preview?.pagamentosConfirmados.reduce((s, p) => s + p.valor, 0) || 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[0.9375rem] font-semibold text-gray-900">Cancelar negociação</h3>
          <button onClick={onFechar} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <p className="text-[0.75rem] text-gray-500 mb-3">
          {acordo.pessoaNome} — {formatarMoeda(Number(acordo.valorAcordo))}
        </p>

        {carregandoPreview && (
          <div className="py-6 text-center text-[0.75rem] text-gray-400">Carregando informações…</div>
        )}

        {/* Bloqueio: nao pode cancelar */}
        {preview && !preview.podeCancelar && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2">
            <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-[0.75rem] text-red-900">{preview.motivo}</p>
          </div>
        )}

        {preview?.podeCancelar && (
          <>
            {/* Avisos dinâmicos */}
            {preview.termo.seraCanceladoNaClicksign && (
              <div className="mb-2 p-3 rounded-lg bg-amber-50 border border-amber-100 flex items-start gap-2">
                <FileSignature size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[0.75rem] text-amber-900">
                  O termo enviado para assinatura será <strong>cancelado na ClickSign</strong>. O aluno não poderá mais assinar.
                </p>
              </div>
            )}

            {preview.termo.assinado && (
              <div className="mb-2 p-3 rounded-lg bg-blue-50 border border-blue-100 flex items-start gap-2">
                <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[0.75rem] text-blue-900">
                  O termo já foi <strong>assinado</strong> e ficará preservado no repositório com status <strong>Cancelado</strong>.
                </p>
              </div>
            )}

            {preview.pagamentosACancelar.length > 0 && (
              <div className="mb-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <div className="flex items-start gap-2 mb-2">
                  <CreditCard size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[0.75rem] text-amber-900">
                    <strong>{preview.pagamentosACancelar.length}</strong> cobrança(s) do Asaas serão canceladas:
                  </p>
                </div>
                <ul className="ml-6 space-y-1 text-[0.6875rem] text-amber-800">
                  {preview.pagamentosACancelar.map((p) => (
                    <li key={p.id}>
                      Pagamento {p.numero} — {formatarMoeda(p.valor)} ({p.situacao})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.pagamentosConfirmados.length > 0 && (
              <div className="mb-2 p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[0.75rem] text-red-900 font-medium">
                    Atenção: {preview.pagamentosConfirmados.length} pagamento(s) já confirmado(s) — total {formatarMoeda(totalConfirmado)}.
                  </p>
                  <p className="text-[0.6875rem] text-red-800 mt-1">
                    Esses valores <strong>NÃO serão estornados automaticamente</strong>. Para devolução, use o painel do Asaas.
                  </p>
                </div>
              </div>
            )}

            {preview.pagamentosACancelar.length === 0 &&
              preview.pagamentosConfirmados.length === 0 &&
              !preview.termo.seraCanceladoNaClicksign && (
                <div className="mb-2 p-3 rounded-lg bg-gray-50 border border-gray-100 flex items-start gap-2">
                  <Info size={14} className="text-gray-500 shrink-0 mt-0.5" />
                  <p className="text-[0.75rem] text-gray-700">Nenhum impacto externo. Apenas marca o acordo como cancelado.</p>
                </div>
              )}

            {/* Justificativa obrigatória */}
            <div className="mt-4">
              <label className="block mb-1 text-[0.6875rem] text-gray-500 font-medium">
                Justificativa <span className="text-red-500">*</span> (mínimo {MIN_MOTIVO} caracteres)
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                placeholder="Descreva o motivo do cancelamento…"
                className="w-full rounded-lg bg-gray-50 border border-gray-100 text-[0.75rem] text-gray-800 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300"
              />
              <p className="text-[0.625rem] text-gray-400 mt-1">
                {motivo.trim().length}/{MIN_MOTIVO} {motivoOk ? '✓' : ''}
              </p>
            </div>
          </>
        )}

        {erro && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-100 text-[0.75rem] text-red-900">
            {erro}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onFechar}
            disabled={enviando}
            className="flex-1 h-9 rounded-lg border border-gray-200 text-[0.8125rem] text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            Voltar
          </button>
          {preview?.podeCancelar && (
            <button
              onClick={handleConfirmar}
              disabled={!podeConfirmar}
              className="flex-1 h-9 rounded-lg bg-red-600 text-white text-[0.8125rem] font-medium hover:bg-red-700 transition-colors disabled:opacity-40"
            >
              {enviando ? 'Cancelando…' : 'Confirmar cancelamento'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
