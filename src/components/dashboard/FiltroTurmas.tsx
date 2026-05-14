import { useState, useEffect, useRef } from 'react';
import { GraduationCap, X, Check } from 'lucide-react';

interface Props {
  turmaIds: number[];
  onChange: (ids: number[]) => void;
}

// Whitelist canonica — espelha TURMAS_COHORT_WHITELIST do backend.
// Manter sincronizado: 2=T3, 4=T3-V2, 8=T4, 11=T4-V2, 21=T5A, 28=T5B, 35=T6 PRES.
const TURMAS_OPCOES = [
  { id: 2,  nome: 'TURMA 3',           apelido: 'T3' },
  { id: 4,  nome: 'TURMA 3-V2',        apelido: 'T3-V2' },
  { id: 8,  nome: 'TURMA 4',           apelido: 'T4' },
  { id: 11, nome: 'TURMA 4-V2',        apelido: 'T4-V2' },
  { id: 21, nome: 'TURMA 5A',          apelido: 'T5A' },
  { id: 28, nome: 'TURMA 5B',          apelido: 'T5B' },
  { id: 35, nome: 'TURMA 6 PRESENCIAL', apelido: 'T6' },
] as const;

/**
 * Multi-select de turmas que afeta os 3 graficos cohort do dashboard:
 * Aging Empilhado, Outros vs Recorrencia, Acumulado Novos Alunos.
 *
 * Vazio = todas as turmas (sem filtro). Persiste em localStorage no parent.
 * UX espelha FiltroAgentes: popover com selecao LOCAL + botoes Aplicar/Cancelar.
 */
export default function FiltroTurmas({ turmaIds, onChange }: Props) {
  const [aberto, setAberto] = useState(false);
  const [turmaIdsLocal, setTurmaIdsLocal] = useState<number[]>(turmaIds);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sincroniza estado local quando popover abre (ou quando o filtro externo muda)
  useEffect(() => {
    if (aberto) setTurmaIdsLocal(turmaIds);
  }, [aberto, turmaIds]);

  // Fecha ao clicar fora — descartando mudancas locais (mesmo efeito de Cancelar)
  useEffect(() => {
    if (!aberto) return;
    function onDocClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setTurmaIdsLocal(turmaIds);
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [aberto, turmaIds]);

  function toggleTurma(id: number) {
    setTurmaIdsLocal(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function limparLocal() {
    setTurmaIdsLocal([]);
  }

  function selecionarTodasLocal() {
    setTurmaIdsLocal(TURMAS_OPCOES.map(t => t.id));
  }

  function aplicar() {
    onChange(turmaIdsLocal);
    setAberto(false);
  }

  function cancelar() {
    setTurmaIdsLocal(turmaIds);
    setAberto(false);
  }

  function limparChipExterno(e: React.MouseEvent) {
    e.stopPropagation();
    onChange([]);
  }

  // Label do botao reflete o estado APLICADO (turmaIds), nao o local
  const labelBotao = (() => {
    if (turmaIds.length === 0 || turmaIds.length === TURMAS_OPCOES.length) return 'Todas as turmas';
    if (turmaIds.length === 1) {
      const t = TURMAS_OPCOES.find(x => x.id === turmaIds[0]);
      return t?.nome || '1 turma';
    }
    if (turmaIds.length === 2) {
      const apelidos = TURMAS_OPCOES.filter(t => turmaIds.includes(t.id)).map(t => t.apelido);
      return apelidos.join(' + ');
    }
    return `${turmaIds.length} turmas`;
  })();

  // Botao Aplicar fica desabilitado quando local == externo (nada a aplicar)
  const sortedLocal = [...turmaIdsLocal].sort((a, b) => a - b);
  const sortedExterno = [...turmaIds].sort((a, b) => a - b);
  const semMudancas = sortedLocal.length === sortedExterno.length
    && sortedLocal.every((v, i) => v === sortedExterno[i]);

  // "Filtro ativo" significa que o usuario escolheu um subset (nao "todas").
  // turmaIds vazio = todas; turmaIds com todos os 7 ids = tambem "todas".
  const filtroAtivo = turmaIds.length > 0 && turmaIds.length < TURMAS_OPCOES.length;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setAberto(!aberto)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.75rem] shadow-sm transition-colors ${
          filtroAtivo
            ? 'bg-primary text-white hover:bg-primary/90'
            : 'bg-white text-on-surface-variant hover:bg-gray-50'
        }`}
      >
        <GraduationCap size={13} />
        <span className="font-medium">{labelBotao}</span>
        {filtroAtivo && (
          <span
            onClick={limparChipExterno}
            className="ml-1 hover:bg-white/20 rounded p-0.5"
            role="button"
            aria-label="Limpar filtro"
          >
            <X size={11} />
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-2">
            <span className="text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-wider">Filtrar por turma</span>
            <div className="flex items-center gap-2">
              <button
                onClick={selecionarTodasLocal}
                className="text-[0.6875rem] text-primary hover:underline"
              >
                Todas
              </button>
              <span className="text-gray-300">·</span>
              <button
                onClick={limparLocal}
                className="text-[0.6875rem] text-on-surface-variant hover:underline"
              >
                Nenhuma
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {TURMAS_OPCOES.map(t => {
              const selecionado = turmaIdsLocal.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTurma(t.id)}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    selecionado ? 'bg-primary border-primary' : 'border-gray-300'
                  }`}>
                    {selecionado && <Check size={11} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.8125rem] font-medium text-on-surface truncate">{t.nome}</p>
                    <p className="text-[0.625rem] text-on-surface-variant font-mono">cod {t.id}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              onClick={cancelar}
              className="px-3 py-1 rounded-lg text-[0.75rem] text-on-surface-variant hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={aplicar}
              disabled={semMudancas}
              className="px-3 py-1 rounded-lg text-[0.75rem] font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
