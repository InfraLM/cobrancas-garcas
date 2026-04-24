import { useState, useMemo, useEffect } from 'react';
import type { Aluno } from '../../types/aluno';
import type { FormaPagamento } from '../../types/acordo';
import { formaPagamentoLabel } from '../../types/acordo';
import { listarAlunos, listarParcelas, obterAluno } from '../../services/alunos';
import { criarAcordo } from '../../services/acordos';
import Modal from '../ui/Modal';
import StatusBadge from '../ui/StatusBadge';
import { getAvatarColor, getIniciais } from '../../utils/avatarColor';
import { Search, AlertTriangle, CheckSquare, Square, CreditCard, Landmark, QrCode, ArrowRight, Calendar, X, Plus, Trash2, Loader2 } from 'lucide-react';

interface NovaNegociacaoDrawerProps {
  aberto: boolean;
  onFechar: () => void;
  alunoInicial?: Aluno | null;
  onCriado?: () => void;
}

interface PagamentoConfig {
  id: number;
  valor: string;
  formaPagamento: FormaPagamento;
  parcelas: number;
  dataVencimento: string;
}

function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(d: string) {
  return new Date(d).toLocaleDateString('pt-BR');
}

const FORMAS_PAGAMENTO: { valor: FormaPagamento; label: string; icone: typeof QrCode }[] = [
  { valor: 'PIX', label: 'PIX', icone: QrCode },
  { valor: 'BOLETO', label: 'Boleto', icone: Landmark },
  { valor: 'CREDIT_CARD', label: 'Cartão', icone: CreditCard },
];

const OPCOES_PARCELAS_CARTAO = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function NovaNegociacaoDrawer({ aberto, onFechar, alunoInicial, onCriado }: NovaNegociacaoDrawerProps) {
  const [busca, setBusca] = useState('');
  const [alunoSelecionado, setAlunoSelecionado] = useState<Aluno | null>(alunoInicial || null);
  const [parcelasSelecionadas, setParcelasSelecionadas] = useState<Set<number>>(new Set());
  const [valorFinal, setValorFinal] = useState('');
  const [observacao, setObservacao] = useState('');
  const [vincularRecorrencia, setVincularRecorrencia] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pagamentos, setPagamentos] = useState<PagamentoConfig[]>([
    { id: 1, valor: '', formaPagamento: 'PIX', parcelas: 1, dataVencimento: '' },
  ]);

  // Quando alunoInicial muda (ex: vindo das acoes rapidas), selecionar automaticamente
  useEffect(() => {
    if (alunoInicial && aberto) {
      selecionarAluno(alunoInicial);
    }
  }, [alunoInicial, aberto]);

  // Busca de alunos via API
  const [alunosFiltrados, setAlunosFiltrados] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (!busca || busca.trim().length < 2) { setAlunosFiltrados([]); return; }
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await listarAlunos({ search: busca, limit: 8 });
        setAlunosFiltrados(res.data || []);
      } catch { setAlunosFiltrados([]); }
      setBuscando(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  // Parcelas em atraso via API
  const [parcelasEmAtraso, setParcelasEmAtraso] = useState<any[]>([]);

  useEffect(() => {
    if (!alunoSelecionado) { setParcelasEmAtraso([]); return; }
    (async () => {
      try {
        const parcelas = await listarParcelas(alunoSelecionado.codigo, 'AR');
        setParcelasEmAtraso(parcelas.filter((p: any) => new Date(p.dataVencimento) < new Date()));
      } catch { setParcelasEmAtraso([]); }
    })();
  }, [alunoSelecionado]);

  // Cálculos
  const calculos = useMemo(() => {
    const selecionadas = parcelasEmAtraso.filter(p => parcelasSelecionadas.has(p.codigo));
    const valorOriginal = selecionadas.reduce((acc, p) => acc + p.valor, 0);
    const multaJuros = selecionadas.reduce((acc, p) => acc + (p.multa || 0) + (p.juro || 0), 0);
    const descontos = selecionadas.reduce((acc, p) => acc + (p.desconto || 0), 0);
    const valorRecebido = selecionadas.reduce((acc, p) => acc + p.valorRecebido, 0);
    const saldoDevedor = valorOriginal + multaJuros - descontos - valorRecebido;
    const vf = parseFloat(valorFinal.replace(/[^\d,.]/g, '').replace(',', '.')) || 0;
    const desconto = Math.max(saldoDevedor - vf, 0);
    const descontoPercent = saldoDevedor > 0 ? (desconto / saldoDevedor) * 100 : 0;

    // Soma dos valores dos pagamentos
    const totalPagamentos = pagamentos.reduce((acc, p) => acc + (parseFloat(p.valor.replace(/[^\d,.]/g, '').replace(',', '.')) || 0), 0);
    const restante = vf - totalPagamentos;

    return { selecionadas, valorOriginal, multaJuros, saldoDevedor, desconto, descontoPercent, valorFinalNum: vf, totalPagamentos, restante };
  }, [parcelasEmAtraso, parcelasSelecionadas, valorFinal, pagamentos]);

  function toggleParcela(codigo: number) {
    setParcelasSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  }

  function selecionarTodas() {
    if (parcelasSelecionadas.size === parcelasEmAtraso.length) setParcelasSelecionadas(new Set());
    else setParcelasSelecionadas(new Set(parcelasEmAtraso.map(p => p.codigo)));
  }

  async function selecionarAluno(alunoListItem: any) {
    try {
      const alunoCompleto = await obterAluno(alunoListItem.codigo);
      setAlunoSelecionado(alunoCompleto);
    } catch {
      // Fallback: usar dados da listagem
      setAlunoSelecionado(alunoListItem);
    }
    setBusca('');
    setParcelasSelecionadas(new Set());
    setValorFinal('');
    setPagamentos([{ id: 1, valor: '', formaPagamento: 'PIX', parcelas: 1, dataVencimento: '' }]);
  }

  function limparAluno() {
    if (alunoInicial) return;
    setAlunoSelecionado(null);
    setParcelasSelecionadas(new Set());
    setValorFinal('');
  }

  function adicionarPagamento() {
    setPagamentos(prev => [...prev, {
      id: Date.now(),
      valor: '',
      formaPagamento: 'BOLETO',
      parcelas: 1,
      dataVencimento: '',
    }]);
  }

  function removerPagamento(id: number) {
    if (pagamentos.length <= 1) return;
    setPagamentos(prev => prev.filter(p => p.id !== id));
  }

  function atualizarPagamento(id: number, campo: keyof PagamentoConfig, valor: string | number) {
    setPagamentos(prev => prev.map(p =>
      p.id === id ? { ...p, [campo]: valor } : p
    ));
  }

  const todosPreenchidos = pagamentos.every(p => {
    const v = parseFloat(p.valor.replace(/[^\d,.]/g, '').replace(',', '.')) || 0;
    return v > 0 && p.dataVencimento;
  });
  const podeEnviar = alunoSelecionado && parcelasSelecionadas.size > 0 && calculos.valorFinalNum > 0 && calculos.valorFinalNum <= calculos.saldoDevedor && todosPreenchidos && Math.abs(calculos.restante) < 0.01;

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Nova Negociação" largura="max-w-2xl">
      <div className="space-y-6">

        {/* Busca de aluno */}
        {!alunoInicial && !alunoSelecionado && (
          <div>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
              <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite 3+ caracteres para buscar..."
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/70 text-[0.8125rem] text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:bg-white focus:shadow-sm transition-all" />
            </div>
            {buscando && <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-primary" /></div>}
            {alunosFiltrados.length > 0 && (
              <div className="mt-2 bg-white rounded-2xl shadow-sm border border-gray-100 max-h-80 overflow-y-auto">
                {alunosFiltrados.map((aluno) => {
                  const cor = getAvatarColor(aluno.nome);
                  return (
                    <button key={aluno.codigo} onClick={() => selecionarAluno(aluno)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors text-left">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: cor.bg, color: cor.text }}>
                        {getIniciais(aluno.nome)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.8125rem] font-medium text-on-surface truncate">{aluno.nome}</p>
                        <p className="text-[0.6875rem] text-on-surface-variant">{aluno.turmaIdentificador || aluno.cursoNome}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Aluno selecionado */}
        {alunoSelecionado && (
          <div className="bg-white/50 rounded-2xl p-4 flex items-center gap-3 shadow-sm shadow-black/[0.03]">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: getAvatarColor(alunoSelecionado.nome).bg, color: getAvatarColor(alunoSelecionado.nome).text }}>
              {getIniciais(alunoSelecionado.nome)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[0.8125rem] font-semibold text-on-surface truncate">{alunoSelecionado.nome}</p>
              <p className="text-[0.6875rem] text-on-surface-variant">
                {alunoSelecionado.turmaIdentificador} · {parcelasEmAtraso.length} parcelas em atraso
              </p>
            </div>
            {!alunoInicial && (
              <button onClick={limparAluno} className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant/40">
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Parcelas em atraso */}
        {alunoSelecionado && parcelasEmAtraso.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-on-surface-variant/40">Parcelas em atraso</span>
              <button onClick={selecionarTodas} className="text-[0.75rem] font-medium text-primary hover:underline">
                {parcelasSelecionadas.size === parcelasEmAtraso.length ? 'Desmarcar todas' : 'Selecionar todas'}
              </button>
            </div>
            <div className="bg-white/50 rounded-2xl overflow-hidden shadow-sm shadow-black/[0.03]">
              {parcelasEmAtraso.map((p) => {
                const selecionada = parcelasSelecionadas.has(p.codigo);
                const saldo = p.valor + (p.multa || 0) + (p.juro || 0) - (p.desconto || 0) - p.valorRecebido;
                return (
                  <button key={p.codigo} onClick={() => toggleParcela(p.codigo)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${selecionada ? 'bg-primary/5' : 'hover:bg-surface-container-low/50'}`}>
                    {selecionada ? <CheckSquare size={18} className="text-primary shrink-0" /> : <Square size={18} className="text-on-surface-variant/30 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.8125rem] font-medium text-on-surface">{formatarMoeda(p.valor)}</span>
                        <StatusBadge texto={p.tipoOrigem} variante="blue" />
                      </div>
                      <span className="text-[0.6875rem] text-on-surface-variant">
                        Venc. {formatarData(p.dataVencimento)}
                        {(p.multa || 0) + (p.juro || 0) > 0 && ` · Multa+Juro: ${formatarMoeda((p.multa || 0) + (p.juro || 0))}`}
                      </span>
                    </div>
                    <span className="text-[0.8125rem] font-semibold text-on-surface">{formatarMoeda(saldo)}</span>
                  </button>
                );
              })}
            </div>
            {parcelasSelecionadas.size > 0 && (
              <div className="mt-3 flex items-center gap-4 text-[0.75rem] text-on-surface-variant flex-wrap">
                <span>{calculos.selecionadas.length} parcelas</span>
                <span className="text-on-surface-variant/20">·</span>
                <span>Original: {formatarMoeda(calculos.valorOriginal)}</span>
                {calculos.multaJuros > 0 && (<><span className="text-on-surface-variant/20">·</span><span className="text-red-500">+{formatarMoeda(calculos.multaJuros)}</span></>)}
                <span className="text-on-surface-variant/20">·</span>
                <span className="font-semibold text-on-surface">Saldo: {formatarMoeda(calculos.saldoDevedor)}</span>
              </div>
            )}
          </div>
        )}

        {/* Valor final + Pagamentos */}
        {parcelasSelecionadas.size > 0 && (
          <div className="space-y-6">
            <span className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-on-surface-variant/40">Condições do acordo</span>

            {/* Valor final */}
            <div>
              <label className="text-[0.8125rem] font-medium text-on-surface mb-1.5 block">Valor final do acordo</label>
              <input type="text" value={valorFinal} onChange={(e) => setValorFinal(e.target.value)}
                placeholder={formatarMoeda(calculos.saldoDevedor)}
                className="w-full h-14 px-5 rounded-xl bg-white/70 text-2xl font-bold text-on-surface placeholder:text-on-surface-variant/20 outline-none focus:bg-white focus:shadow-sm transition-all font-mono" />
              <div className="mt-2 flex items-center gap-3 text-[0.75rem] flex-wrap">
                <span className="text-on-surface-variant">Saldo devedor: {formatarMoeda(calculos.saldoDevedor)}</span>
                {calculos.desconto > 0 && (
                  <span className="text-emerald-600 font-semibold">Desconto: {formatarMoeda(calculos.desconto)} ({calculos.descontoPercent.toFixed(1)}%)</span>
                )}
                {calculos.valorFinalNum > calculos.saldoDevedor && (
                  <span className="text-red-500 font-medium flex items-center gap-1"><AlertTriangle size={12} /> Valor excede o saldo devedor</span>
                )}
              </div>
            </div>

            {/* Pagamentos */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-on-surface-variant/40">
                  Pagamentos ({pagamentos.length})
                </label>
                <button onClick={adicionarPagamento}
                  className="flex items-center gap-1.5 text-[0.75rem] font-medium text-primary hover:underline">
                  <Plus size={14} /> Adicionar pagamento
                </button>
              </div>

              <div className="space-y-3">
                {pagamentos.map((pgto, idx) => (
                  <div key={pgto.id} className="bg-white/50 rounded-2xl p-4 shadow-sm shadow-black/[0.03] space-y-3">
                    {/* Header do pagamento */}
                    <div className="flex items-center justify-between">
                      <span className="text-[0.8125rem] font-semibold text-on-surface">
                        Pagamento {idx + 1}
                      </span>
                      {pagamentos.length > 1 && (
                        <button onClick={() => removerPagamento(pgto.id)} className="p-1 rounded-lg hover:bg-red-50 text-on-surface-variant/30 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Valor + Vencimento */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[0.6875rem] text-on-surface-variant mb-1 block">Valor</label>
                        <input type="text" value={pgto.valor}
                          onChange={(e) => atualizarPagamento(pgto.id, 'valor', e.target.value)}
                          placeholder="R$ 0,00"
                          className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[0.875rem] font-semibold text-on-surface placeholder:text-on-surface-variant/30 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono" />
                      </div>
                      <div>
                        <label className="text-[0.6875rem] text-on-surface-variant mb-1 block">Vencimento</label>
                        <div className="relative">
                          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
                          <input type="date" value={pgto.dataVencimento}
                            onChange={(e) => atualizarPagamento(pgto.id, 'dataVencimento', e.target.value)}
                            className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-container-low text-[0.8125rem] text-on-surface outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                        </div>
                      </div>
                    </div>

                    {/* Forma de pagamento */}
                    <div>
                      <label className="text-[0.6875rem] text-on-surface-variant mb-1.5 block">Forma de pagamento</label>
                      <div className="flex gap-2">
                        {FORMAS_PAGAMENTO.map((fp) => (
                          <button key={fp.valor} onClick={() => {
                            atualizarPagamento(pgto.id, 'formaPagamento', fp.valor);
                            if (fp.valor !== 'CREDIT_CARD') atualizarPagamento(pgto.id, 'parcelas', 1);
                          }}
                            className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-[0.75rem] font-medium transition-all ${
                              pgto.formaPagamento === fp.valor
                                ? 'bg-on-surface text-white shadow-sm'
                                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                            }`}>
                            <fp.icone size={13} />
                            {fp.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Parcelas do cartão */}
                    {pgto.formaPagamento === 'CREDIT_CARD' && (
                      <div>
                        <label className="text-[0.6875rem] text-on-surface-variant mb-1.5 block">Parcelas no cartão</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {OPCOES_PARCELAS_CARTAO.map((n) => (
                            <button key={n} onClick={() => atualizarPagamento(pgto.id, 'parcelas', n)}
                              className={`w-10 h-8 rounded-lg text-[0.75rem] font-semibold transition-all ${
                                pgto.parcelas === n
                                  ? 'bg-on-surface text-white shadow-sm'
                                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                              }`}>
                              {n}x
                            </button>
                          ))}
                        </div>
                        {pgto.parcelas > 1 && (
                          <p className="mt-1.5 text-[0.6875rem] text-on-surface-variant">
                            {pgto.parcelas}x de {formatarMoeda((parseFloat(pgto.valor.replace(/[^\d,.]/g, '').replace(',', '.')) || 0) / pgto.parcelas)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Totalizador dos pagamentos */}
              {calculos.valorFinalNum > 0 && (
                <div className={`mt-3 flex items-center gap-3 text-[0.75rem] px-1 ${Math.abs(calculos.restante) < 0.01 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {Math.abs(calculos.restante) < 0.01 ? (
                    <span className="font-medium">Valores dos pagamentos conferem com o valor do acordo</span>
                  ) : calculos.restante > 0 ? (
                    <span className="font-medium flex items-center gap-1"><AlertTriangle size={12} /> Faltam {formatarMoeda(calculos.restante)} para completar o valor do acordo</span>
                  ) : (
                    <span className="font-medium flex items-center gap-1"><AlertTriangle size={12} /> Pagamentos excedem o valor do acordo em {formatarMoeda(Math.abs(calculos.restante))}</span>
                  )}
                </div>
              )}
            </div>

            {/* Vincular recorrência */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={vincularRecorrencia} onChange={(e) => setVincularRecorrencia(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30" />
              <div>
                <span className="text-[0.8125rem] font-medium text-on-surface">Vincular à recorrência</span>
                <p className="text-[0.6875rem] text-on-surface-variant">Exige cadastro de cartão recorrente para baixa no SEI</p>
              </div>
            </label>

            {/* Observação */}
            <div>
              <label className="text-[0.8125rem] font-medium text-on-surface mb-1.5 block">Observação</label>
              <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)}
                placeholder="Notas sobre a negociação..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-white/70 text-[0.8125rem] text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:bg-white focus:shadow-sm transition-all resize-none" />
            </div>
          </div>
        )}

        {/* Resumo */}
        {podeEnviar && (
          <div className="bg-surface-container-low rounded-2xl p-5 space-y-3">
            <span className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-on-surface-variant/40">Resumo do acordo</span>
            <div className="flex items-center justify-between">
              <span className="text-[0.8125rem] text-on-surface-variant">Valor do acordo</span>
              <span className="text-lg font-bold text-on-surface">{formatarMoeda(calculos.valorFinalNum)}</span>
            </div>
            {calculos.desconto > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[0.8125rem] text-on-surface-variant">Desconto</span>
                <span className="text-[0.8125rem] font-semibold text-emerald-600">{formatarMoeda(calculos.desconto)} ({calculos.descontoPercent.toFixed(1)}%)</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[0.8125rem] text-on-surface-variant">Pagamentos</span>
              <span className="text-[0.8125rem] font-medium text-on-surface">{pagamentos.length}</span>
            </div>
            {pagamentos.map((pgto, idx) => {
              const v = parseFloat(pgto.valor.replace(/[^\d,.]/g, '').replace(',', '.')) || 0;
              return (
                <div key={pgto.id} className="flex items-center justify-between pl-4">
                  <span className="text-[0.75rem] text-on-surface-variant">
                    Pgto {idx + 1}: {formaPagamentoLabel[pgto.formaPagamento]}
                    {pgto.formaPagamento === 'CREDIT_CARD' && pgto.parcelas > 1 ? ` ${pgto.parcelas}x` : ''}
                  </span>
                  <span className="text-[0.75rem] font-medium text-on-surface">{formatarMoeda(v)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Botão criar */}
        <button disabled={!podeEnviar || enviando}
          onClick={async () => {
            if (!alunoSelecionado || !podeEnviar) return;
            setEnviando(true);
            try {
              await criarAcordo({
                pessoaCodigo: alunoSelecionado.codigo,
                pessoaNome: alunoSelecionado.nome,
                pessoaCpf: alunoSelecionado.cpf || '',
                matricula: alunoSelecionado.matricula,
                turmaIdentificador: alunoSelecionado.turmaIdentificador,
                cursoNome: alunoSelecionado.cursoNome,
                celularAluno: alunoSelecionado.celular,
                emailAluno: alunoSelecionado.email,
                valorOriginal: calculos.valorOriginal,
                valorMultaJuros: calculos.multaJuros,
                valorSaldoDevedor: calculos.saldoDevedor,
                descontoAcordo: calculos.desconto,
                descontoAcordoPercentual: calculos.descontoPercent,
                valorAcordo: calculos.valorFinalNum,
                vincularRecorrencia,
                observacao,
                parcelasOriginais: calculos.selecionadas.map(p => ({
                  contaReceberCodigo: p.codigo,
                  parcela: p.parcela,
                  valor: p.valor,
                  multa: p.multa || 0,
                  juro: p.juro || 0,
                  descontos: p.desconto || 0,
                  valorRecebido: p.valorRecebido || 0,
                  saldoDevedor: p.valor + (p.multa || 0) + (p.juro || 0) - (p.desconto || 0) - (p.valorRecebido || 0),
                  dataVencimento: p.dataVencimento,
                  tipoOrigem: p.tipoOrigem,
                })),
                pagamentos: pagamentos.map((pg, idx) => ({
                  numeroPagamento: idx + 1,
                  valor: parseFloat(pg.valor.replace(/[^\d,.]/g, '').replace(',', '.')) || 0,
                  formaPagamento: pg.formaPagamento,
                  parcelas: pg.parcelas,
                  dataVencimento: pg.dataVencimento,
                })),
              });
              onCriado?.();
            } catch (err) {
              console.error('Erro ao criar acordo:', err);
              alert('Erro ao criar negociação. Tente novamente.');
            } finally {
              setEnviando(false);
            }
          }}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-white font-semibold text-[0.9375rem] hover:bg-primary-container transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
          {enviando ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
          {enviando ? 'Criando...' : 'Criar negociação'}
        </button>
      </div>
    </Modal>
  );
}
