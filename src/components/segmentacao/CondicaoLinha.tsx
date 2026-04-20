import type { Condicao, Operador } from '../../types/segmentacao';
import { CAMPOS_SEGMENTACAO, camposPorCategoria, operadorLabel } from '../../types/segmentacao';
import { X } from 'lucide-react';

interface CondicaoLinhaProps {
  condicao: Condicao;
  onChange: (condicao: Condicao) => void;
  onRemover: () => void;
}

export default function CondicaoLinha({ condicao, onChange, onRemover }: CondicaoLinhaProps) {
  const campo = CAMPOS_SEGMENTACAO.find(c => c.id === condicao.campoId);
  const grupos = camposPorCategoria();

  function handleCampoChange(campoId: string) {
    const novoCampo = CAMPOS_SEGMENTACAO.find(c => c.id === campoId);
    onChange({
      ...condicao,
      campoId,
      operador: novoCampo?.operadores[0] || 'igual',
      valor: '',
      valorFim: undefined,
    });
  }

  return (
    <div className="flex items-center gap-2">
      {/* Campo */}
      <select
        value={condicao.campoId}
        onChange={(e) => handleCampoChange(e.target.value)}
        className="h-9 px-3 rounded-lg bg-white border border-gray-100 text-[0.8125rem] text-gray-900 outline-none focus:border-gray-300 transition-colors flex-1 min-w-0 appearance-none cursor-pointer"
      >
        <option value="">Selecionar campo...</option>
        {Object.entries(grupos).map(([categoria, campos]) => (
          <optgroup key={categoria} label={categoria}>
            {campos.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Operador */}
      {campo && campo.tipo !== 'booleano' && (
        <select
          value={condicao.operador}
          onChange={(e) => onChange({ ...condicao, operador: e.target.value as Operador })}
          className="h-9 px-3 rounded-lg bg-white border border-gray-100 text-[0.8125rem] text-gray-900 outline-none focus:border-gray-300 transition-colors w-[140px] appearance-none cursor-pointer"
        >
          {campo.operadores.map((op) => (
            <option key={op} value={op}>{operadorLabel[op]}</option>
          ))}
        </select>
      )}

      {/* Valor */}
      {campo && campo.tipo === 'booleano' && (
        <select
          value={condicao.operador}
          onChange={(e) => onChange({ ...condicao, operador: e.target.value as Operador })}
          className="h-9 px-3 rounded-lg bg-white border border-gray-100 text-[0.8125rem] text-gray-900 outline-none focus:border-gray-300 transition-colors w-[100px] appearance-none cursor-pointer"
        >
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select>
      )}

      {campo && campo.tipo === 'lista' && (
        <select
          value={condicao.valor}
          onChange={(e) => onChange({ ...condicao, valor: e.target.value })}
          className="h-9 px-3 rounded-lg bg-white border border-gray-100 text-[0.8125rem] text-gray-900 outline-none focus:border-gray-300 transition-colors flex-1 min-w-0 appearance-none cursor-pointer"
        >
          <option value="">Selecionar...</option>
          {campo.opcoes?.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      )}

      {campo && (campo.tipo === 'numero' || campo.tipo === 'moeda') && (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={condicao.valor}
            onChange={(e) => onChange({ ...condicao, valor: e.target.value })}
            placeholder="Valor"
            className="h-9 px-3 rounded-lg bg-white border border-gray-100 text-[0.8125rem] text-gray-900 outline-none focus:border-gray-300 transition-colors w-[100px]"
          />
          {condicao.operador === 'entre' && (
            <>
              <span className="text-[0.75rem] text-gray-400">e</span>
              <input
                type="number"
                value={condicao.valorFim || ''}
                onChange={(e) => onChange({ ...condicao, valorFim: e.target.value })}
                placeholder="Até"
                className="h-9 px-3 rounded-lg bg-white border border-gray-100 text-[0.8125rem] text-gray-900 outline-none focus:border-gray-300 transition-colors w-[100px]"
              />
            </>
          )}
        </div>
      )}

      {/* Remover */}
      <button
        onClick={onRemover}
        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}
