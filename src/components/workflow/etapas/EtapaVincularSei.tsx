import { useState } from 'react';
import type { AcordoFinanceiro } from '../../../types/acordo';
import { vincularSei } from '../../../services/acordos';
import { Link2, CheckCircle2, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Props {
  acordo: AcordoFinanceiro;
  onAtualizado?: () => void;
}

export default function EtapaVincularSei({ acordo, onAtualizado }: Props) {
  const [codigoSei, setCodigoSei] = useState(acordo.negociacaoContaReceberCodigo?.toString() || '');
  const [vinculando, setVinculando] = useState(false);
  const [erro, setErro] = useState('');
  const jaVinculado = !!acordo.negociacaoContaReceberCodigo;

  async function handleVincular() {
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

  async function handleAvancar() {
    const token = localStorage.getItem('auth_token');
    await fetch(`${API_URL}/acordos/${acordo.id}/etapa`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapa: 'CHECANDO_PAGAMENTO' }),
    });
    onAtualizado?.();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Link2 size={16} />
        <span className="text-[0.8125rem] font-semibold">Vinculação ao SEI</span>
      </div>

      {/* Instrucoes */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-600 shrink-0" />
          <span className="text-[0.8125rem] font-semibold text-amber-800">Ação manual necessária</span>
        </div>
        <ol className="text-[0.8125rem] text-amber-700 space-y-1 list-decimal list-inside">
          <li>Acesse o SEI e crie a negociação manualmente</li>
          <li>Copie o código da negociação gerado pelo SEI</li>
          <li>Informe o código abaixo para vincular ao CRM</li>
        </ol>
      </div>

      {/* Input do codigo SEI */}
      <div className="bg-white/50 rounded-2xl p-4 shadow-sm shadow-black/[0.03] space-y-3">
        <label className="text-[0.8125rem] font-medium text-on-surface">Código da negociação no SEI</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={codigoSei}
            onChange={(e) => setCodigoSei(e.target.value.replace(/\D/g, ''))}
            placeholder="Ex: 720"
            disabled={jaVinculado}
            className="flex-1 h-10 px-4 rounded-xl bg-surface-container-low text-[0.875rem] font-mono text-on-surface placeholder:text-on-surface-variant/30 outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {!jaVinculado && (
            <button onClick={handleVincular} disabled={!codigoSei.trim() || vinculando}
              className="px-5 h-10 rounded-xl bg-primary text-white font-semibold text-[0.8125rem] hover:bg-primary-container transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
              {vinculando ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              {vinculando ? 'Vinculando...' : 'Vincular'}
            </button>
          )}
        </div>

        {jaVinculado && (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 size={14} />
            <span className="text-[0.8125rem] font-medium">Vinculado — SEI #{acordo.negociacaoContaReceberCodigo}</span>
          </div>
        )}

        {erro && <p className="text-[0.75rem] text-red-600">{erro}</p>}
      </div>

      <p className="text-[0.75rem] text-on-surface-variant/60">
        Após o próximo sync com o SEI, as parcelas originais serão marcadas como NE (Negociado) e novas parcelas NCR serão criadas automaticamente.
      </p>

      {jaVinculado && (
        <button onClick={handleAvancar}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-semibold text-[0.875rem] hover:bg-primary-container transition-colors shadow-sm">
          Próximo: Acompanhar pagamentos
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
