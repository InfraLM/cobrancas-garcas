import { useState, useEffect, useCallback } from 'react';
import { listarAcordos, baixarDocumentoAssinado } from '../services/acordos';
import type { AcordoFinanceiro } from '../types/acordo';
import { etapaLabel } from '../types/acordo';
import SearchInput from '../components/ui/SearchInput';
import StatusBadge from '../components/ui/StatusBadge';
import { getAvatarColor, getIniciais } from '../utils/avatarColor';
import { FileDown, Eye, ExternalLink, FolderOpen, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function formatarMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function formatarDataHora(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusDocumento(acordo: AcordoFinanceiro): { texto: string; variante: 'success' | 'warning' | 'danger' | 'blue' | 'default' } {
  if (acordo.etapa === 'CANCELADO') return { texto: 'Cancelado', variante: 'danger' };
  if (acordo.etapa === 'INADIMPLENTE') return { texto: 'Acordo descumprido', variante: 'danger' };
  if (acordo.etapa === 'CONCLUIDO') return { texto: 'Acordo cumprido', variante: 'success' };
  if (acordo.etapa === 'SELECAO') return { texto: 'Pendente assinatura', variante: 'default' };
  if (acordo.etapa === 'TERMO_ENVIADO' && !acordo.termoAssinadoEm) return { texto: 'Aguardando assinatura', variante: 'warning' };
  if (acordo.termoAssinadoEm) return { texto: 'Assinado - Aguardando pagamento', variante: 'blue' };
  return { texto: etapaLabel[acordo.etapa] || acordo.etapa, variante: 'default' };
}

export default function RepositorioPage() {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [acordos, setAcordos] = useState<AcordoFinanceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listarAcordos({ search: busca || undefined, page, limit });
      setAcordos(res.acordos);
      setTotal(res.total);
    } catch (err) {
      console.error('Erro ao carregar repositorio:', err);
    } finally {
      setLoading(false);
    }
  }, [busca, page]);

  useEffect(() => {
    const timer = setTimeout(carregar, 400);
    return () => clearTimeout(timer);
  }, [carregar]);

  const filtrados = filtroStatus
    ? acordos.filter(a => statusDocumento(a).texto === filtroStatus)
    : acordos;

  const totalPages = Math.ceil(total / limit);

  async function handleBaixarPdf(acordo: AcordoFinanceiro) {
    try {
      await baixarDocumentoAssinado(acordo.id, acordo.pessoaNome);
    } catch {
      // Fallback: gerar PDF nao assinado
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/acordos/${acordo.id}/gerar-pdf`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `termo_${acordo.pessoaNome.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-on-surface">
          <FolderOpen size={20} />
          <h1 className="text-lg font-bold">Repositório</h1>
        </div>

        <div className="w-72 ml-4">
          <SearchInput valor={busca} onChange={(v) => { setBusca(v); setPage(1); }} placeholder="Buscar por nome, matrícula ou CPF..." />
        </div>

        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}
          className="h-10 px-4 rounded-xl bg-white/70 text-[0.8125rem] text-on-surface outline-none focus:bg-white focus:shadow-sm transition-all appearance-none cursor-pointer">
          <option value="">Todos os status</option>
          <option value="Pendente assinatura">Pendente assinatura</option>
          <option value="Aguardando assinatura">Aguardando assinatura</option>
          <option value="Assinado - Aguardando pagamento">Assinado - Aguardando pagamento</option>
          <option value="Acordo cumprido">Acordo cumprido</option>
          <option value="Acordo descumprido">Acordo descumprido</option>
          <option value="Cancelado">Cancelado</option>
        </select>

        <div className="ml-auto text-[0.8125rem] text-on-surface-variant flex items-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin" />}
          <span>{total} documentos</span>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-sm shadow-black/[0.03] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Aluno</th>
              <th className="text-left px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">CPF</th>
              <th className="text-left px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Agente</th>
              <th className="text-left px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Data</th>
              <th className="text-right px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Valor</th>
              <th className="text-left px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Status</th>
              <th className="text-right px-5 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((acordo) => {
              const status = statusDocumento(acordo);
              const cor = getAvatarColor(acordo.pessoaNome);
              return (
                <tr key={acordo.id} className="border-b border-gray-50 hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[0.625rem] font-bold shrink-0"
                        style={{ backgroundColor: cor.bg, color: cor.text }}>
                        {getIniciais(acordo.pessoaNome)}
                      </div>
                      <div>
                        <p className="text-[0.8125rem] font-medium text-on-surface">{acordo.pessoaNome}</p>
                        <p className="text-[0.6875rem] text-on-surface-variant">{acordo.matricula || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[0.8125rem] text-on-surface">{acordo.pessoaCpf}</td>
                  <td className="px-3 py-3 text-[0.8125rem] text-on-surface-variant">{acordo.criadoPorNome}</td>
                  <td className="px-3 py-3 text-[0.8125rem] text-on-surface-variant">{formatarData(acordo.criadoEm)}</td>
                  <td className="px-3 py-3 text-[0.8125rem] font-semibold text-on-surface text-right">{formatarMoeda(Number(acordo.valorAcordo))}</td>
                  <td className="px-3 py-3">
                    <StatusBadge texto={status.texto} variante={status.variante} comDot />
                    {acordo.etapa === 'CANCELADO' && acordo.motivoCancelamento && (
                      <p className="text-[0.625rem] text-on-surface-variant/70 mt-1 italic max-w-xs truncate" title={acordo.motivoCancelamento}>
                        “{acordo.motivoCancelamento}”
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleBaixarPdf(acordo)} title="Baixar documento"
                        className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-on-surface hover:bg-surface-container-high transition-colors">
                        <FileDown size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-[0.8125rem] text-on-surface-variant">
                  {busca ? 'Nenhum documento encontrado' : 'Nenhuma negociação criada ainda'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[0.8125rem] text-on-surface-variant">
            {page} de {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
