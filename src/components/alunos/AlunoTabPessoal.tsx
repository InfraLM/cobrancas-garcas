import { useNavigate } from 'react-router-dom';
import type { Aluno } from '../../types/aluno';
import StatusBadge from '../ui/StatusBadge';
import { PhoneCall, MessageCircle } from 'lucide-react';
import { useLigacoesContext } from '../../contexts/LigacoesContext';

function formatarCpf(cpf?: string | null) {
  if (!cpf) return '—';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatarData(data?: string) {
  if (!data) return '—';
  return new Date(data).toLocaleDateString('pt-BR');
}

function Info({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div>
      <p className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium">{label}</p>
      <p className="text-[0.8125rem] text-gray-900 mt-0.5">{valor || '—'}</p>
    </div>
  );
}

function extrairDigitos(tel?: string | null): string {
  if (!tel) return '';
  return tel.replace(/\D/g, '');
}

function BotaoLigar({ telefone }: { telefone?: string | null }) {
  const lig = useLigacoesContext();
  const navigate = useNavigate();
  const digits = extrairDigitos(telefone);
  if (!digits || digits.length < 10) return null;

  const ramalAtivo = lig.sessao === 'ONLINE';

  function handleClick() {
    if (ramalAtivo) {
      // Ramal ativo: liga direto sem navegar (ilha aparece)
      lig.iniciarLigacaoComTelefone(digits);
    } else {
      // Ramal inativo: navega para tela de ligacoes
      navigate(`/atendimento/ligacoes?telefone=${digits}`);
    }
  }

  return (
    <button
      onClick={handleClick}
      title={ramalAtivo ? 'Ligar agora' : 'Ir para ligacoes'}
      className={`inline-flex items-center gap-1 ml-2 h-6 px-2 rounded-md text-[0.6875rem] font-medium transition-colors ${
        ramalAtivo
          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          : 'bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600'
      }`}
    >
      <PhoneCall size={11} />
      {ramalAtivo ? 'Ligar' : 'Ligar'}
    </button>
  );
}

function BotaoWhatsApp({ telefone }: { telefone?: string | null }) {
  const navigate = useNavigate();
  const digits = extrairDigitos(telefone);
  if (!digits || digits.length < 10) return null;

  return (
    <button
      onClick={() => navigate(`/atendimento/conversas?telefone=${digits}`)}
      title="Abrir conversa no WhatsApp"
      className="inline-flex items-center gap-1 ml-1 h-6 px-2 rounded-md bg-gray-50 text-gray-500 text-[0.6875rem] font-medium hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
    >
      <MessageCircle size={11} />
      WhatsApp
    </button>
  );
}

export default function AlunoTabPessoal({ aluno }: { aluno: Aluno }) {
  const ec: Record<string, string> = { SO: 'Solteiro(a)', CA: 'Casado(a)', DI: 'Divorciado(a)', VI: 'Viúvo(a)' };

  return (
    <div className="space-y-5">
      {/* Alertas */}
      <div className="flex items-center gap-3 text-[0.8125rem]">
        {aluno.serasa && <StatusBadge texto="Serasa" variante="danger" comDot />}
        {aluno.bloquearContatoCrm && <StatusBadge texto="Bloqueio CRM" variante="warning" comDot />}
        {aluno.naoEnviarMensagemCobranca && <StatusBadge texto="Não cobrar" variante="warning" />}
        {!aluno.serasa && !aluno.bloquearContatoCrm && !aluno.naoEnviarMensagemCobranca && (
          <StatusBadge texto="Sem restrições" variante="success" comDot />
        )}
      </div>

      {/* Identificação */}
      <div>
        <p className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium mb-3">Identificação</p>
        <div className="grid grid-cols-2 gap-4 bg-white rounded-xl border border-gray-100 p-4">
          <Info label="CPF" valor={formatarCpf(aluno.cpf)} />
          <Info label="RG" valor={aluno.rg} />
          <Info label="Sexo" valor={aluno.sexo === 'M' ? 'Masculino' : aluno.sexo === 'F' ? 'Feminino' : aluno.sexo} />
          <Info label="Estado civil" valor={ec[aluno.estadoCivil || ''] || aluno.estadoCivil} />
          <Info label="Data de nascimento" valor={formatarData(aluno.dataNascimento)} />
          <Info label="Cadastro no SEI" valor={formatarData(aluno.dataCriacao)} />
        </div>
      </div>

      {/* Contato */}
      <div>
        <p className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium mb-3">Contato</p>
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium">Celular</p>
              <p className="text-[0.8125rem] text-gray-900 mt-0.5">{aluno.celular || '—'}</p>
            </div>
            <BotaoLigar telefone={aluno.celular} />
            <BotaoWhatsApp telefone={aluno.celular} />
          </div>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium">Telefone</p>
              <p className="text-[0.8125rem] text-gray-900 mt-0.5">{aluno.telefone1 || '—'}</p>
            </div>
            <BotaoLigar telefone={aluno.telefone1} />
          </div>
          <div>
            <p className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium">E-mail</p>
            <p className="text-[0.8125rem] text-gray-900 mt-0.5">{aluno.email || '—'}</p>
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div>
        <p className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium mb-3">Endereço</p>
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-1">
          <p className="text-[0.8125rem] text-gray-900">
            {aluno.endereco ? `${aluno.endereco}, ${aluno.numero || 's/n'}` : '—'}
            {aluno.complemento ? ` — ${aluno.complemento}` : ''}
          </p>
          <p className="text-[0.8125rem] text-gray-500">
            {[aluno.bairro, aluno.cidade, aluno.uf].filter(Boolean).join(', ')}
            {aluno.cep ? ` · CEP ${aluno.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}` : ''}
          </p>
        </div>
      </div>

      {/* Acadêmico */}
      <div>
        <p className="text-[0.625rem] uppercase tracking-wider text-gray-300 font-medium mb-3">Acadêmico</p>
        <div className="grid grid-cols-2 gap-4 bg-white rounded-xl border border-gray-100 p-4">
          <Info label="Matrícula" valor={aluno.matricula} />
          <Info label="Turma" valor={aluno.turmaIdentificador} />
          <Info label="Curso" valor={aluno.cursoNome} />
          <Info label="Data da matrícula" valor={formatarData(aluno.dataMatricula)} />
        </div>
      </div>
    </div>
  );
}
