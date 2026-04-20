import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AlunosTable from '../components/alunos/AlunosTable';
import AlunoDrawer from '../components/alunos/AlunoDrawer';
import FiltrosAvancados from '../components/alunos/FiltrosAvancados';
import SearchInput from '../components/ui/SearchInput';
import { listarAlunos, obterAluno } from '../services/alunos';
import { executarRegra } from '../services/segmentacao';
import type { AlunoListItem } from '../services/alunos';
import type { Aluno } from '../types/aluno';
import { Loader2, SlidersHorizontal } from 'lucide-react';

export default function AlunosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [filtroFinanceiro, setFiltroFinanceiro] = useState('');
  const [segmentacaoId, setSegmentacaoId] = useState<string | null>(null);
  const [filtrosAberto, setFiltrosAberto] = useState(false);
  const [page, setPage] = useState(1);
  const [alunos, setAlunos] = useState<AlunoListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [alunoSelecionado, setAlunoSelecionado] = useState<Aluno | null>(null);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const LIMIT = 20;

  useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(busca), 400);
    return () => clearTimeout(timer);
  }, [busca]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      if (segmentacaoId) {
        const res = await executarRegra(segmentacaoId, {
          page, limit: LIMIT, search: buscaDebounced || undefined,
        });
        setAlunos(res.data);
        setTotal(res.total);
      } else {
        const res = await listarAlunos({
          search: buscaDebounced || undefined,
          situacao: filtroSituacao || undefined,
          financeiro: filtroFinanceiro || undefined,
          page,
          limit: LIMIT,
        });
        setAlunos(res.data);
        setTotal(res.total);
      }
    } catch (err) {
      console.error('Erro ao carregar alunos:', err);
    } finally {
      setLoading(false);
    }
  }, [buscaDebounced, filtroSituacao, filtroFinanceiro, segmentacaoId, page]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => { setPage(1); }, [buscaDebounced, filtroSituacao, filtroFinanceiro, segmentacaoId]);

  useEffect(() => {
    const codigo = searchParams.get('codigo');
    if (codigo) {
      abrirAluno(Number(codigo));
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  async function abrirAluno(codigo: number) {
    setDrawerLoading(true);
    setDrawerAberto(true);
    try {
      const aluno = await obterAluno(codigo);
      setAlunoSelecionado(aluno as Aluno);
    } catch {
      setAlunoSelecionado(null);
    } finally {
      setDrawerLoading(false);
    }
  }

  function handleSelecionar(item: AlunoListItem) {
    abrirAluno(item.codigo);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-80">
          <SearchInput
            valor={busca}
            onChange={setBusca}
            placeholder="Buscar por nome ou CPF..."
          />
        </div>

        <button
          onClick={() => setFiltrosAberto(true)}
          className={`flex items-center gap-2 h-10 px-4 rounded-xl text-[0.8125rem] font-medium transition-all ${
            filtroSituacao || filtroFinanceiro || segmentacaoId
              ? 'bg-gray-900 text-white'
              : 'bg-white/70 text-on-surface hover:bg-white hover:shadow-sm'
          }`}
        >
          <SlidersHorizontal size={15} />
          Filtros
          {(filtroSituacao || filtroFinanceiro || segmentacaoId) && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[0.625rem] font-bold">
              {(filtroSituacao ? 1 : 0) + (filtroFinanceiro ? 1 : 0) + (segmentacaoId ? 1 : 0)}
            </span>
          )}
        </button>

        <span className="text-[0.8125rem] text-on-surface-variant/60 ml-auto">
          {total} {total === 1 ? 'aluno' : 'alunos'}
        </span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {/* Tabela */}
      {!loading && (
        <>
          <AlunosTable alunos={alunos} onSelecionar={handleSelecionar} />

          {/* Paginacao */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 px-3 rounded-lg text-[0.75rem] font-medium text-on-surface-variant hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                Anterior
              </button>
              <span className="text-[0.75rem] text-on-surface-variant">
                {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 px-3 rounded-lg text-[0.75rem] font-medium text-on-surface-variant hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                Proximo
              </button>
            </div>
          )}
        </>
      )}

      {/* Drawer */}
      <AlunoDrawer
        aluno={alunoSelecionado}
        aberto={drawerAberto}
        onFechar={() => setDrawerAberto(false)}
        loading={drawerLoading}
      />

      {/* Filtros avancados */}
      <FiltrosAvancados
        aberto={filtrosAberto}
        onFechar={() => setFiltrosAberto(false)}
        situacao={filtroSituacao}
        financeiro={filtroFinanceiro}
        segmentacaoId={segmentacaoId}
        onSituacaoChange={setFiltroSituacao}
        onFinanceiroChange={setFiltroFinanceiro}
        onSegmentacaoChange={setSegmentacaoId}
      />
    </div>
  );
}
