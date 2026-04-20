import type { Aluno } from '../../types/aluno';
import Modal from '../ui/Modal';
import StatusBadge from '../ui/StatusBadge';
import { Phone, Mail, BookOpen, Banknote, PhoneForwarded } from 'lucide-react';

interface PopupAlunoProps {
  aluno: Aluno | null;
  aberto: boolean;
  onFechar: () => void;
  onCriarNegociacao: () => void;
  onAgendarCallback: () => void;
}

function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const situacaoLabel: Record<string, string> = {
  AT: 'Ativa',
  CA: 'Cancelada',
  IN: 'Inativa',
  TR: 'Transferida',
};

export default function PopupAluno({ aluno, aberto, onFechar, onCriarNegociacao, onAgendarCallback }: PopupAlunoProps) {
  if (!aluno) return null;

  const fin = (aluno as any).resumoFinanceiro || aluno.financeiro || { parcelasEmAtraso: 0, valorInadimplente: 0, valorPago: 0, parcelasAVencer: 0 };

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Informações do Aluno" largura="max-w-xl">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{aluno.nome}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[0.75rem] text-gray-400">{aluno.matricula}</span>
              <StatusBadge
                texto={situacaoLabel[aluno.situacaoMatricula] || aluno.situacaoMatricula}
                variante={aluno.situacaoMatricula === 'AT' ? 'success' : 'neutral'}
                comDot
              />
              {aluno.serasa && <StatusBadge texto="Serasa" variante="danger" comDot />}
            </div>
          </div>
        </div>

        {/* Acadêmico */}
        <div className="flex items-center gap-4 text-[0.8125rem] text-gray-500">
          <div className="flex items-center gap-1.5">
            <BookOpen size={14} className="text-gray-300" />
            {aluno.cursoNome}
          </div>
          {aluno.turmaIdentificador && (
            <span className="text-gray-300">|</span>
          )}
          {aluno.turmaIdentificador && (
            <span>{aluno.turmaIdentificador}</span>
          )}
        </div>

        {/* Financeiro */}
        <div>
          <p className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium mb-2">Situação Financeira</p>
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-white border border-gray-100">
              <p className="text-xl font-bold text-gray-900">{fin.parcelasEmAtraso}</p>
              <p className="text-[0.6875rem] text-gray-400">em atraso</p>
            </div>
            <div className="p-3 rounded-xl bg-white border border-gray-100">
              <p className={`text-xl font-bold ${fin.valorInadimplente > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                {formatarMoeda(fin.valorInadimplente)}
              </p>
              <p className="text-[0.6875rem] text-gray-400">inadimplente</p>
            </div>
            <div className="p-3 rounded-xl bg-white border border-gray-100">
              <p className="text-xl font-bold text-gray-900">{formatarMoeda(fin.valorPago)}</p>
              <p className="text-[0.6875rem] text-gray-400">pago</p>
            </div>
            <div className="p-3 rounded-xl bg-white border border-gray-100">
              <p className="text-xl font-bold text-gray-900">
                {fin.vencimentoMaisAntigo ? new Date(fin.vencimentoMaisAntigo).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' }) : '—'}
              </p>
              <p className="text-[0.6875rem] text-gray-400">venc. mais antigo</p>
            </div>
          </div>
        </div>

        {/* Contatos */}
        <div>
          <p className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium mb-2">Contatos</p>
          <div className="space-y-1.5">
            {aluno.celular && (
              <div className="flex items-center gap-2 text-[0.8125rem] text-gray-600">
                <Phone size={13} className="text-gray-300" />
                {aluno.celular}
                <span className="text-[0.6875rem] text-gray-300">celular</span>
              </div>
            )}
            {aluno.telefone1 && (
              <div className="flex items-center gap-2 text-[0.8125rem] text-gray-600">
                <Phone size={13} className="text-gray-300" />
                {aluno.telefone1}
                <span className="text-[0.6875rem] text-gray-300">fixo</span>
              </div>
            )}
            {aluno.email && (
              <div className="flex items-center gap-2 text-[0.8125rem] text-gray-600">
                <Mail size={13} className="text-gray-300" />
                {aluno.email}
              </div>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onCriarNegociacao}
            className="flex-1 h-11 rounded-xl bg-gray-900 text-white font-medium text-[0.8125rem] hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <Banknote size={16} />
            Criar Negociação
          </button>
          <button
            onClick={onAgendarCallback}
            className="flex-1 h-11 rounded-xl bg-white border border-gray-100 text-gray-600 font-medium text-[0.8125rem] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <PhoneForwarded size={16} />
            Agendar Retorno
          </button>
        </div>
      </div>
    </Modal>
  );
}
