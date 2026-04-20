import type { Aluno, ResumoFinanceiro } from '../../types/aluno';
import { situacaoMatriculaLabel } from '../../types/aluno';
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
import { User, Wallet, BookOpen, Stethoscope, Headphones, Clock, CreditCard, FolderOpen, Loader2 } from 'lucide-react';

interface AlunoDrawerProps {
  aluno: Aluno | null;
  aberto: boolean;
  onFechar: () => void;
  loading?: boolean;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

  return (
    <>
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-lg font-bold text-gray-900">{aluno.nome}</h2>
        <p className="text-[0.8125rem] text-gray-400 mt-0.5">{aluno.cursoNome || '—'}</p>

        <div className="flex items-center gap-3 mt-2 text-[0.8125rem]">
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
