import { useState, useEffect, useCallback } from 'react';
import type { RegraSegmentacao } from '../types/segmentacao';
import { listarRegras, excluirRegra, executarRegra, subirParaCampanha } from '../services/segmentacao';
import RegrasTable from '../components/segmentacao/RegrasTable';
import NovaRegraModal from '../components/segmentacao/NovaRegraModal';
import AlunosTable from '../components/alunos/AlunosTable';
import SearchInput from '../components/ui/SearchInput';
import { Plus, Loader2, ArrowLeft, Pencil, Upload, CheckCircle, FileDown } from 'lucide-react';
import type { AlunoListItem } from '../services/alunos';
import ExportarSegmentacaoModal from '../components/segmentacao/ExportarSegmentacaoModal';

export default function SegmentacaoPage() {
  const [regras, setRegras] = useState<RegraSegmentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [novaRegraAberta, setNovaRegraAberta] = useState(false);
  const [regraEditando, setRegraEditando] = useState<RegraSegmentacao | null>(null);

  const [regraAtiva, setRegraAtiva] = useState<RegraSegmentacao | null>(null);
  const [resultado, setResultado] = useState<AlunoListItem[]>([]);
  const [resultadoTotal, setResultadoTotal] = useState(0);
  const [resultadoValor, setResultadoValor] = useState(0);
  const [executando, setExecutando] = useState(false);
  const [subindo, setSubindo] = useState(false);
  const [subidoResult, setSubidoResult] = useState<{ totalSubidos: number; totalSemTelefone: number } | null>(null);
  const [exportarAberto, setExportarAberto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listarRegras();
      setRegras(data);
    } catch (err) {
      console.error('Erro ao carregar regras:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const regrasFiltradas = regras.filter(r =>
    !busca || r.nome.toLowerCase().includes(busca.toLowerCase()) || r.descricao?.toLowerCase().includes(busca.toLowerCase())
  );

  async function handleExecutar(regra: RegraSegmentacao) {
    setRegraAtiva(regra);
    setExecutando(true);
    try {
      const res = await executarRegra(regra.id, { limit: 50 });
      setResultado(res.data);
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
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setRegraAtiva(null); setResultado([]); }} className="flex items-center gap-1 text-[0.8125rem] text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} /> Voltar
          </button>
          <h2 className="text-lg font-semibold text-on-surface">{regraAtiva.nome}</h2>
          <button onClick={() => { setRegraEditando(regraAtiva); setNovaRegraAberta(true); }}
            className="flex items-center gap-1 text-[0.75rem] text-gray-400 hover:text-gray-700 transition-colors ml-2">
            <Pencil size={13} /> Editar
          </button>
          <button
            onClick={async () => {
              if (!confirm(`Subir ${resultadoTotal} alunos para a campanha de ligacao em massa?`)) return;
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
          <span className="text-on-surface font-medium">{resultadoTotal} alunos</span>
          <span className="text-red-600 font-medium">
            {resultadoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} inadimplente
          </span>
          {executando && <Loader2 size={16} className="animate-spin text-gray-400" />}
        </div>

        {subidoResult && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle size={18} className="text-emerald-600" />
            <div>
              <p className="text-[0.8125rem] font-medium text-emerald-700">
                {subidoResult.totalSubidos} contatos subidos para a campanha de massa
              </p>
              {subidoResult.totalSemTelefone > 0 && (
                <p className="text-[0.6875rem] text-emerald-600">
                  {subidoResult.totalSemTelefone} alunos sem telefone (nao incluidos)
                </p>
              )}
            </div>
          </div>
        )}

        {regraAtiva.descricao && (
          <p className="text-[0.8125rem] text-on-surface-variant">{regraAtiva.descricao}</p>
        )}

        <AlunosTable alunos={resultado} onSelecionar={() => {}} />

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
        <RegrasTable regras={regrasFiltradas} onSelecionar={handleExecutar} onEditar={(r) => { setRegraEditando(r); setNovaRegraAberta(true); }} onExcluir={handleExcluir} />
      )}

      <NovaRegraModal aberto={novaRegraAberta} onFechar={() => { setNovaRegraAberta(false); setRegraEditando(null); }} onSalva={handleSalva} regraEditando={regraEditando} />
    </div>
  );
}
