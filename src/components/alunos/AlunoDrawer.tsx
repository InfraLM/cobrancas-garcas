import { useEffect, useState } from 'react';
import type { Aluno, ResumoFinanceiro } from '../../types/aluno';
import { situacaoMatriculaLabel } from '../../types/aluno';
import type { PausaAtivaResumo } from '../../types/pausaLigacao';
import { motivoPausaLabel } from '../../types/pausaLigacao';
import Drawer from '../ui/Drawer';
import Tabs from '../ui/Tabs';
import StatusBadge, { varianteSituacaoMatricula } from '../ui/StatusBadge';
import AlunoTabPessoal from './AlunoTabPessoal';
import AlunoTabFinanceiro from './AlunoTabFinanceiro';
import AlunoTabEngajamento from './AlunoTabEngajamento';
import AlunoTabPlantoes from './AlunoTabPlantoes';
import AlunoTabSuporte from './AlunoTabSuporte';
import AlunoTabOcorrencias from './AlunoTabOcorrencias';
import AlunoTabRecorrencia from './AlunoTabRecorrencia';
import AlunoTabRepositorio from './AlunoTabRepositorio';
import PausarLigacaoModal from './PausarLigacaoModal';
import { removerPausa } from '../../services/pausasLigacao';
import AlunoTagsSection from '../tags/AlunoTagsSection';
import { User, Wallet, BookOpen, Stethoscope, Headphones, Clock, CreditCard, FolderOpen, Loader2, Pause, Play } from 'lucide-react';

interface AlunoDrawerProps {
  aluno: Aluno | null;
  aberto: boolean;
  onFechar: () => void;
  loading?: boolean;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataCurta(iso: string | null | undefined) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return null; }
}

const tabsConfig = [
  { id: 'pessoal', label: 'Pessoal', icone: User },
  { id: 'financeiro', label: 'Financeiro', icone: Wallet },
  { id: 'recorrencia', label: 'Recorrencia', icone: CreditCard },
  { id: 'ocorrencias', label: 'Ocorrencias', icone: Clock },
  { id: 'repositorio', label: 'Repositório', icone: FolderOpen },
  { id: 'engajamento', label: 'Engajamento', icone: BookOpen },
  { id: 'plantoes', label: 'Plantoes', icone: Stethoscope },
  { id: 'suporte', label: 'Suporte', icone: Headphones },
];

function getFinanceiro(aluno: Aluno): ResumoFinanceiro {
  return aluno.resumoFinanceiro || aluno.financeiro || {
    totalParcelas: 0, parcelasEmAtraso: 0, parcelasAVencer: 0,
    parcelasPagas: 0, parcelasNegociadas: 0, parcelasCanceladas: 0,
    valorEmAberto: 0, valorInadimplente: 0, valorPago: 0,
    vencimentoMaisAntigo: null,
  };
}

function AlunoConteudo({ aluno }: { aluno: Aluno }) {
  const fin = getFinanceiro(aluno);

  // Pausa gerenciada localmente pra refletir ação do agente sem refetch
  const [pausaAtiva, setPausaAtiva] = useState<PausaAtivaResumo | null>(aluno.pausaAtiva ?? null);
  const [modalAberto, setModalAberto] = useState(false);
  const [despausando, setDespausando] = useState(false);

  useEffect(() => { setPausaAtiva(aluno.pausaAtiva ?? null); }, [aluno.codigo, aluno.pausaAtiva]);

  async function handleDespausar() {
    if (!pausaAtiva) return;
    const confirmaSistema = pausaAtiva.origem === 'SISTEMA'
      ? confirm('Esta pausa foi criada automaticamente por um acordo em negociação. Deseja realmente despausar e permitir ligações?')
      : true;
    if (!confirmaSistema) return;

    setDespausando(true);
    try {
      await removerPausa(pausaAtiva.id, 'Despausado manualmente no perfil do aluno');
      setPausaAtiva(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao despausar');
    } finally {
      setDespausando(false);
    }
  }

  return (
    <>
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-lg font-bold text-gray-900">{aluno.nome}</h2>
        <p className="text-[0.8125rem] text-gray-400 mt-0.5">{aluno.cursoNome || '—'}</p>

        <div className="flex items-center gap-3 mt-2 text-[0.8125rem] flex-wrap">
          {aluno.situacaoMatricula && (
            <StatusBadge
              texto={situacaoMatriculaLabel[aluno.situacaoMatricula] || aluno.situacaoMatricula}
              variante={varianteSituacaoMatricula(aluno.situacaoMatricula)}
              comDot
            />
          )}
          {aluno.turmaIdentificador && (
            <span className="text-gray-400">{aluno.turmaIdentificador}</span>
          )}
          {aluno.serasa && <StatusBadge texto="Serasa" variante="danger" comDot />}
          {aluno.naoEnviarMensagemCobranca && <StatusBadge texto="Nao cobrar" variante="warning" />}
          {pausaAtiva && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[0.75rem] font-medium"
              title={[
                `Motivo: ${motivoPausaLabel[pausaAtiva.motivo]}`,
                pausaAtiva.pausaAte ? `Até ${formatarDataCurta(pausaAtiva.pausaAte)}` : 'Indefinida',
                pausaAtiva.pausadoPorNome ? `Por ${pausaAtiva.pausadoPorNome}` : null,
                pausaAtiva.origem === 'SISTEMA' ? 'Pausa automática (acordo ativo)' : null,
              ].filter(Boolean).join(' · ')}
            >
              <Pause size={12} />
              Pausado
            </span>
          )}
        </div>

        {/* Acao de pausar/despausar */}
        <div className="mt-3">
          {pausaAtiva ? (
            <button
              type="button"
              onClick={handleDespausar}
              disabled={despausando}
              className="inline-flex items-center gap-1.5 text-[0.8125rem] text-emerald-700 hover:text-emerald-800 hover:underline disabled:opacity-50"
            >
              {despausando ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Despausar ligações
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="inline-flex items-center gap-1.5 text-[0.8125rem] text-gray-600 hover:text-gray-800 hover:underline"
            >
              <Pause size={12} />
              Pausar ligações
            </button>
          )}
        </div>

        {fin.valorInadimplente > 0 ? (
          <div className="mt-4 flex items-center justify-between py-3 px-4 bg-red-50/50 rounded-xl">
            <div>
              <p className="text-[0.625rem] uppercase tracking-wider text-red-400 font-medium">Valor inadimplente</p>
              <p className="text-lg font-bold text-red-600">{formatarMoeda(fin.valorInadimplente)}</p>
            </div>
            <div className="text-right">
              <p className="text-[0.625rem] uppercase tracking-wider text-red-400 font-medium">Parcelas</p>
              <p className="text-lg font-bold text-red-600">{fin.parcelasEmAtraso}</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 py-3 px-4 bg-gray-50 rounded-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[0.8125rem] text-gray-600">Adimplente</span>
            <span className="text-[0.8125rem] text-gray-400 ml-auto">{formatarMoeda(fin.valorPago)} pagos</span>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100">
          <AlunoTagsSection pessoaCodigo={aluno.codigo} />
        </div>
      </div>

      <Tabs tabs={tabsConfig}>
        {(tabAtivo) => {
          switch (tabAtivo) {
            case 'pessoal': return <AlunoTabPessoal aluno={aluno} />;
            case 'financeiro': return <AlunoTabFinanceiro aluno={aluno} />;
            case 'recorrencia': return <AlunoTabRecorrencia aluno={aluno} />;
            case 'ocorrencias': return <AlunoTabOcorrencias aluno={aluno} />;
            case 'repositorio': return <AlunoTabRepositorio codigo={aluno.codigo} />;
            case 'engajamento': return <AlunoTabEngajamento aluno={aluno} />;
            case 'plantoes': return <AlunoTabPlantoes aluno={aluno} />;
            case 'suporte': return <AlunoTabSuporte aluno={aluno} />;
            default: return null;
          }
        }}
      </Tabs>

      <PausarLigacaoModal
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        pessoaCodigo={aluno.codigo}
        pessoaNome={aluno.nome}
        onPausada={(pausa) => setPausaAtiva({
          id: pausa.id,
          motivo: pausa.motivo,
          observacao: pausa.observacao,
          origem: pausa.origem,
          acordoId: pausa.acordoId,
          pausaAte: pausa.pausaAte,
          pausadoEm: pausa.pausadoEm,
          pausadoPorNome: pausa.pausadoPorNome,
        })}
      />
    </>
  );
}

export default function AlunoDrawer({ aluno, aberto, onFechar, loading }: AlunoDrawerProps) {
  return (
    <Drawer aberto={aberto} onFechar={onFechar} largura="w-[540px]">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : !aluno ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-[0.8125rem] text-on-surface-variant">Aluno nao encontrado</p>
        </div>
      ) : (
        <AlunoConteudo aluno={aluno} />
      )}
    </Drawer>
  );
}
