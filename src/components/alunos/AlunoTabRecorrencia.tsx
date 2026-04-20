import { useState, useEffect } from 'react';
import type { Aluno } from '../../types/aluno';
import { obterRecorrencia } from '../../services/alunos';
import type { RecorrenciaResponse, CartaoRecorrencia } from '../../services/alunos';
import { CreditCard, Loader2, CheckCircle, XCircle, Calendar, AlertTriangle } from 'lucide-react';

function formatarData(data: string | null) {
  if (!data) return '—';
  return new Date(data).toLocaleDateString('pt-BR');
}

function CartaoCard({ cartao }: { cartao: CartaoRecorrencia }) {
  const ativa = cartao.dataCadastro != null &&
    (cartao.dataInativacao == null || new Date(cartao.dataInativacao) > new Date());

  return (
    <div className={`rounded-xl border p-4 ${ativa ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-gray-50/50'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className={ativa ? 'text-emerald-600' : 'text-gray-400'} />
          <span className="text-[0.8125rem] font-medium text-on-surface">
            {cartao.numeroMascarado || 'Cartao sem numero'}
          </span>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.625rem] font-semibold ${
          ativa ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100'
        }`}>
          {ativa ? <CheckCircle size={10} /> : <XCircle size={10} />}
          {ativa ? 'Ativa' : 'Inativa'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[0.75rem]">
        {cartao.nome && (
          <div>
            <p className="text-gray-400">Titular</p>
            <p className="text-on-surface font-medium">{cartao.nome}</p>
          </div>
        )}
        <div>
          <p className="text-gray-400">Validade</p>
          <p className="text-on-surface font-medium">
            {cartao.mesValidade && cartao.anoValidade ? `${String(cartao.mesValidade).padStart(2, '0')}/${cartao.anoValidade}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-400">Ativado em</p>
          <p className="text-on-surface font-medium">{formatarData(cartao.dataCadastro)}</p>
        </div>
        {cartao.dataInativacao && (
          <div>
            <p className="text-gray-400">Inativado em</p>
            <p className="text-red-600 font-medium">{formatarData(cartao.dataInativacao)}</p>
          </div>
        )}
        {cartao.diaPagamento && (
          <div>
            <p className="text-gray-400">Dia de pagamento</p>
            <p className="text-on-surface font-medium">Dia {cartao.diaPagamento}</p>
          </div>
        )}
        {cartao.motivoInativacao && (
          <div className="col-span-2">
            <p className="text-gray-400">Motivo inativacao</p>
            <p className="text-red-600 font-medium">{cartao.motivoInativacao}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AlunoTabRecorrencia({ aluno }: { aluno: Aluno }) {
  const [data, setData] = useState<RecorrenciaResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    obterRecorrencia(aluno.codigo)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [aluno.codigo]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data || data.totalCadastros === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <CreditCard size={24} className="text-gray-300" />
        <p className="text-[0.8125rem] text-gray-400">Nenhum cartao de recorrencia cadastrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className={`flex items-center gap-3 p-3.5 rounded-xl ${data.recorrenciaAtiva ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
        {data.recorrenciaAtiva ? (
          <>
            <CheckCircle size={18} className="text-emerald-600" />
            <div>
              <p className="text-[0.8125rem] font-medium text-emerald-700">Recorrencia ativa</p>
              <p className="text-[0.6875rem] text-emerald-600">{data.totalCadastros} cadastro(s) encontrado(s)</p>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle size={18} className="text-red-600" />
            <div>
              <p className="text-[0.8125rem] font-medium text-red-700">Sem recorrencia ativa</p>
              <p className="text-[0.6875rem] text-red-600">{data.totalCadastros} cadastro(s) — todos inativos</p>
            </div>
          </>
        )}
      </div>

      {/* Lista de cartoes */}
      {data.cartoes.map(cartao => (
        <CartaoCard key={cartao.codigo} cartao={cartao} />
      ))}
    </div>
  );
}
