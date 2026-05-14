import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { RegraSegmentacao } from '../types/segmentacao';
import { listarRegras, listarRegrasComFiltros, excluirRegra, executarRegra, subirParaCampanha } from '../services/segmentacao';
import type { SubirCampanhaResult, TituloDaSegmentacao } from '../services/segmentacao';
import { removerEmMassa, criarPausa, removerPausa } from '../services/pausasLigacao';
import RegrasTable from '../components/segmentacao/RegrasTable';
import NovaRegraModal from '../components/segmentacao/NovaRegraModal';
import AlunosTable from '../components/alunos/AlunosTable';
import TitulosDaSegmentacaoTable from '../components/segmentacao/TitulosDaSegmentacaoTable';
import SearchInput from '../components/ui/SearchInput';
import { Plus, Loader2, ArrowLeft, Pencil, Upload, CheckCircle, FileDown, Pause, Play, User, Receipt } from 'lucide-react';
import type { AlunoListItem } from '../services/alunos';
import ExportarSegmentacaoModal from '../components/segmentacao/ExportarSegmentacaoModal';

export default function SegmentacaoPage() {
  const { user } = useAuth();
  const podeEditarRegra = useCallback(
    (regra: RegraSegmentacao) => user?.role === 'ADMIN' || regra.criadoPor === user?.id,
    [user]
  );
  const [regras, setRegras] = useState<RegraSegmentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [novaRegraAberta, setNovaRegraAberta] = useState(false);
  const [regraEditando, setRegraEditando] = useState<RegraSegmentacao | null>(null);

  const [regraAtiva, setRegraAtiva] = useState<RegraSegmentacao | null>(null);
  const [resultadoAlunos, setResultadoAlunos] = useState<AlunoListItem[]>([]);
  const [resultadoTitulos, setResultadoTitulos] = useState<TituloDaSegmentacao[]>([]);
  const [resultadoTotal, setResultadoTotal] = useState(0);
  const [resultadoValor, setResultadoValor] = useState(0);
  const [resultadoAlunosUnicos, setResultadoAlunosUnicos] = useState(0);
  const [executando, setExecutando] = useState(false);
  const [subindo, setSubindo] = useState(false);
  const [subidoResult, setSubidoResult] = useState<SubirCampanhaResult | null>(null);
  const [despausandoMassa, setDespausandoMassa] = useState(false);
  const [linhaMexendo, setLinhaMexendo] = useState<number | null>(null);
  const [mostrarEmbutidas, setMostrarEmbutidas] = useState(false);

  async function toggleLinhaPausa(aluno: AlunoListItem) {
    if (linhaMexendo === aluno.codigo) return;
    setLinhaMexendo(aluno.codigo);
    try {
      if (aluno.pausaAtiva) {
        await removerPausa(aluno.pausaAtiva.id, 'Despausado na tela de segmentacao');
        setResultadoAlunos((prev) => prev.map((a) => a.codigo === aluno.codigo ? { ...a, pausaAtiva: null } : a));
      } else {
        const pausa = await criarPausa({ pessoaCodigo: aluno.codigo, motivo: 'AGENTE_DECISAO' });
        setResultadoAlunos((prev) => prev.map((a) => a.codigo === aluno.codigo ? {
          ...a,
          pausaAtiva: {
            id: pausa.id,
            motivo: pausa.motivo,
            origem: pausa.origem,
            pausaAte: pausa.pausaAte,
            pausadoEm: pausa.pausadoEm,
            pausadoPorNome: pausa.pausadoPorNome,
          },
        } : a));
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro na acao');
    } finally {
      setLinhaMexendo(null);
    }
  }
  const [exportarAberto, setExportarAberto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = mostrarEmbutidas
        ? await listarRegrasComFiltros({ incluirEmbutidas: true })
        : await listarRegras();
      setRegras(data);
    } catch (err) {
      console.error('Erro ao carregar regras:', err);
    } finally {
      setLoading(false);
    }
  }, [mostrarEmbutidas]);

  useEffect(() => { carregar(); }, [carregar]);

  const regrasFiltradas = regras.filter(r =>
    !busca || r.nome.toLowerCase().includes(busca.toLowerCase()) || r.descricao?.toLowerCase().includes(busca.toLowerCase())
  );

  async function handleExecutar(regra: RegraSegmentacao) {
    setRegraAtiva(regra);
    setExecutando(true);
    try {
      const res = await executarRegra(regra.id, { limit: 50 });
      if (res.tipo === 'TITULO') {
        setResultadoTitulos(res.data as TituloDaSegmentacao[]);
        setResultadoAlunos([]);
        setResultadoAlunosUnicos(res.alunosUnicos || 0);
      } else {
        setResultadoAlunos(res.data as AlunoListItem[]);
        setResultadoTitulos([]);
        setResultadoAlunosUnicos(res.totalGeral);
      }
      setResultadoTotal(res.totalGeral);
      setResultadoValor(res.valorTotal);
      carregar();
    } catch (err) {
      console.error('Erro ao executar regra:', err);
      alert(err instanceof Error ? err.message : 'Erro');
    } finally {
      setExecutando(false);
    }
  }

  async function handleExcluir(regra: RegraSegmentacao) {
    if (!confirm(`Excluir regra "${regra.nome}"?`)) return;
    try {
      await excluirRegra(regra.id);
      carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleSalva() {
    setNovaRegraAberta(false);
    setRegraEditando(null);
    await carregar();
    // Se estava vendo resultado de uma regra, atualizar o nome/dados
    if (regraAtiva) {
      const atualizadas = await listarRegras().catch(() => []);
      const atualizada = atualizadas.find(r => r.id === regraAtiva.id);
      if (atualizada) setRegraAtiva(atualizada);
    }
  }

  if (regraAtiva) {
    const tipoRegra = regraAtiva.tipo || 'ALUNO';
    const isTitulo = tipoRegra === 'TITULO';
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setRegraAtiva(null); setResultadoAlunos([]); setResultadoTitulos([]); }} className="flex items-center gap-1 text-[0.8125rem] text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} /> Voltar
          </button>
          <h2 className="text-lg font-semibold text-on-surface">{regraAtiva.nome}</h2>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.6875rem] font-medium ${isTitulo ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}>
            {isTitulo ? <Receipt size={11} /> : <User size={11} />}
            {isTitulo ? 'Por título' : 'Por aluno'}
          </span>
          {podeEditarRegra(regraAtiva) && (
            <button onClick={() => { setRegraEditando(regraAtiva); setNovaRegraAberta(true); }}
              className="flex items-center gap-1 text-[0.75rem] text-gray-400 hover:text-gray-700 transition-colors ml-2">
              <Pencil size={13} /> Editar
            </button>
          )}
          <button
            onClick={async () => {
              const msg = isTitulo
                ? `Subir ${resultadoAlunosUnicos} aluno(s) (${resultadoTotal} títulos) para a campanha de ligação em massa?`
                : `Subir ${resultadoTotal} alunos para a campanha de ligação em massa?`;
              if (!confirm(msg)) return;
              setSubindo(true);
              setSubidoResult(null);
              try {
                const res = await subirParaCampanha(regraAtiva.id);
                setSubidoResult(res);
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Erro ao subir campanha');
              } finally {
                setSubindo(false);
              }
            }}
            disabled={subindo || resultadoTotal === 0}
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-white text-[0.75rem] font-medium hover:bg-primary-container transition-colors disabled:opacity-40 ml-auto"
          >
            {subindo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Subir para campanha
          </button>
          <button
            onClick={() => setExportarAberto(true)}
            disabled={resultadoTotal === 0}
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-emerald-600 text-white text-[0.75rem] font-medium hover:bg-emerald-700 transition-colors disabled:opacity-40"
          >
            <FileDown size={13} />
            Exportar lista
          </button>
        </div>

        <div className="flex items-center gap-4 text-[0.8125rem]">
          {isTitulo ? (
            <>
              <span className="text-on-surface font-medium">{resultadoTotal} títulos</span>
              <span className="text-gray-500">{resultadoAlunosUnicos} aluno{resultadoAlunosUnicos !== 1 ? 's' : ''} únicos</span>
              <span className="text-red-600 font-medium">
                {resultadoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} total
              </span>
            </>
          ) : (
            <>
              <span className="text-on-surface font-medium">{resultadoTotal} alunos</span>
              <span className="text-red-600 font-medium">
                {resultadoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} inadimplente
              </span>
            </>
          )}
          {executando && <Loader2 size={16} className="animate-spin text-gray-400" />}
        </div>

        {subidoResult && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle size={18} className="text-emerald-600" />
            <div className="text-[0.8125rem]">
              <p className="font-medium text-emerald-700">
                {(subidoResult.totalEnviados ?? subidoResult.totalSubidos)} contatos enviados para a campanha de massa
              </p>
              <p className="text-[0.6875rem] text-emerald-600">
                {subidoResult.totalEncontrados ?? '—'} encontrados
                {subidoResult.totalPausados ? ` · ${subidoResult.totalPausados} pausados (excluídos)` : ''}
                {subidoResult.totalSemTelefone ? ` · ${subidoResult.totalSemTelefone} sem telefone` : ''}
              </p>
            </div>
          </div>
        )}

        {regraAtiva.descricao && (
          <p className="text-[0.8125rem] text-on-surface-variant">{regraAtiva.descricao}</p>
        )}

        {(() => {
          // Banner de pausa so aplica ao modo ALUNO
          if (isTitulo) return null;
          const pausadosNoPreview = resultadoAlunos.filter(a => a.pausaAtiva);
          if (pausadosNoPreview.length === 0) return null;
          return (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <Pause size={16} className="text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[0.8125rem] font-medium text-amber-800">
                  {pausadosNoPreview.length} aluno{pausadosNoPreview.length > 1 ? 's' : ''} pausado{pausadosNoPreview.length > 1 ? 's' : ''} (nesta página)
                </p>
                <p className="text-[0.6875rem] text-amber-700">
                  Pausados não recebem ligação em massa. Continuam contabilizados nos totais.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const codigos = pausadosNoPreview.map(a => a.codigo);
                  if (!confirm(`Despausar ${codigos.length} aluno(s)? Eles voltarão a receber ligações.`)) return;
                  setDespausandoMassa(true);
                  try {
                    const r = await removerEmMassa(codigos, 'Despausa em massa na segmentação');
                    alert(`${r.removidas} pausa(s) removida(s). Reexecute a regra para atualizar a lista.`);
                    handleExecutar(regraAtiva);
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Erro ao despausar');
                  } finally {
                    setDespausandoMassa(false);
                  }
                }}
                disabled={despausandoMassa}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-600 text-white text-[0.75rem] font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {despausandoMassa ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                Despausar {pausadosNoPreview.length}
              </button>
            </div>
          );
        })()}

        {isTitulo ? (
          <TitulosDaSegmentacaoTable titulos={resultadoTitulos} />
        ) : (
        <AlunosTable
          alunos={resultadoAlunos}
          onSelecionar={() => {}}
          renderAcoes={(aluno) => {
            const pausado = Boolean(aluno.pausaAtiva);
            const isLoading = linhaMexendo === aluno.codigo;
            return (
              <button
                type="button"
                onClick={() => toggleLinhaPausa(aluno)}
                disabled={isLoading}
                title={pausado ? 'Despausar ligacoes deste aluno' : 'Pausar ligacoes deste aluno'}
                className={`inline-flex items-center gap-1 h-7 px-2 rounded-md text-[0.6875rem] font-medium transition-colors disabled:opacity-50 ${
                  pausado
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-gray-50 text-gray-500 hover:bg-amber-50 hover:text-amber-700'
                }`}
              >
                {isLoading
                  ? <Loader2 size={11} className="animate-spin" />
                  : pausado
                    ? <><Play size={11} /> Despausar</>
                    : <><Pause size={11} /> Pausar</>
                }
              </button>
            );
          }}
        />
        )}

        <NovaRegraModal aberto={novaRegraAberta} onFechar={() => { setNovaRegraAberta(false); setRegraEditando(null); }} onSalva={handleSalva} regraEditando={regraEditando} />

        {regraAtiva && (
          <ExportarSegmentacaoModal
            aberto={exportarAberto}
            onFechar={() => setExportarAberto(false)}
            regraId={regraAtiva.id}
            nomeRegra={regraAtiva.nome}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-72">
          <SearchInput valor={busca} onChange={setBusca} placeholder="Buscar regra..." />
        </div>
        <label className="flex items-center gap-1.5 text-[0.75rem] text-gray-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mostrarEmbutidas}
            onChange={e => setMostrarEmbutidas(e.target.checked)}
            className="w-3.5 h-3.5"
          />
          Mostrar embutidas em régua
        </label>
        <span className="text-[0.8125rem] text-gray-400 ml-auto">{regrasFiltradas.length} regras</span>
        <button
          onClick={() => setNovaRegraAberta(true)}
          className="flex items-center gap-2 h-10 px-5 rounded-xl bg-gray-900 text-white font-medium text-[0.8125rem] hover:bg-gray-800 transition-colors"
        >
          <Plus size={16} /> Nova regra
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : (
        <RegrasTable regras={regrasFiltradas} onSelecionar={handleExecutar} onEditar={(r) => { setRegraEditando(r); setNovaRegraAberta(true); }} onExcluir={handleExcluir} podeEditar={podeEditarRegra} />
      )}

      <NovaRegraModal aberto={novaRegraAberta} onFechar={() => { setNovaRegraAberta(false); setRegraEditando(null); }} onSalva={handleSalva} regraEditando={regraEditando} />
    </div>
  );
}
