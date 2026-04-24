import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AcordoFinanceiro } from '../types/acordo';
import type { Aluno } from '../types/aluno';
import { listarAcordos } from '../services/acordos';
import { obterAluno } from '../services/alunos';
import { useRealtime } from '../contexts/RealtimeContext';
import KanbanBoard from '../components/workflow/KanbanBoard';
import AcordoDrawer from '../components/workflow/AcordoDrawer';
import NovaNegociacaoDrawer from '../components/workflow/NovaNegociacaoDrawer';
import SearchInput from '../components/ui/SearchInput';
import { Plus, Loader2 } from 'lucide-react';

export default function WorkflowNegociacoesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [novaNegociacaoAberta, setNovaNegociacaoAberta] = useState(false);
  const [alunoInicial, setAlunoInicial] = useState<Aluno | null>(null);
  const [acordoSelecionado, setAcordoSelecionado] = useState<AcordoFinanceiro | null>(null);
  const [drawerAberto, setDrawerAberto] = useState(false);

  const [acordos, setAcordos] = useState<AcordoFinanceiro[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarAcordos = useCallback(async () => {
    try {
      setLoading(true);
      const { acordos: data } = await listarAcordos({ search: busca || undefined });
      setAcordos(data);
    } catch (err) {
      console.error('Erro ao carregar acordos:', err);
    } finally {
      setLoading(false);
    }
  }, [busca]);

  useEffect(() => {
    const timer = setTimeout(carregarAcordos, 400);
    return () => clearTimeout(timer);
  }, [carregarAcordos]);

  // Detectar query param novaComAluno (vindo das acoes rapidas)
  useEffect(() => {
    const codigoAluno = searchParams.get('novaComAluno');
    if (codigoAluno) {
      setSearchParams({}, { replace: true }); // limpar URL
      obterAluno(Number(codigoAluno))
        .then(a => {
          setAlunoInicial(a as Aluno);
          setNovaNegociacaoAberta(true);
        })
        .catch(() => setNovaNegociacaoAberta(true));
    }
  }, []);

  // Realtime: atualizar quando webhook ClickSign processar
  const realtime = useRealtime();
  useEffect(() => {
    const unsub = realtime.on('acordo:atualizado', () => {
      carregarAcordos();
    });
    return unsub;
  }, [realtime, carregarAcordos]);

  // Metricas (ignora cancelados — ficam fora do Kanban tambem)
  const acordosAtivos = acordos.filter(a => a.etapa !== 'CANCELADO');
  const totalAcordos = acordosAtivos.length;
  const valorTotal = acordosAtivos.reduce((acc, a) => acc + Number(a.valorAcordo), 0);
  const concluidos = acordosAtivos.filter(a => a.etapa === 'CONCLUIDO').length;

  function handleCardClick(acordo: AcordoFinanceiro) {
    setAcordoSelecionado(acordo);
    setDrawerAberto(true);
  }

  function handleNovaNegociacaoCriada() {
    setNovaNegociacaoAberta(false);
    carregarAcordos();
  }

  function handleAcordoAtualizado() {
    setDrawerAberto(false);
    setAcordoSelecionado(null);
    carregarAcordos();
  }

  return (
    <div className="space-y-5 h-full">
      {/* Topo: Filtros + Ação */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-72">
          <SearchInput
            valor={busca}
            onChange={setBusca}
            placeholder="Buscar aluno ou CPF..."
          />
        </div>

        {/* Métricas inline */}
        <div className="flex items-center gap-4 ml-auto text-[0.8125rem] text-on-surface-variant">
          {loading && <Loader2 size={14} className="animate-spin" />}
          <span>{totalAcordos} acordos</span>
          <span className="text-on-surface-variant/20">·</span>
          <span className="font-semibold text-on-surface">
            {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
          <span className="text-on-surface-variant/20">·</span>
          <span className="text-emerald-600 font-medium">{concluidos} concluídos</span>
        </div>

        <button
          onClick={() => setNovaNegociacaoAberta(true)}
          className="flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-white font-semibold text-[0.8125rem] hover:bg-primary-container transition-colors shadow-sm"
        >
          <Plus size={16} />
          Nova negociação
        </button>
      </div>

      {/* Kanban Board */}
      <KanbanBoard
        acordos={acordos}
        onCardClick={handleCardClick}
      />

      {/* Drawer do acordo */}
      <AcordoDrawer
        acordo={acordoSelecionado}
        aberto={drawerAberto}
        onFechar={() => setDrawerAberto(false)}
        onAtualizado={handleAcordoAtualizado}
      />

      {/* Drawer nova negociação */}
      <NovaNegociacaoDrawer
        aberto={novaNegociacaoAberta}
        onFechar={() => { setNovaNegociacaoAberta(false); setAlunoInicial(null); }}
        onCriado={() => { handleNovaNegociacaoCriada(); setAlunoInicial(null); }}
        alunoInicial={alunoInicial}
      />
    </div>
  );
}
