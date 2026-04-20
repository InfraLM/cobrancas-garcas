import { useState } from 'react';
import type { AcordoFinanceiro } from '../../../types/acordo';
import { formaPagamentoLabel } from '../../../types/acordo';
import { enviarAssinatura } from '../../../services/acordos';
import StatusBadge from '../../ui/StatusBadge';
import { ClipboardList, FileDown, Send, Loader2, User, Mail, Phone, CreditCard, AlertTriangle } from 'lucide-react';

function formatarMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(d: string) {
  return new Date(d).toLocaleDateString('pt-BR');
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Props {
  acordo: AcordoFinanceiro;
  onAtualizado?: () => void;
}

export default function EtapaSelecao({ acordo, onAtualizado }: Props) {
  const [nome, setNome] = useState(acordo.pessoaNome || '');
  const [email, setEmail] = useState(acordo.emailAluno || '');
  const [celular, setCelular] = useState(acordo.celularAluno || '');
  const [cpf, setCpf] = useState(acordo.pessoaCpf || '');
  const [pdfGerado, setPdfGerado] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const dadosCompletos = nome.trim() && email.trim() && celular.trim() && cpf.trim();

  async function handleGerarPdf() {
    setGerando(true);
    setErro('');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/acordos/${acordo.id}/gerar-pdf`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, celular, cpf }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `termo_${acordo.pessoaNome.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setPdfGerado(true);
    } catch (err: any) {
      setErro(err.message || 'Erro ao gerar PDF');
    } finally {
      setGerando(false);
    }
  }

  async function handleEnviar() {
    setEnviando(true);
    setErro('');
    try {
      await enviarAssinatura(acordo.id);
      onAtualizado?.();
    } catch (err: any) {
      setErro(err.message || 'Erro ao enviar para assinatura');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Parcelas selecionadas */}
      <div>
        <div className="flex items-center gap-2 text-on-surface-variant mb-3">
          <ClipboardList size={16} />
          <span className="text-[0.8125rem] font-semibold">Parcelas na negociação</span>
        </div>
        <div className="bg-white/50 rounded-2xl overflow-hidden shadow-sm shadow-black/[0.03]">
          {acordo.parcelasOriginais.map((p, i) => (
            <div key={p.id} className="px-4 py-3 flex items-center gap-3">
              <div className="w-5 h-5 rounded-md bg-sky-100 flex items-center justify-center text-[0.5625rem] font-bold text-sky-700">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[0.8125rem] font-medium text-on-surface">{formatarMoeda(Number(p.valor))}</span>
                <span className="text-[0.6875rem] text-on-surface-variant ml-2">Venc. {formatarData(p.dataVencimento)}</span>
              </div>
              <span className="text-[0.75rem] font-semibold text-on-surface">{formatarMoeda(Number(p.saldoDevedor))}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Resumo do acordo */}
      <div className="bg-surface-container-low rounded-2xl p-4 space-y-2 text-[0.8125rem]">
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Saldo devedor</span>
          <span className="font-semibold">{formatarMoeda(Number(acordo.valorSaldoDevedor))}</span>
        </div>
        {Number(acordo.descontoAcordo) > 0 && (
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Desconto</span>
            <span className="font-semibold text-emerald-600">-{formatarMoeda(Number(acordo.descontoAcordo))}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-100 pt-2">
          <span className="font-semibold text-on-surface">Valor do acordo</span>
          <span className="font-bold text-lg">{formatarMoeda(Number(acordo.valorAcordo))}</span>
        </div>
        <div className="pt-1 space-y-1">
          {acordo.pagamentos.map((pg, idx) => (
            <div key={pg.id} className="flex justify-between text-[0.75rem] text-on-surface-variant">
              <span>Pgto {idx + 1}: {formaPagamentoLabel[pg.formaPagamento as keyof typeof formaPagamentoLabel] || pg.formaPagamento}{Number(pg.parcelas) > 1 ? ` ${pg.parcelas}x` : ''}</span>
              <span>{formatarMoeda(Number(pg.valor))}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dados do signatário */}
      <div>
        <div className="flex items-center gap-2 text-on-surface-variant mb-3">
          <User size={16} />
          <span className="text-[0.8125rem] font-semibold">Dados do signatário</span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[0.6875rem] text-on-surface-variant mb-1 block">Nome completo</label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
              className="w-full h-9 px-3 rounded-xl bg-white/70 text-[0.8125rem] text-on-surface outline-none focus:bg-white focus:shadow-sm transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[0.6875rem] text-on-surface-variant mb-1 block flex items-center gap-1">
                <Mail size={11} /> E-mail
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="obrigatorio@email.com"
                className="w-full h-9 px-3 rounded-xl bg-white/70 text-[0.8125rem] text-on-surface placeholder:text-red-300 outline-none focus:bg-white focus:shadow-sm transition-all" />
            </div>
            <div>
              <label className="text-[0.6875rem] text-on-surface-variant mb-1 block flex items-center gap-1">
                <Phone size={11} /> Celular
              </label>
              <input type="text" value={celular} onChange={(e) => setCelular(e.target.value)}
                placeholder="(62) 99999-9999"
                className="w-full h-9 px-3 rounded-xl bg-white/70 text-[0.8125rem] text-on-surface placeholder:text-red-300 outline-none focus:bg-white focus:shadow-sm transition-all" />
            </div>
          </div>
          <div className="w-1/2">
            <label className="text-[0.6875rem] text-on-surface-variant mb-1 block flex items-center gap-1">
              <CreditCard size={11} /> CPF
            </label>
            <input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)}
              className="w-full h-9 px-3 rounded-xl bg-white/70 text-[0.8125rem] text-on-surface outline-none focus:bg-white focus:shadow-sm transition-all" />
          </div>
        </div>
      </div>

      {!dadosCompletos && (
        <div className="flex items-center gap-2 text-[0.75rem] text-amber-600 bg-amber-50 rounded-xl px-4 py-2.5">
          <AlertTriangle size={14} />
          Preencha nome, e-mail, celular e CPF para gerar o documento
        </div>
      )}

      {erro && (
        <div className="text-[0.75rem] text-red-600 bg-red-50 rounded-xl px-4 py-2.5">{erro}</div>
      )}

      {/* Ações */}
      <div className="flex gap-3">
        <button onClick={handleGerarPdf} disabled={!dadosCompletos || gerando}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surface-container-highest text-on-surface font-medium text-[0.8125rem] hover:bg-surface-container-high transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {gerando ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
          {gerando ? 'Gerando...' : 'Gerar documento'}
        </button>
        <button onClick={handleEnviar} disabled={!dadosCompletos || !pdfGerado || enviando}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white font-semibold text-[0.8125rem] hover:bg-primary-container transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
          {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {enviando ? 'Enviando...' : 'Enviar para assinatura'}
        </button>
      </div>
    </div>
  );
}
