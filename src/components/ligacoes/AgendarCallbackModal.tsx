import { useState } from 'react';
import type { Aluno } from '../../types/aluno';
import type { AgendamentoCallback } from '../../types/ligacao';
import Modal from '../ui/Modal';

interface AgendarCallbackModalProps {
  aluno: Aluno | null;
  aberto: boolean;
  onFechar: () => void;
  onAgendar: (agendamento: AgendamentoCallback) => void;
}

export default function AgendarCallbackModal({ aluno, aberto, onFechar, onAgendar }: AgendarCallbackModalProps) {
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [observacao, setObservacao] = useState('');

  if (!aluno) return null;

  function handleAgendar() {
    if (!data || !hora || !aluno) return;
    onAgendar({
      pessoaCodigo: aluno.codigo,
      pessoaNome: aluno.nome,
      telefone: aluno.celular || aluno.telefone1 || '',
      dataHora: `${data}T${hora}:00`,
      observacao: observacao || undefined,
    });
    setData('');
    setHora('');
    setObservacao('');
    onFechar();
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Agendar Retorno">
      <div className="space-y-4">
        <div>
          <p className="text-[0.8125rem] text-gray-500 mb-4">
            Agendar retorno de chamada para <span className="font-medium text-gray-900">{aluno.nome}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[0.75rem] font-medium text-gray-500 mb-1.5 block">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white border border-gray-100 text-[0.8125rem] text-gray-900 outline-none focus:border-gray-300 transition-colors"
            />
          </div>
          <div>
            <label className="text-[0.75rem] font-medium text-gray-500 mb-1.5 block">Horário</label>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white border border-gray-100 text-[0.8125rem] text-gray-900 outline-none focus:border-gray-300 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="text-[0.75rem] font-medium text-gray-500 mb-1.5 block">
            Observação <span className="text-gray-300 font-normal">(opcional)</span>
          </label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Motivo do retorno, assunto a tratar..."
            rows={2}
            className="w-full px-4 py-2.5 rounded-xl bg-white border border-gray-100 text-[0.8125rem] text-gray-900 placeholder:text-gray-300 outline-none focus:border-gray-300 transition-colors resize-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onFechar}
            className="flex-1 h-11 rounded-xl bg-white border border-gray-100 text-gray-600 font-medium text-[0.8125rem] hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleAgendar}
            disabled={!data || !hora}
            className="flex-1 h-11 rounded-xl bg-gray-900 text-white font-medium text-[0.8125rem] hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Agendar
          </button>
        </div>
      </div>
    </Modal>
  );
}
