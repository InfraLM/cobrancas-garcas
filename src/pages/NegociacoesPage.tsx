import { useState, useEffect, useCallback } from 'react';
import { listarAcordos, baixarDocumentoAssinado } from '../services/acordos';
import type { AcordoFinanceiro } from '../types/acordo';
import { etapaLabel, formaPagamentoLabel } from '../types/acordo';
import SearchInput from '../components/ui/SearchInput';
import StatusBadge from '../components/ui/StatusBadge';
import Drawer from '../components/ui/Drawer';
import { getAvatarColor, getIniciais } from '../utils/avatarColor';
import {
  Handshake, Loader2, ChevronLeft, ChevronRight, FileDown, X,
  ClipboardList, FileSignature, CreditCard, Link2, Clock, CheckCircle2,
  QrCode, Landmark, AlertTriangle
} from 'lucide-react';

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

function statusNegociacao(acordo: AcordoFinanceiro): { texto: string; variante: 'success' | 'warning' | 'danger' | 'blue' | 'default' } {
  if (acordo.etapa === 'CANCELADO') return { texto: 'Cancelado', variante: 'danger' };
  if (acordo.etapa === 'INADIMPLENTE') return { texto: 'Acordo não cumprido', variante: 'danger' };
  if (acordo.etapa === 'CONCLUIDO') return { texto: 'Acordo cumprido', variante: 'success' };
  if (acordo.etapa === 'SELECAO') return { texto: 'Pendente assinatura', variante: 'default' };

  const pagamentos = acordo.pagamentos || [];
  const confirmados = pagamentos.filter(p => p.situacao === 'CONFIRMADO').length;
  const vencidos = pagamentos.filter(p => p.situacao === 'VENCIDO').length;
  const total = pagamentos.length;

  if (acordo.etapa === 'TERMO_ENVIADO' && !acordo.termoAssinadoEm) return { texto: 'Aguardando assinatura', variante: 'warning' };
  if (confirmados > 0 && vencidos > 0) return { texto: 'Pago parcial + vencido', variante: 'danger' };
  if (confirmados > 0 && confirmados < total) return { texto: 'Pago parcialmente', variante: 'blue' };
  if (vencidos > 0) return { texto: 'Pagamento vencido', variante: 'danger' };
  if (acordo.termoAssinadoEm && confirmados === 0) return { texto: 'Aguardando pagamento', variante: 'warning' };

  return { texto: etapaLabel[acordo.etapa] || acordo.etapa, variante: 'default' };
}

export default function NegociacoesPage() {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [acordos, setAcordos] = useState<AcordoFinanceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selecionado, setSelecionado] = useState<AcordoFinanceiro | null>(null);
  const limit = 20;

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listarAcordos({ search: busca || undefined, page, limit });
      setAcordos(res.acordos);
      setTotal(res.total);
    } catch (err) {
      console.error('Erro ao carregar negociacoes:', err);
    } finally {
      setLoading(false);
    }
  }, [busca, page]);

  useEffect(() => {
    const timer = setTimeout(carregar, 400);
    return () => clearTimeout(timer);
  }, [carregar]);

  const filtrados = filtroStatus
    ? acordos.filter(a => statusNegociacao(a).texto === filtroStatus)
    : acordos;

  const totalPages = Math.ceil(total / limit);

  // Metricas
  const totalValorAcordo = acordos.reduce((acc, a) => acc + Number(a.valorAcordo), 0);
  const totalValorPago = acordos.reduce((acc, a) =>
    acc + (a.pagamentos || []).reduce((s, p) => s + Number(p.valorPago || 0), 0), 0);
  const totalTaxas = acordos.reduce((acc, a) =>
    acc + (a.pagamentos || []).reduce((s, p) => s + Number(p.taxaAsaas || 0), 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-on-surface">
          <Handshake size={20} />
          <h1 className="text-lg font-bold">Negociações</h1>
        </div>

        <div className="w-72 ml-4">
          <SearchInput valor={busca} onChange={(v) => { setBusca(v); setPage(1); }} placeholder="Buscar por nome, matrícula ou CPF..." />
        </div>

        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}
          className="h-10 px-4 rounded-xl bg-white/70 text-[0.8125rem] text-on-surface outline-none focus:bg-white focus:shadow-sm transition-all appearance-none cursor-pointer">
          <option value="">Todos os status</option>
          <option value="Pendente assinatura">Pendente assinatura</option>
          <option value="Aguardando assinatura">Aguardando assinatura</option>
          <option value="Aguardando pagamento">Aguardando pagamento</option>
          <option value="Pago parcialmente">Pago parcialmente</option>
          <option value="Acordo cumprido">Acordo cumprido</option>
          <option value="Acordo não cumprido">Acordo não cumprido</option>
          <option value="Cancelado">Cancelado</option>
        </select>

        <div className="ml-auto flex items-center gap-4 text-[0.8125rem] text-on-surface-variant">
          {loading && <Loader2 size={14} className="animate-spin" />}
          <span>{total} negociações</span>
          <span className="text-on-surface-variant/20">·</span>
          <span className="font-semibold text-on-surface">{formatarMoeda(totalValorAcordo)}</span>
          {totalValorPago > 0 && (
            <>
              <span className="text-on-surface-variant/20">·</span>
              <span className="text-emerald-600 font-medium">Recebido: {formatarMoeda(totalValorPago)}</span>
            </>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-sm shadow-black/[0.03] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Aluno</th>
              <th className="text-left px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Agente</th>
              <th className="text-left px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Data</th>
              <th className="text-right px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Acordo</th>
              <th className="text-right px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Pago</th>
              <th className="text-right px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Taxa</th>
              <th className="text-right px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Líquido</th>
              <th className="text-left px-3 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Status</th>
              <th className="text-right px-5 py-3 text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((acordo) => {
              const status = statusNegociacao(acordo);
              const cor = getAvatarColor(acordo.pessoaNome);
              const pgtos = acordo.pagamentos || [];
              const pago = pgtos.reduce((s, p) => s + Number(p.valorPago || 0), 0);
              const taxa = pgtos.reduce((s, p) => s + Number(p.taxaAsaas || 0), 0);
              const liquido = pago - taxa;

              return (
                <tr key={acordo.id} onClick={() => setSelecionado(acordo)}
                  className="border-b border-gray-50 hover:bg-surface-container-low/30 transition-colors cursor-pointer">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[0.5625rem] font-bold shrink-0"
                        style={{ backgroundColor: cor.bg, color: cor.text }}>
                        {getIniciais(acordo.pessoaNome)}
                      </div>
                      <div>
                        <p className="text-[0.8125rem] font-medium text-on-surface truncate max-w-[180px]">{acordo.pessoaNome}</p>
                        <p className="text-[0.6875rem] text-on-surface-variant">{acordo.pessoaCpf}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[0.8125rem] text-on-surface-variant">{acordo.criadoPorNome}</td>
                  <td className="px-3 py-3 text-[0.8125rem] text-on-surface-variant">{formatarData(acordo.criadoEm)}</td>
                  <td className="px-3 py-3 text-[0.8125rem] font-semibold text-on-surface text-right">{formatarMoeda(Number(acordo.valorAcordo))}</td>
                  <td className="px-3 py-3 text-[0.8125rem] text-right font-medium text-emerald-600">{pago > 0 ? formatarMoeda(pago) : '—'}</td>
                  <td className="px-3 py-3 text-[0.8125rem] text-right text-on-surface-variant/60">{taxa > 0 ? formatarMoeda(taxa) : '—'}</td>
                  <td className="px-3 py-3 text-[0.8125rem] text-right font-medium">{liquido > 0 ? formatarMoeda(liquido) : '—'}</td>
                  <td className="px-3 py-3"><StatusBadge texto={status.texto} variante={status.variante} comDot /></td>
                  <td className="px-5 py-3">
                    <button onClick={(e) => { e.stopPropagation(); baixarDocumentoAssinado(acordo.id, acordo.pessoaNome).catch(() => {}); }}
                      className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-on-surface hover:bg-surface-container-high transition-colors" title="Baixar documento">
                      <FileDown size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-[0.8125rem] text-on-surface-variant">
                  {busca ? 'Nenhuma negociação encontrada' : 'Nenhuma negociação registrada'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginacao */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[0.8125rem] text-on-surface-variant">{page} de {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Drawer de detalhes */}
      {selecionado && (
        <DetalheNegociacao acordo={selecionado} onFechar={() => setSelecionado(null)} />
      )}
    </div>
  );
}

// -----------------------------------------------
// Drawer de detalhes da negociacao
// -----------------------------------------------
function DetalheNegociacao({ acordo, onFechar }: { acordo: AcordoFinanceiro; onFechar: () => void }) {
  const cor = getAvatarColor(acordo.pessoaNome);
  const status = statusNegociacao(acordo);
  const pagamentos = acordo.pagamentos || [];
  const parcelas = acordo.parcelasOriginais || [];
  const totalPago = pagamentos.reduce((s, p) => s + Number(p.valorPago || 0), 0);
  const totalTaxas = pagamentos.reduce((s, p) => s + Number(p.taxaAsaas || 0), 0);
  const totalLiquido = totalPago - totalTaxas;

  return (
    <Drawer aberto onFechar={onFechar} largura="w-[600px]">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 bg-gradient-to-br from-surface-container-low to-surface">
        <StatusBadge texto={status.texto} variante={status.variante} comDot tamanho="md" />

        <div className="flex items-start gap-4 mt-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 shadow-sm"
            style={{ backgroundColor: cor.bg, color: cor.text }}>
            {getIniciais(acordo.pessoaNome)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-on-surface">{acordo.pessoaNome}</h2>
            <p className="text-[0.8125rem] text-on-surface-variant">
              CPF: {acordo.pessoaCpf} · Matrícula: {acordo.matricula || '—'}
            </p>
            <p className="text-[0.75rem] text-on-surface-variant mt-0.5">
              {acordo.turmaIdentificador} · {acordo.cursoNome}
            </p>
          </div>
        </div>

        {/* Financeiro resumo */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <div className="bg-white/60 rounded-xl px-3 py-2.5 text-center">
            <p className="text-[0.5rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Acordo</p>
            <p className="text-[0.8125rem] font-bold text-on-surface">{formatarMoeda(Number(acordo.valorAcordo))}</p>
          </div>
          <div className="bg-white/60 rounded-xl px-3 py-2.5 text-center">
            <p className="text-[0.5rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Pago</p>
            <p className="text-[0.8125rem] font-bold text-emerald-600">{totalPago > 0 ? formatarMoeda(totalPago) : '—'}</p>
          </div>
          <div className="bg-white/60 rounded-xl px-3 py-2.5 text-center">
            <p className="text-[0.5rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Taxas</p>
            <p className="text-[0.8125rem] font-bold text-red-500">{totalTaxas > 0 ? formatarMoeda(totalTaxas) : '—'}</p>
          </div>
          <div className="bg-white/60 rounded-xl px-3 py-2.5 text-center">
            <p className="text-[0.5rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Líquido</p>
            <p className="text-[0.8125rem] font-bold text-on-surface">{totalLiquido > 0 ? formatarMoeda(totalLiquido) : '—'}</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Parcelas originais */}
        <div>
          <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Parcelas originais negociadas</span>
          <div className="mt-2 space-y-1">
            {parcelas.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between text-[0.8125rem] py-1.5 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-sky-100 text-[0.5625rem] font-bold text-sky-700 flex items-center justify-center">{i + 1}</span>
                  <span className="text-on-surface-variant">Venc. {formatarData(p.dataVencimento)}</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">{formatarMoeda(Number(p.valor))}</span>
                  {Number(p.multa) + Number(p.juro) > 0 && (
                    <span className="text-[0.6875rem] text-red-500 ml-2">+{formatarMoeda(Number(p.multa) + Number(p.juro))}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagamentos */}
        <div>
          <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Cobranças</span>
          <div className="mt-2 space-y-2">
            {pagamentos.map((pgto, idx) => {
              const FormaIcone = pgto.formaPagamento === 'PIX' ? QrCode : pgto.formaPagamento === 'BOLETO' ? Landmark : CreditCard;
              const pago = pgto.situacao === 'CONFIRMADO';
              const vencido = pgto.situacao === 'VENCIDO';

              return (
                <div key={pgto.id} className={`rounded-xl p-3 ${pago ? 'bg-emerald-50/50' : vencido ? 'bg-red-50/50' : 'bg-gray-50/50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FormaIcone size={13} className={pago ? 'text-emerald-500' : vencido ? 'text-red-500' : 'text-on-surface-variant/40'} />
                      <span className="text-[0.8125rem] font-medium">
                        Pgto {idx + 1} — {formaPagamentoLabel[pgto.formaPagamento as keyof typeof formaPagamentoLabel] || pgto.formaPagamento}
                      </span>
                    </div>
                    <StatusBadge texto={pago ? 'Pago' : vencido ? 'Vencido' : 'Pendente'} variante={pago ? 'success' : vencido ? 'danger' : 'warning'} comDot />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-[0.75rem]">
                    <div><span className="text-on-surface-variant/60">Valor</span><p className="font-medium">{formatarMoeda(Number(pgto.valor))}</p></div>
                    <div><span className="text-on-surface-variant/60">Venc.</span><p className="font-medium">{formatarData(pgto.dataVencimento)}</p></div>
                    {pago && <div><span className="text-on-surface-variant/60">Líquido</span><p className="font-medium text-emerald-600">{formatarMoeda(Number(pgto.valorLiquido || pgto.valorPago || pgto.valor))}</p></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Documento */}
        {acordo.documento && (
          <div>
            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Documento</span>
            <div className="mt-2 flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <FileSignature size={16} className="text-on-surface-variant/40" />
              <div className="flex-1">
                <p className="text-[0.8125rem] font-medium">Termo de Confissão de Dívida</p>
                <p className="text-[0.6875rem] text-on-surface-variant">
                  {acordo.documento.situacao === 'ASSINADO' ? `Assinado em ${formatarDataHora(acordo.documento.assinadoEm)}` : `Status: ${acordo.documento.situacao}`}
                </p>
              </div>
              <button onClick={() => baixarDocumentoAssinado(acordo.id, acordo.pessoaNome).catch(() => {})}
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
                <FileDown size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div>
          <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Histórico</span>
          <div className="mt-2 space-y-0">
            {[
              { label: 'Negociação criada', data: acordo.criadoEm, icone: ClipboardList, cor: 'text-sky-500' },
              { label: 'Termo enviado', data: acordo.termoEnviadoEm, icone: FileSignature, cor: 'text-violet-500' },
              { label: 'Termo assinado', data: acordo.termoAssinadoEm, icone: CheckCircle2, cor: 'text-emerald-500' },
              { label: 'Cobrança gerada', data: acordo.acordoGeradoEm, icone: CreditCard, cor: 'text-amber-500' },
              { label: 'SEI vinculado', data: acordo.seiVinculadoEm, icone: Link2, cor: 'text-indigo-500' },
              { label: 'Cancelado', data: acordo.canceladoEm, icone: AlertTriangle, cor: 'text-red-500' },
            ].filter(e => e.data).map((etapa, idx) => {
              const EtapaIcone = etapa.icone;
              return (
                <div key={idx} className="flex items-center gap-3 py-2">
                  <EtapaIcone size={13} className={etapa.cor} />
                  <span className="text-[0.8125rem] text-on-surface flex-1">{etapa.label}</span>
                  <span className="text-[0.75rem] text-on-surface-variant/60">{formatarDataHora(etapa.data!)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info agente */}
        <div className="bg-surface-container-low rounded-xl p-3 text-[0.8125rem]">
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Agente</span>
            <span className="font-medium">{acordo.criadoPorNome}</span>
          </div>
          {acordo.negociacaoContaReceberCodigo && (
            <div className="flex justify-between mt-1">
              <span className="text-on-surface-variant">SEI</span>
              <span className="font-mono font-medium">#{acordo.negociacaoContaReceberCodigo}</span>
            </div>
          )}
          {Number(acordo.descontoAcordoPercentual) > 0 && (
            <div className="flex justify-between mt-1">
              <span className="text-on-surface-variant">Desconto</span>
              <span className="font-medium text-emerald-600">{Number(acordo.descontoAcordoPercentual).toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
