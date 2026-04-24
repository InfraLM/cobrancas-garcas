import { useEffect, useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import Modal from '../ui/Modal';
import { criarRegua } from '../../services/reguas';
import type { ReguaCobranca } from '../../types/reguaCobranca';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onCriada: (regua: ReguaCobranca) => void;
}

export default function NovaReguaModal({ aberto, onFechar, onCriada }: Props) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [horarioPadrao, setHorarioPadrao] = useState('09:00');
  const [intervalo, setIntervalo] = useState(2);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) {
      setNome('');
      setDescricao('');
      setHorarioPadrao('09:00');
      setIntervalo(2);
      setErro(null);
    }
  }, [aberto]);

  async function handleSalvar() {
    if (!nome.trim()) { setErro('Nome obrigatório'); return; }
    setErro(null);
    setSalvando(true);
    try {
      const r = await criarRegua({
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        horarioPadrao,
        intervaloDisparoSeg: intervalo,
      });
      onCriada(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={aberto} onFechar={salvando ? () => {} : onFechar} titulo="Nova régua de cobrança" largura="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Nome *</label>
          <input
            autoFocus
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: Cobrança mensal — rec. inativa"
            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Descrição (opcional)</label>
          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            rows={2}
            placeholder="Breve explicação do propósito desta régua"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Horário padrão das etapas</label>
            <input
              type="time"
              value={horarioPadrao}
              onChange={e => setHorarioPadrao(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-[0.875rem]"
            />
            <p className="text-[0.6875rem] text-gray-400 mt-1">Cada etapa pode sobrescrever</p>
          </div>
          <div>
            <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Intervalo entre disparos (s)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={intervalo}
              onChange={e => setIntervalo(Number(e.target.value) || 2)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-[0.875rem]"
            />
            <p className="text-[0.6875rem] text-gray-400 mt-1">Respeita rate limit da Blip</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-sky-50/50 border border-sky-100 flex items-start gap-2">
          <Zap size={14} className="text-sky-600 mt-0.5 shrink-0" />
          <p className="text-[0.75rem] text-sky-800">
            A régua começa <span className="font-semibold">desativada</span>. Depois de cadastrar as etapas, ative ela para o scheduler começar a enviar.
          </p>
        </div>

        {erro && <p className="text-[0.8125rem] text-red-600">{erro}</p>}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="px-4 py-2 rounded-lg text-[0.8125rem] text-gray-500 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando || !nome.trim()}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gray-900 text-white text-[0.8125rem] font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {salvando && <Loader2 size={13} className="animate-spin" />}
            Criar régua
          </button>
        </div>
      </div>
    </Modal>
  );
}
