import { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import type { MotivoEncerramento } from '../../types/conversa';
import { MOTIVOS_ENCERRAMENTO_LABELS } from '../../types/conversa';

interface ModalEncerrarConversaProps {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (motivo: MotivoEncerramento, observacao: string) => Promise<void>;
  onCriarAcordo?: () => void;
}

const MOTIVOS: MotivoEncerramento[] = [
  'ACORDO_FECHADO',
  'PAGO_AVISTA',
  'SEM_RETORNO',
  'RECUSOU',
  'NAO_E_DEVEDOR',
  'TRANSFERIDO_JURIDICO',
  'OUTRO',
];

export default function ModalEncerrarConversa({ aberto, onFechar, onConfirmar, onCriarAcordo }: ModalEncerrarConversaProps) {
  const [motivo, setMotivo] = useState<MotivoEncerramento | null>(null);
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!aberto) return null;

  async function handleConfirmar() {
    if (!motivo) return;
    setEnviando(true);
    try {
      await onConfirmar(motivo, observacao);
      setMotivo(null);
      setObservacao('');
      onFechar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={onFechar}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[0.9375rem] font-semibold text-gray-900">Encerrar conversa</h3>
          <button onClick={onFechar} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <p className="text-[0.75rem] text-gray-500 mb-3">Escolha o motivo do encerramento:</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {MOTIVOS.map((m) => (
            <button
              key={m}
              onClick={() => setMotivo(m)}
              className={`text-left px-3 py-2 rounded-lg border text-[0.75rem] transition-colors ${
                motivo === m
                  ? 'bg-gray-900 border-gray-900 text-white'
                  : 'bg-gray-50 border-gray-100 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {MOTIVOS_ENCERRAMENTO_LABELS[m]}
            </button>
          ))}
        </div>

        {motivo === 'ACORDO_FECHADO' && onCriarAcordo && (
          <div className="mb-3 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[0.75rem] text-emerald-900 font-medium mb-1">Registrar acordo no sistema?</p>
                <p className="text-[0.6875rem] text-emerald-700 mb-2">Ir para o workflow de negociação para formalizar.</p>
                <button
                  onClick={onCriarAcordo}
                  className="text-[0.75rem] h-7 px-3 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  Criar acordo
                </button>
              </div>
            </div>
          </div>
        )}

        <label className="block mb-1 text-[0.6875rem] text-gray-500 font-medium">Observação (opcional)</label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={3}
          placeholder="Detalhes do encerramento…"
          className="w-full rounded-lg bg-gray-50 border border-gray-100 text-[0.75rem] text-gray-800 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300"
        />

        <div className="flex gap-2 mt-4">
          <button
            onClick={onFechar}
            disabled={enviando}
            className="flex-1 h-9 rounded-lg border border-gray-200 text-[0.8125rem] text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!motivo || enviando}
            className="flex-1 h-9 rounded-lg bg-gray-900 text-white text-[0.8125rem] font-medium hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            {enviando ? 'Encerrando…' : 'Encerrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
