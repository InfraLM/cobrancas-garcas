import { useState } from 'react';
import Modal from '../ui/Modal';
import { MOTIVOS_PAUSA_SELECIONAVEIS, motivoPausaLabel } from '../../types/pausaLigacao';
import type { MotivoPausa, PausaLigacao } from '../../types/pausaLigacao';
import { criarPausa } from '../../services/pausasLigacao';
import { Loader2 } from 'lucide-react';

interface PausarLigacaoModalProps {
  aberto: boolean;
  onFechar: () => void;
  pessoaCodigo: number;
  pessoaNome?: string | null;
  onPausada: (pausa: PausaLigacao) => void;
}

export default function PausarLigacaoModal({ aberto, onFechar, pessoaCodigo, pessoaNome, onPausada }: PausarLigacaoModalProps) {
  const [motivo, setMotivo] = useState<MotivoPausa>('AGENTE_DECISAO');
  const [observacao, setObservacao] = useState('');
  const [pausaAte, setPausaAte] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit() {
    setSalvando(true);
    setErro(null);
    try {
      const pausa = await criarPausa({
        pessoaCodigo,
        motivo,
        observacao: observacao.trim() || undefined,
        pausaAte: pausaAte || undefined,
      });
      onPausada(pausa);
      // Reset state
      setMotivo('AGENTE_DECISAO');
      setObservacao('');
      setPausaAte('');
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao pausar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={aberto} onFechar={salvando ? () => {} : onFechar} titulo="Pausar ligações" largura="max-w-lg">
      <div className="space-y-4">
        {pessoaNome && (
          <p className="text-[0.8125rem] text-on-surface-variant">
            O aluno <span className="font-semibold text-on-surface">{pessoaNome}</span> não receberá mais ligações em massa enquanto a pausa estiver ativa. Ele continuará aparecendo nas segmentações para fins de análise.
          </p>
        )}

        <div>
          <label className="block text-[0.75rem] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Motivo</label>
          <select
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value as MotivoPausa)}
            disabled={salvando}
          >
            {MOTIVOS_PAUSA_SELECIONAVEIS.map(m => (
              <option key={m} value={m}>{motivoPausaLabel[m]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[0.75rem] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Pausar até (opcional)</label>
          <input
            type="date"
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            value={pausaAte}
            onChange={(e) => setPausaAte(e.target.value)}
            disabled={salvando}
            min={new Date().toISOString().slice(0, 10)}
          />
          <p className="text-[0.75rem] text-gray-400 mt-1">Se vazio, a pausa é indefinida até ser removida manualmente.</p>
        </div>

        <div>
          <label className="block text-[0.75rem] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Observação (opcional)</label>
          <textarea
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            rows={3}
            placeholder="Ex: cliente pediu 1 semana pra decidir, contato já feito hoje, etc."
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            disabled={salvando}
          />
        </div>

        {erro && <p className="text-[0.8125rem] text-red-600">{erro}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100"
            onClick={onFechar}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-sm text-white bg-primary hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
            onClick={submit}
            disabled={salvando}
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            Confirmar pausa
          </button>
        </div>
      </div>
    </Modal>
  );
}
