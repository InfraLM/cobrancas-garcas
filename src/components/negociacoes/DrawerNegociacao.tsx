import { useState, useEffect } from 'react';
import { X, FileDown, ExternalLink, Phone, MessageCircle, CheckCircle2, Clock, FileSignature, ListChecks, Activity, History, Sparkles } from 'lucide-react';
import { obterAcordoDetalhado, obterAcordoContexto, baixarDocumentoAssinado, type AcordoDetalhado, type AcordoContexto } from '../../services/acordos';
import { etapaLabel, etapaCor, formaPagamentoLabel, situacaoPagamentoLabel } from '../../types/acordo';

function fmtBRL(v: number | string | undefined | null) {
  const n = Number(v) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}
// Para datas "do dia" sem hora real (Asaas paymentDate, dataVencimento de parcela):
// o backend grava como midnight UTC → JS converte pra BRT mostrando dia anterior.
// Forcamos UTC para preservar o dia civil.
function fmtDataDia(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
function fmtDataHora(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function diasAtraso(venc: string | null | undefined, ref: string | Date = new Date()) {
  if (!venc) return null;
  const v = new Date(venc).getTime();
  const r = typeof ref === 'string' ? new Date(ref).getTime() : ref.getTime();
  return Math.floor((r - v) / (1000 * 60 * 60 * 24));
}

type TabId = 'resumo' | 'parcelas' | 'documento' | 'comunicacao' | 'timeline' | 'historico';

interface Props {
  acordoId: string | null;
  onClose: () => void;
}

export default function DrawerNegociacao({ acordoId, onClose }: Props) {
  const [data, setData] = useState<AcordoDetalhado | null>(null);
  const [contexto, setContexto] = useState<AcordoContexto | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingContexto, setLoadingContexto] = useState(false);
  const [tab, setTab] = useState<TabId>('resumo');

  // Carrega o resumo rapido (aba "Resumo" abre instantaneamente).
  useEffect(() => {
    if (!acordoId) {
      setData(null);
      setContexto(null);
      return;
    }
    setLoading(true);
    setTab('resumo');
    setContexto(null);
    obterAcordoDetalhado(acordoId)
      .then(setData)
      .catch((e) => console.error('Erro ao carregar acordo:', e))
      .finally(() => setLoading(false));
  }, [acordoId]);

  // Lazy-load do contexto quando o usuario abre uma aba que precisa dele.
  // Carrega 1x e fica em cache enquanto o drawer estiver aberto pro mesmo acordo.
  useEffect(() => {
    if (!acordoId || contexto || loadingContexto) return;
    if (tab !== 'comunicacao' && tab !== 'timeline' && tab !== 'historico') return;
    setLoadingContexto(true);
    obterAcordoContexto(acordoId)
      .then(setContexto)
      .catch((e) => console.error('Erro ao carregar contexto do acordo:', e))
      .finally(() => setLoadingContexto(false));
  }, [acordoId, tab, contexto, loadingContexto]);

  if (!acordoId) return null;

  const acordo = data?.acordo;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-40 w-full max-w-2xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          {acordo ? (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold truncate">{acordo.pessoaNome}</h2>
                {(() => {
                  const cor = etapaCor[acordo.etapa] || etapaCor.SELECAO;
                  return (
                    <span className={`px-2 py-0.5 rounded text-[0.6875rem] font-medium ${cor.badge}`}>
                      {etapaLabel[acordo.etapa] || acordo.etapa}
                    </span>
                  );
                })()}
              </div>
              <div className="text-[0.6875rem] text-on-surface-variant mt-0.5">
                {acordo.pessoaCpf} {acordo.matricula ? `• Matrícula ${acordo.matricula}` : ''} {acordo.turmaIdentificador ? `• ${acordo.turmaIdentificador}` : ''}
              </div>
              <div className="text-[0.625rem] text-gray-400 mt-0.5">
                {acordo.celularAluno} {acordo.emailAluno ? `• ${acordo.emailAluno}` : ''}
              </div>
            </div>
          ) : (
            <div className="flex-1">{loading ? 'Carregando…' : 'Acordo não encontrado'}</div>
          )}
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        {data && (
          <div className="px-2 border-b border-gray-100 flex items-center gap-0.5 overflow-x-auto">
            {([
              { id: 'resumo' as const, label: 'Resumo', icon: Activity },
              { id: 'parcelas' as const, label: 'Parcelas', icon: ListChecks },
              { id: 'documento' as const, label: 'Documento', icon: FileSignature },
              { id: 'comunicacao' as const, label: 'Comunicação', icon: MessageCircle },
              { id: 'timeline' as const, label: 'Timeline', icon: Clock },
              { id: 'historico' as const, label: 'Histórico', icon: History },
            ]).map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-2 text-[0.75rem] flex items-center gap-1.5 border-b-2 transition-colors ${
                    tab === t.id ? 'border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <Icon size={13} />
                  {t.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 text-[0.8125rem]">
          {loading && <div className="text-center py-12 text-on-surface-variant">Carregando…</div>}
          {data && acordo && (
            <>
              {tab === 'resumo' && <AbaResumo data={data} />}
              {tab === 'parcelas' && <AbaParcelas data={data} />}
              {tab === 'documento' && <AbaDocumento data={data} />}
              {tab === 'comunicacao' && (
                contexto ? <AbaComunicacao data={data} contexto={contexto} />
                  : <div className="text-center py-8 text-on-surface-variant">Carregando comunicação…</div>
              )}
              {tab === 'timeline' && (
                contexto ? <AbaTimeline contexto={contexto} />
                  : <div className="text-center py-8 text-on-surface-variant">Carregando timeline…</div>
              )}
              {tab === 'historico' && (
                contexto ? <AbaHistorico contexto={contexto} />
                  : <div className="text-center py-8 text-on-surface-variant">Carregando histórico…</div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );

  // ----- Sub-componentes -----
  function AbaResumo({ data }: { data: AcordoDetalhado }) {
    const a = data.acordo;
    const todos = a.pagamentos || [];
    // "Pago" em CAIXA: parcelas confirmadas E o que efetivamente entrou (valorPago).
    // Para cartao parcelado: 1a parcela tem valorPago < valor (resto vira mes a mes).
    const valorPagoEfetivo = todos
      .filter(p => p.situacao === 'CONFIRMADO')
      .reduce((s, p) => s + Math.min(Number(p.valorPago || p.valor || 0), Number(p.valor || 0)), 0);
    // "Pago" em COMPETENCIA: cartao parcelado conta inteiro porque limite ja foi capturado.
    const valorPagoGarantido = todos
      .filter(p => p.situacao === 'CONFIRMADO' || p.creditCardCaptured)
      .reduce((s, p) => s + Number(p.valor || 0), 0);
    const valorGarantidoFuturo = Math.max(0, valorPagoGarantido - valorPagoEfetivo);
    const pagos = todos.filter(p => p.situacao === 'CONFIRMADO');
    const pendentes = todos.filter(p => p.situacao === 'PENDENTE' || p.situacao === 'VENCIDO');
    const pct = Number(a.valorAcordo) > 0 ? (valorPagoGarantido / Number(a.valorAcordo)) * 100 : 0;
    // Clamp em 0: alguns acordos antigos tem concluidoEm setado como UTC midnight da
    // dataPagamento (que vem do Asaas como "data do dia"), produzindo diff negativo.
    // Tratamos como "concluido no mesmo dia".
    const diasConcluirRaw = a.criadoEm && a.concluidoEm
      ? (new Date(a.concluidoEm).getTime() - new Date(a.criadoEm).getTime()) / (1000 * 60 * 60 * 24)
      : null;
    const diasConcluir = diasConcluirRaw == null ? null : Math.max(0, Math.floor(diasConcluirRaw));

    const marcos = [
      { label: 'Criado', data: a.criadoEm, ok: !!a.criadoEm },
      { label: 'Termo enviado', data: a.termoEnviadoEm, ok: !!a.termoEnviadoEm },
      { label: 'Termo assinado', data: a.termoAssinadoEm, ok: !!a.termoAssinadoEm },
      { label: 'Cobranças geradas', data: a.acordoGeradoEm, ok: !!a.acordoGeradoEm },
      a.canceladoEm
        ? { label: 'Cancelado', data: a.canceladoEm, ok: true, danger: true }
        : { label: 'Concluído', data: a.concluidoEm, ok: !!a.concluidoEm },
    ];

    return (
      <div className="space-y-5">
        {/* Timeline visual */}
        <div>
          <h3 className="text-[0.6875rem] font-bold uppercase tracking-wide text-on-surface-variant mb-2">Linha do tempo</h3>
          <div className="flex items-center gap-1">
            {marcos.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.625rem] font-bold ${
                  m.ok ? ((m as { danger?: boolean }).danger ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white') : 'bg-gray-200 text-gray-400'
                }`}>
                  {m.ok ? <CheckCircle2 size={12} /> : i + 1}
                </div>
                <div className="text-[0.625rem] text-center mt-1 text-on-surface-variant">{m.label}</div>
                <div className="text-[0.5625rem] text-gray-400">{fmtData(m.data)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <KpiBox label="Valor acordo" valor={fmtBRL(a.valorAcordo)} />
          <KpiBox
            label="Pago"
            valor={fmtBRL(valorPagoGarantido)}
            cor={pct >= 99 ? 'text-emerald-600' : 'text-blue-600'}
            sub={valorGarantidoFuturo > 0
              ? `${fmtBRL(valorPagoEfetivo)} em caixa + ${fmtBRL(valorGarantidoFuturo)} no cartão`
              : undefined}
            tooltip={valorGarantidoFuturo > 0
              ? `${fmtBRL(valorPagoEfetivo)} já recebido em caixa.\n${fmtBRL(valorGarantidoFuturo)} garantido no cartão parcelado — limite capturado, Asaas libera mensalmente.`
              : undefined}
          />
          <KpiBox label="Desconto" valor={`${fmtBRL(a.descontoAcordo)} (${Math.round(Number(a.descontoAcordoPercentual || 0))}%)`} />
          <KpiBox label="Saldo devedor original" valor={fmtBRL(a.valorSaldoDevedor)} />
          <KpiBox label="Parcelas pagas" valor={`${pagos.length} / ${a.pagamentos?.length || 0}`} />
          <KpiBox label="Pendentes / vencidas" valor={String(pendentes.length)} cor={pendentes.length > 0 ? 'text-amber-600' : 'text-on-surface'} />
          {diasConcluir != null && <KpiBox label="Tempo até concluir" valor={`${diasConcluir}d`} cor="text-emerald-600" />}
          <KpiBox label="Agente" valor={a.criadoPorNome || '—'} />
        </div>

        {/* Progresso */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-on-surface-variant">Recuperação</span>
            <span className="text-[0.8125rem] font-bold">{Math.round(pct)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 99 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>

        {a.observacao && (
          <div>
            <h3 className="text-[0.6875rem] font-bold uppercase tracking-wide text-on-surface-variant mb-1">Observação</h3>
            <p className="text-[0.8125rem] bg-amber-50 border border-amber-100 rounded-lg p-3">{a.observacao}</p>
          </div>
        )}

        {a.motivoCancelamento && (
          <div>
            <h3 className="text-[0.6875rem] font-bold uppercase tracking-wide text-red-600 mb-1">Motivo do cancelamento</h3>
            <p className="text-[0.8125rem] bg-red-50 border border-red-100 rounded-lg p-3">{a.motivoCancelamento}</p>
          </div>
        )}
      </div>
    );
  }

  function AbaParcelas({ data }: { data: AcordoDetalhado }) {
    const a = data.acordo;
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-[0.6875rem] font-bold uppercase tracking-wide text-on-surface-variant mb-2">Parcelas originais (do SEI)</h3>
          {a.parcelasOriginais?.length === 0 ? (
            <p className="text-[0.75rem] text-on-surface-variant py-2">Nenhuma parcela original vinculada.</p>
          ) : (
            <table className="w-full text-[0.75rem]">
              <thead className="text-on-surface-variant border-b border-gray-100">
                <tr>
                  <th className="text-left py-1.5">Conta</th>
                  <th className="text-right py-1.5">Valor</th>
                  <th className="text-right py-1.5">Saldo</th>
                  <th className="text-right py-1.5">Vencimento</th>
                  <th className="text-right py-1.5">Atraso</th>
                </tr>
              </thead>
              <tbody>
                {a.parcelasOriginais?.map(po => {
                  const atraso = diasAtraso(po.dataVencimento, a.criadoEm);
                  return (
                    <tr key={po.id} className="border-b border-gray-50">
                      <td className="py-1.5">#{po.contaReceberCodigo}</td>
                      <td className="py-1.5 text-right">{fmtBRL(po.valor)}</td>
                      <td className="py-1.5 text-right font-semibold">{fmtBRL(po.saldoDevedor)}</td>
                      <td className="py-1.5 text-right">{fmtDataDia(po.dataVencimento)}</td>
                      <td className={`py-1.5 text-right ${atraso != null && atraso > 0 ? 'text-red-600 font-semibold' : 'text-on-surface-variant'}`}>
                        {atraso != null ? `${atraso}d` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <h3 className="text-[0.6875rem] font-bold uppercase tracking-wide text-on-surface-variant mb-2">Pagamentos do acordo</h3>
          {a.pagamentos?.length === 0 ? (
            <p className="text-[0.75rem] text-on-surface-variant py-2">Nenhum pagamento gerado ainda.</p>
          ) : (
            <table className="w-full text-[0.75rem]">
              <thead className="text-on-surface-variant border-b border-gray-100">
                <tr>
                  <th className="text-left py-1.5">#</th>
                  <th className="text-left py-1.5">Forma</th>
                  <th className="text-right py-1.5">Valor</th>
                  <th className="text-right py-1.5">Líquido</th>
                  <th className="text-right py-1.5">Vencimento</th>
                  <th className="text-right py-1.5">Pago em</th>
                  <th className="text-right py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {a.pagamentos?.map(p => {
                  // Cartao parcelado com captura confirmada: status "Garantido" se ainda
                  // nao chegou a confirmacao individual da parcela (PENDENTE/VENCIDO).
                  const garantidoCartao = p.creditCardCaptured && p.situacao !== 'CONFIRMADO';
                  const corStatus = p.situacao === 'CONFIRMADO' ? 'text-emerald-600' :
                    garantidoCartao ? 'text-amber-600' :
                    p.situacao === 'VENCIDO' ? 'text-red-600' :
                    p.situacao === 'ERRO' ? 'text-red-700 font-bold' :
                    p.situacao === 'CANCELADO' ? 'text-gray-400' : 'text-amber-600';
                  const labelStatus = garantidoCartao
                    ? 'Garantido (cartão)'
                    : (situacaoPagamentoLabel[p.situacao] || p.situacao);
                  const tituloStatus = garantidoCartao
                    ? 'Crédito já capturado pelo banco. Asaas libera mensalmente.'
                    : undefined;
                  return (
                    <tr key={p.id} className="border-b border-gray-50">
                      <td className="py-1.5">{p.numeroPagamento}</td>
                      <td className="py-1.5">
                        {formaPagamentoLabel[p.formaPagamento] || p.formaPagamento}
                        {p.parcelas > 1 && <span className="text-on-surface-variant"> {p.parcelas}x</span>}
                      </td>
                      <td className="py-1.5 text-right">{fmtBRL(p.valor)}</td>
                      <td className="py-1.5 text-right text-on-surface-variant">{p.valorLiquido ? fmtBRL(p.valorLiquido) : '—'}</td>
                      <td className="py-1.5 text-right">{fmtDataDia(p.dataVencimento)}</td>
                      <td className="py-1.5 text-right">{fmtDataDia(p.dataPagamento)}</td>
                      <td className={`py-1.5 text-right text-[0.6875rem] font-semibold ${corStatus}`} title={tituloStatus}>
                        {labelStatus}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  function AbaDocumento({ data }: { data: AcordoDetalhado }) {
    const a = data.acordo;
    const doc = a.documento;
    if (!doc) return <p className="text-[0.75rem] text-on-surface-variant py-2">Nenhum documento vinculado a este acordo.</p>;

    return (
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[0.6875rem] uppercase text-on-surface-variant font-semibold">Termo de Confissão de Dívida</span>
            <span className={`px-2 py-0.5 rounded text-[0.625rem] font-medium ${
              doc.situacao === 'ASSINADO' ? 'bg-emerald-100 text-emerald-700' :
              doc.situacao === 'ENVIADO' ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-600'
            }`}>{doc.situacao}</span>
          </div>
          <div className="text-[0.75rem] space-y-0.5">
            <div className="flex justify-between"><span className="text-on-surface-variant">Enviado em:</span><span>{fmtDataHora(doc.enviadoEm)}</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">Assinado em:</span><span className={doc.assinadoEm ? 'text-emerald-600 font-semibold' : ''}>{fmtDataHora(doc.assinadoEm)}</span></div>
            {doc.enviadoEm && doc.assinadoEm && (
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Tempo para assinar:</span>
                <span>{Math.round((new Date(doc.assinadoEm).getTime() - new Date(doc.enviadoEm).getTime()) / (1000 * 60 * 60))}h</span>
              </div>
            )}
          </div>
        </div>

        {doc.situacao === 'ASSINADO' && (
          <button
            onClick={() => baixarDocumentoAssinado(a.id, a.pessoaNome).catch(e => alert(e.message))}
            className="w-full h-9 rounded-lg bg-primary text-white text-[0.8125rem] font-semibold flex items-center justify-center gap-2 hover:bg-primary/90"
          >
            <FileDown size={14} /> Baixar termo assinado
          </button>
        )}

        {doc.urlOriginal && (
          <a href={doc.urlOriginal} target="_blank" rel="noopener noreferrer" className="text-[0.75rem] text-primary hover:underline flex items-center gap-1">
            <ExternalLink size={11} /> Ver original
          </a>
        )}
      </div>
    );
  }

  function AbaComunicacao({ data, contexto }: { data: AcordoDetalhado; contexto: AcordoContexto }) {
    const canal = data.canal;
    const corCanal = canal.atribuido === 'ligacao' ? 'bg-blue-50 border-blue-200' :
      canal.atribuido === 'waba' ? 'bg-green-50 border-green-200' :
      canal.atribuido === '3cplus' ? 'bg-violet-50 border-violet-200' :
      'bg-gray-50 border-gray-200';
    const labelCanal = canal.atribuido === 'ligacao' ? '📞 Ligação' :
      canal.atribuido === 'waba' ? '📱 WhatsApp WABA (oficial)' :
      canal.atribuido === '3cplus' ? '💬 WhatsApp 3C+' :
      '🚫 Sem contato registrado';

    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-[0.6875rem] font-bold uppercase tracking-wide text-on-surface-variant mb-2">Canal precedente (7d antes)</h3>
          <div className={`border rounded-lg p-3 ${corCanal}`}>
            <div className="font-bold text-[0.8125rem] mb-1">{labelCanal}</div>
            {canal.detalhe && (
              <pre className="text-[0.625rem] text-on-surface-variant whitespace-pre-wrap font-mono mt-1.5 max-h-24 overflow-y-auto">
                {JSON.stringify(canal.detalhe, null, 2)}
              </pre>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-[0.6875rem] font-bold uppercase tracking-wide text-on-surface-variant mb-2">
            Templates enviados ao aluno (14d antes do acordo)
          </h3>
          {contexto.templatesEnviados?.length === 0 ? (
            <p className="text-[0.75rem] text-on-surface-variant py-1">Nenhum template enviado.</p>
          ) : (
            <table className="w-full text-[0.75rem]">
              <thead className="text-on-surface-variant border-b border-gray-100">
                <tr>
                  <th className="text-left py-1">Data</th>
                  <th className="text-left py-1">Template</th>
                  <th className="text-left py-1">Canal</th>
                </tr>
              </thead>
              <tbody>
                {contexto.templatesEnviados?.map((t, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1">{fmtDataHora(t.timestamp)}</td>
                    <td className="py-1 font-mono text-[0.6875rem]">{t.templateMetaNome || '—'}</td>
                    <td className="py-1">{t.instanciaTipo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {contexto.disparosRegua?.length > 0 && (
          <div>
            <h3 className="text-[0.6875rem] font-bold uppercase tracking-wide text-on-surface-variant mb-2">
              Disparos da régua (14d antes)
            </h3>
            <table className="w-full text-[0.75rem]">
              <thead className="text-on-surface-variant border-b border-gray-100">
                <tr>
                  <th className="text-left py-1">Disparado em</th>
                  <th className="text-left py-1">Template</th>
                  <th className="text-left py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {contexto.disparosRegua.map(d => (
                  <tr key={d.id} className="border-b border-gray-50">
                    <td className="py-1">{fmtDataHora(d.disparadoEm)}</td>
                    <td className="py-1 font-mono text-[0.6875rem]">{d.templateNomeBlip}</td>
                    <td className="py-1 text-emerald-600">{d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <h3 className="text-[0.6875rem] font-bold uppercase tracking-wide text-on-surface-variant mb-2">
            Ligações (30d antes ao acordo)
          </h3>
          {contexto.ligacoesHistorico?.length === 0 ? (
            <p className="text-[0.75rem] text-on-surface-variant py-1">Nenhuma ligação registrada.</p>
          ) : (
            <table className="w-full text-[0.75rem]">
              <thead className="text-on-surface-variant border-b border-gray-100">
                <tr>
                  <th className="text-left py-1">Data</th>
                  <th className="text-left py-1">Agente</th>
                  <th className="text-right py-1">Duração</th>
                </tr>
              </thead>
              <tbody>
                {contexto.ligacoesHistorico.map(l => (
                  <tr key={l.id} className="border-b border-gray-50">
                    <td className="py-1 whitespace-nowrap">{fmtDataHora(l.dataHoraChamada)}</td>
                    <td className="py-1">{l.agenteNome || '—'}</td>
                    <td className={`py-1 text-right whitespace-nowrap ${l.tempoFalando >= 4 ? 'font-semibold text-emerald-600' : 'text-on-surface-variant'}`}>
                      {l.tempoFalando}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  function AbaTimeline({ contexto }: { contexto: AcordoContexto }) {
    if (contexto.ocorrencias?.length === 0) {
      return <p className="text-[0.75rem] text-on-surface-variant py-2">Nenhuma ocorrência registrada.</p>;
    }
    return (
      <div className="space-y-2">
        {contexto.ocorrencias.map(o => {
          const icon = o.tipo.includes('LIGACAO') ? <Phone size={11} /> :
            o.tipo.includes('WHATSAPP') ? <MessageCircle size={11} /> :
            o.tipo.includes('TERMO') ? <FileSignature size={11} /> :
            o.tipo.includes('PAGAMENTO') ? <CheckCircle2 size={11} /> :
            <Activity size={11} />;
          return (
            <div key={o.id} className="flex gap-2.5 text-[0.75rem] border-l-2 border-gray-200 pl-3 py-1.5 hover:border-primary transition-colors">
              <div className="text-on-surface-variant pt-0.5">{icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[0.625rem] text-on-surface-variant">{o.tipo}</span>
                  <span className="text-[0.625rem] text-gray-400">• {o.origem}</span>
                </div>
                <div className="text-on-surface mt-0.5">{o.descricao}</div>
                <div className="text-[0.625rem] text-gray-400 mt-0.5">
                  {fmtDataHora(o.criadoEm)} {o.agenteNome ? `• ${o.agenteNome}` : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function AbaHistorico({ contexto }: { contexto: AcordoContexto }) {
    if (contexto.outrosAcordos?.length === 0) {
      return (
        <div className="text-center py-6 text-[0.75rem] text-on-surface-variant">
          <Sparkles size={20} className="inline text-emerald-500 mb-2" />
          <div>Esta é a <strong>primeira negociação</strong> deste aluno.</div>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-[0.6875rem] text-on-surface-variant">
          Este aluno tem mais {contexto.outrosAcordos.length} negociação(ões) no histórico:
        </p>
        {contexto.outrosAcordos.map(o => {
          const cor = etapaCor[o.etapa as keyof typeof etapaCor] || etapaCor.SELECAO;
          return (
            <div key={o.id} className="border border-gray-100 rounded-lg p-3 hover:border-gray-200 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className={`px-2 py-0.5 rounded text-[0.6875rem] font-medium ${cor.badge}`}>
                  {etapaLabel[o.etapa as keyof typeof etapaLabel] || o.etapa}
                </span>
                <span className="text-[0.6875rem] text-on-surface-variant">{fmtData(o.criadoEm)}</span>
              </div>
              <div className="flex items-center justify-between text-[0.75rem]">
                <span>{o.criadoPorNome || '—'}</span>
                <span className="font-bold">{fmtBRL(o.valorAcordo)}</span>
              </div>
              {o.concluidoEm && <div className="text-[0.625rem] text-emerald-600 mt-1">✓ Concluído em {fmtData(o.concluidoEm)}</div>}
              {o.canceladoEm && <div className="text-[0.625rem] text-red-600 mt-1">✗ Cancelado em {fmtData(o.canceladoEm)}</div>}
            </div>
          );
        })}
      </div>
    );
  }
}

function KpiBox({ label, valor, cor = 'text-on-surface', sub, tooltip }: {
  label: string;
  valor: string;
  cor?: string;
  sub?: string;
  tooltip?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5" title={tooltip}>
      <div className="text-[0.625rem] text-on-surface-variant uppercase tracking-wide">{label}</div>
      <div className={`text-[0.8125rem] font-bold mt-0.5 ${cor}`}>{valor}</div>
      {sub && <div className="text-[0.625rem] text-amber-700 mt-0.5">💳 {sub}</div>}
    </div>
  );
}
