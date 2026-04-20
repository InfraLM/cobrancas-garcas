import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Aluno } from '../../types/aluno';
import { listarOcorrencias } from '../../services/alunos';
import { X, Phone, FileText, ExternalLink, AlertTriangle, GraduationCap, DollarSign, Clock, UserX } from 'lucide-react';

interface PainelAlunoProps {
  aluno: Aluno | null;
  contatoNumero: string;
  onFechar: () => void;
}

const TIPO_COR: Record<string, string> = {
  LIGACAO: 'bg-blue-400',
  WHATSAPP: 'bg-green-400',
  CONVERSA_CRIADA: 'bg-green-400',
  CONVERSA_ENCERRADA: 'bg-gray-400',
  TICKET: 'bg-violet-400',
  PLANTAO: 'bg-amber-400',
  SERASA: 'bg-red-400',
  NEGOCIACAO: 'bg-indigo-400',
  CONVERSAO_RECORRENCIA: 'bg-emerald-400',
};

function OcorrenciasRecentes({ codigo }: { codigo: number }) {
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);

  useEffect(() => {
    listarOcorrencias(codigo)
      .then(data => setOcorrencias(data.slice(0, 5)))
      .catch(() => setOcorrencias([]));
  }, [codigo]);

  if (ocorrencias.length === 0) return null;

  return (
    <div className="px-4 py-3">
      <span className="text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wide">Ocorrências recentes</span>
      <div className="flex flex-col gap-2 mt-2">
        {ocorrencias.map((oc) => (
          <div key={oc.id} className="flex items-start gap-2">
            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${TIPO_COR[oc.tipo] || 'bg-gray-400'}`} />
            <div>
              <p className="text-[0.6875rem] text-gray-700">{oc.descricao}</p>
              <p className="text-[0.5625rem] text-gray-400">
                {new Date(oc.data || oc.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const situacaoLabels: Record<string, { label: string; cor: string }> = {
  AT: { label: 'Ativo', cor: 'text-emerald-600 bg-emerald-50' },
  CA: { label: 'Cancelado', cor: 'text-red-600 bg-red-50' },
  IN: { label: 'Inativo', cor: 'text-gray-600 bg-gray-100' },
  TR: { label: 'Trancado', cor: 'text-amber-600 bg-amber-50' },
};

function formatarValor(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(data: string): string {
  const d = new Date(data + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function diasAtraso(data: string): number {
  const d = new Date(data + 'T00:00:00');
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((hoje.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function PainelAluno({ aluno, contatoNumero, onFechar }: PainelAlunoProps) {
  const navigate = useNavigate();

  // Not linked
  if (!aluno) {
    return (
      <div className="flex flex-col h-full bg-white border-l border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-[0.8125rem] font-semibold text-gray-900">Contexto</span>
          <button onClick={onFechar} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <UserX size={20} className="text-gray-400" />
          </div>
          <div>
            <p className="text-[0.8125rem] font-medium text-gray-700 mb-1">Aluno não vinculado</p>
            <p className="text-[0.6875rem] text-gray-400">
              O número {contatoNumero} não foi encontrado no SEI.
            </p>
          </div>
          <button className="mt-2 h-8 px-4 rounded-lg bg-gray-900 text-white text-[0.75rem] font-medium hover:bg-gray-800 transition-colors">
            Vincular manualmente
          </button>
        </div>
      </div>
    );
  }

  const sit = situacaoLabels[aluno.situacaoMatricula || ''] || { label: aluno.situacaoMatricula || '—', cor: 'text-gray-600 bg-gray-100' };
  const fin = (aluno as any).resumoFinanceiro || aluno.financeiro || { parcelasEmAtraso: 0, valorInadimplente: 0, valorPago: 0 };
  const temAtraso = fin.parcelasEmAtraso > 0;

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-[0.8125rem] font-semibold text-gray-900">Contexto do aluno</span>
        <button onClick={onFechar} className="p-1 rounded text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Student identity */}
        <div className="px-4 py-4 border-b border-gray-50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-[0.75rem] font-medium text-gray-400">
              {aluno.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
            </div>
            <div className="min-w-0">
              <p className="text-[0.8125rem] font-semibold text-gray-900 leading-tight">
                {aluno.nome.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}
              </p>
              <p className="text-[0.6875rem] text-gray-400 mt-0.5">{aluno.matricula}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-[0.625rem] font-medium px-2 py-0.5 rounded-full ${sit.cor}`}>
                  {sit.label}
                </span>
                {aluno.serasa && (
                  <span className="flex items-center gap-0.5 text-[0.625rem] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                    <AlertTriangle size={9} />
                    Serasa
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Course info */}
        <div className="px-4 py-3 border-b border-gray-50">
          <div className="flex items-center gap-1.5 mb-2">
            <GraduationCap size={13} className="text-gray-400" />
            <span className="text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wide">Acadêmico</span>
          </div>
          <p className="text-[0.75rem] text-gray-800">{aluno.cursoNome}</p>
          {aluno.turmaIdentificador && (
            <p className="text-[0.6875rem] text-gray-400 mt-0.5">Turma {aluno.turmaIdentificador}</p>
          )}
          {aluno.engajamento && (
            <div className="flex items-center gap-3 mt-2">
              <div>
                <p className="text-[0.625rem] text-gray-400">Aulas</p>
                <p className="text-[0.75rem] font-medium text-gray-800">
                  {aluno.engajamento.aulasAssistidas}
                  <span className="text-gray-400 font-normal"> ({Math.round((aluno.engajamento.aulasTotalPorcentagem ?? 0) * 100)}%)</span>
                </p>
              </div>
              <div>
                <p className="text-[0.625rem] text-gray-400">Última aula</p>
                <p className="text-[0.75rem] font-medium text-gray-800">
                  {aluno.engajamento.diasDesdeUltimaAula}d atrás
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Financial summary */}
        <div className="px-4 py-3 border-b border-gray-50">
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign size={13} className="text-gray-400" />
            <span className="text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wide">Financeiro</span>
          </div>

          {temAtraso ? (
            <div className="bg-red-50/60 rounded-lg p-3 mb-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[0.6875rem] text-red-500">Inadimplente</span>
                <span className="text-[1rem] font-bold text-red-700">{formatarValor(fin.valorInadimplente)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[0.625rem] text-red-400">{fin.parcelasEmAtraso} parcela{fin.parcelasEmAtraso > 1 ? 's' : ''} em atraso</span>
                {fin.vencimentoMaisAntigo && (
                  <span className="text-[0.625rem] text-red-400">
                    {diasAtraso(fin.vencimentoMaisAntigo)}d atraso
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50/60 rounded-lg p-3 mb-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[0.6875rem] text-emerald-500">Em dia</span>
                <span className="text-[1rem] font-bold text-emerald-700">{formatarValor(fin.valorPago)}</span>
              </div>
              <span className="text-[0.625rem] text-emerald-400">{fin.parcelasPagas} parcelas pagas</span>
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="text-center">
              <p className="text-[0.625rem] text-gray-400">Pagas</p>
              <p className="text-[0.8125rem] font-semibold text-gray-800">{fin.parcelasPagas}</p>
            </div>
            <div className="text-center">
              <p className="text-[0.625rem] text-gray-400">A vencer</p>
              <p className="text-[0.8125rem] font-semibold text-gray-800">{fin.parcelasAVencer}</p>
            </div>
            <div className="text-center">
              <p className="text-[0.625rem] text-gray-400">Negociadas</p>
              <p className="text-[0.8125rem] font-semibold text-gray-800">{fin.parcelasNegociadas}</p>
            </div>
          </div>

          {fin.vencimentoMaisAntigo && (
            <div className="flex items-center gap-1 mt-2 text-[0.625rem] text-gray-400">
              <Clock size={10} />
              Vencimento mais antigo: {formatarData(fin.vencimentoMaisAntigo)}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="px-4 py-3 border-b border-gray-50">
          <span className="text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wide">Ações rápidas</span>
          <div className="flex flex-col gap-1.5 mt-2">
            <button onClick={() => {
              const digits = (aluno.celular || '').replace(/\D/g, '');
              if (digits) navigate(`/atendimento/ligacoes?telefone=${digits}`);
            }} className="flex items-center gap-2 h-8 px-3 rounded-lg bg-gray-50 text-[0.75rem] text-gray-700 hover:bg-gray-100 transition-colors">
              <Phone size={13} className="text-gray-400" />
              Ligar para o aluno
            </button>
            <button onClick={() => navigate(`/workflow/negociacoes?novaComAluno=${aluno.codigo}`)}
              className="flex items-center gap-2 h-8 px-3 rounded-lg bg-gray-50 text-[0.75rem] text-gray-700 hover:bg-gray-100 transition-colors">
              <FileText size={13} className="text-gray-400" />
              Criar negociação
            </button>
            <button onClick={() => navigate(`/alunos?codigo=${aluno.codigo}`)}
              className="flex items-center gap-2 h-8 px-3 rounded-lg bg-gray-50 text-[0.75rem] text-gray-700 hover:bg-gray-100 transition-colors">
              <ExternalLink size={13} className="text-gray-400" />
              Ver perfil completo
            </button>
          </div>
        </div>

        {/* Ocorrencias reais */}
        <OcorrenciasRecentes codigo={aluno.codigo} />
      </div>
    </div>
  );
}
