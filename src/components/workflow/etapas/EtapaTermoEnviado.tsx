import { useState } from 'react';
import type { AcordoFinanceiro } from '../../../types/acordo';
import { formaPagamentoLabel } from '../../../types/acordo';
import { cancelarAcordo, atualizarEtapa } from '../../../services/acordos';
import StatusBadge from '../../ui/StatusBadge';
import { FileSignature, RefreshCw, XCircle, Download, Clock, Send, Loader2, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

function formatarMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataHora(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Props {
  acordo: AcordoFinanceiro;
  onAtualizado?: () => void;
}

export default function EtapaTermoEnviado({ acordo, onAtualizado }: Props) {
  const doc = acordo.documento;
  const assinado = doc?.situacao === 'ASSINADO';
  const recusado = doc?.situacao === 'RECUSADO';
  const expirado = doc?.situacao === 'EXPIRADO';
  const [enviandoLembrete, setEnviandoLembrete] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [avancando, setAvancando] = useState(false);

  async function handleEnviarLembrete() {
    setEnviandoLembrete(true);
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${API_URL}/acordos/${acordo.id}/enviar-lembrete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      alert('Lembrete enviado com sucesso!');
    } catch {
      alert('Erro ao enviar lembrete');
    } finally {
      setEnviandoLembrete(false);
    }
  }

  async function handleCancelar() {
    if (!confirm('Tem certeza que deseja cancelar este documento? O aluno perderá o acesso ao link de assinatura.')) return;
    setCancelando(true);
    try {
      await cancelarAcordo(acordo.id, 'Documento cancelado pelo agente');
      onAtualizado?.();
    } catch {
      alert('Erro ao cancelar');
    } finally {
      setCancelando(false);
    }
  }

  async function handleAvancarParaCobrancas() {
    if (avancando) return;
    setAvancando(true);
    try {
      await atualizarEtapa(acordo.id, 'ACORDO_GERADO');
      onAtualizado?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao avancar para proxima etapa');
    } finally {
      setAvancando(false);
    }
  }

  async function handleBaixarPdf() {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API_URL}/acordos/${acordo.id}/gerar-pdf`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `termo_${acordo.pessoaNome.replace(/\s+/g, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Status da assinatura */}
      <div>
        <div className="flex items-center gap-2 text-on-surface-variant mb-3">
          <FileSignature size={16} />
          <span className="text-[0.8125rem] font-semibold">Status da assinatura</span>
        </div>
        <div className="bg-white/50 rounded-2xl p-4 shadow-sm shadow-black/[0.03] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[0.8125rem] text-on-surface-variant">Status</span>
            <StatusBadge
              texto={assinado ? 'Assinado' : recusado ? 'Recusado' : expirado ? 'Expirado' : 'Aguardando assinatura'}
              variante={assinado ? 'success' : recusado || expirado ? 'danger' : 'warning'}
              comDot
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[0.8125rem] text-on-surface-variant">Enviado em</span>
            <span className="text-[0.8125rem] font-medium">{formatarDataHora(acordo.termoEnviadoEm)}</span>
          </div>
          {doc?.assinadoEm && (
            <div className="flex items-center justify-between">
              <span className="text-[0.8125rem] text-on-surface-variant">Assinado em</span>
              <span className="text-[0.8125rem] font-medium text-emerald-600">{formatarDataHora(doc.assinadoEm)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[0.8125rem] text-on-surface-variant">Signatário</span>
            <span className="text-[0.8125rem] font-medium">{acordo.pessoaNome}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[0.8125rem] text-on-surface-variant">WhatsApp</span>
            <span className="text-[0.8125rem] font-medium">{acordo.celularAluno || '—'}</span>
          </div>
        </div>
      </div>

      {/* Timeline de eventos */}
      <div>
        <div className="flex items-center gap-2 text-on-surface-variant mb-3">
          <Clock size={16} />
          <span className="text-[0.8125rem] font-semibold">Eventos</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-[0.8125rem]">
            <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            <span className="text-on-surface-variant">Documento gerado e enviado</span>
            <span className="ml-auto text-[0.75rem] text-on-surface-variant/60">{formatarDataHora(acordo.termoEnviadoEm)}</span>
          </div>
          {assinado && (
            <div className="flex items-center gap-3 text-[0.8125rem]">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              <span className="text-on-surface-variant">Documento assinado pelo aluno</span>
              <span className="ml-auto text-[0.75rem] text-on-surface-variant/60">{formatarDataHora(doc?.assinadoEm)}</span>
            </div>
          )}
          {recusado && (
            <div className="flex items-center gap-3 text-[0.8125rem]">
              <XCircle size={14} className="text-red-500 shrink-0" />
              <span className="text-red-600">Documento recusado pelo aluno</span>
            </div>
          )}
          {!assinado && !recusado && !expirado && (
            <div className="flex items-center gap-3 text-[0.8125rem]">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 shrink-0" />
              <span className="text-amber-600">Aguardando assinatura do aluno via WhatsApp</span>
            </div>
          )}
        </div>
      </div>

      {/* Resumo da negociação */}
      <div className="bg-surface-container-low rounded-2xl p-4 space-y-2 text-[0.8125rem]">
        <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/50">Resumo da negociação</span>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Valor do acordo</span>
          <span className="font-bold">{formatarMoeda(Number(acordo.valorAcordo))}</span>
        </div>
        {Number(acordo.descontoAcordo) > 0 && (
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Desconto</span>
            <span className="text-emerald-600 font-medium">-{formatarMoeda(Number(acordo.descontoAcordo))}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Parcelas</span>
          <span className="font-medium">{acordo.pagamentos.length}</span>
        </div>
        {acordo.pagamentos.map((pg, idx) => (
          <div key={pg.id} className="flex justify-between text-[0.75rem] text-on-surface-variant pl-3">
            <span>Pgto {idx + 1}: {formaPagamentoLabel[pg.formaPagamento as keyof typeof formaPagamentoLabel] || pg.formaPagamento}</span>
            <span>{formatarMoeda(Number(pg.valor))}</span>
          </div>
        ))}
      </div>

      {/* Ações */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={handleBaixarPdf}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container-highest text-on-surface font-medium text-[0.8125rem] hover:bg-surface-container-high transition-colors">
          <Download size={13} />
          Baixar PDF
        </button>

        {!assinado && !recusado && !expirado && (
          <>
            <button onClick={handleEnviarLembrete} disabled={enviandoLembrete}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container-highest text-on-surface font-medium text-[0.8125rem] hover:bg-surface-container-high transition-colors disabled:opacity-40">
              {enviandoLembrete ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Enviar lembrete
            </button>
            <button onClick={handleCancelar} disabled={cancelando}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-red-600 bg-red-50 font-medium text-[0.8125rem] hover:bg-red-100 transition-colors disabled:opacity-40">
              {cancelando ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
              Cancelar documento
            </button>
          </>
        )}

        {assinado && (
          <button
            onClick={handleAvancarParaCobrancas}
            disabled={avancando}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white font-semibold text-[0.8125rem] hover:bg-primary-container transition-colors shadow-sm disabled:opacity-50"
          >
            {avancando ? <Loader2 size={14} className="animate-spin" /> : <>Próxima etapa <ArrowRight size={14} /></>}
          </button>
        )}
      </div>
    </div>
  );
}
