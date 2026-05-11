import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  obterMatrizRecuperacao,
  METODOS_MATRIZ,
  type MatrizRecuperacaoResponse,
  type ModoFiltroMatriz,
} from '../../services/dashboard';

// Mapeia metodo (label da matriz) para os filtros do endpoint /acordos
function filtrosNegociacaoDoMetodo(metodo: string): Record<string, string> {
  switch (metodo) {
    case 'Cartão à vista': return { formaPagamento: 'CREDIT_CARD' };
    case 'Cartão 2-6x':    return { formaPagamento: 'CREDIT_CARD' };
    case 'Cartão 7-12x':   return { formaPagamento: 'CREDIT_CARD' };
    case 'Boleto':         return { formaPagamento: 'BOLETO' };
    case 'Pix':            return { formaPagamento: 'PIX' };
    case 'Ficou Fácil':    return { incluirFicouFacil: 'true' };
    default:               return {};
  }
}

function agingDaCategoria(cat: string): string {
  if (cat === 'Baixa') return 'baixa';
  if (cat === 'Média') return 'media';
  if (cat === 'Alta')  return 'alta';
  return '';
}

type ValorMostrado = 'bruto' | 'liquido';
type FormatoValor = 'compacto' | 'completo';

interface Props {
  agenteIds: number[];
  inicio: string;
  fim: string;
  onChangeInicio: (v: string) => void;
  onChangeFim: (v: string) => void;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtK(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return fmt(v);
}

function fmtSwitch(v: number, formato: FormatoValor) {
  return formato === 'compacto' ? fmtK(v) : fmt(v);
}

const CATEGORIA_COR: Record<string, string> = {
  'Baixa': '#10b981', // verde
  'Média': '#f59e0b', // ambar
  'Alta': '#ef4444',  // vermelho
};

const CATEGORIA_HINT: Record<string, string> = {
  'Baixa': 'Aluno cuja parcela mais antiga do acordo tinha 0–60 dias de atraso (até ~2 parcelas vencidas).',
  'Média': 'Aluno cuja parcela mais antiga do acordo tinha 61–150 dias de atraso (3–5 parcelas vencidas).',
  'Alta': 'Aluno cuja parcela mais antiga do acordo tinha mais de 150 dias de atraso (6+ parcelas vencidas).',
};


export default function MatrizRecuperacao({
  agenteIds,
  inicio,
  fim,
  onChangeInicio,
  onChangeFim,
}: Props) {
  const navigate = useNavigate();
  const [matriz, setMatriz] = useState<MatrizRecuperacaoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [modoFiltro, setModoFiltro] = useState<ModoFiltroMatriz>('negociado');
  const [valorMostrado, setValorMostrado] = useState<ValorMostrado>('bruto');
  const [formatoValor, setFormatoValor] = useState<FormatoValor>('compacto');

  // Drill-down: clique em celula da matriz navega para /negociacoes com filtros aplicados
  function irParaNegociacoes(categoria: string, metodo?: string) {
    const sp = new URLSearchParams();
    // Em modo "pago" usa filtro de concluidoEm; em "negociado" usa criadoEm
    if (modoFiltro === 'pago') {
      sp.set('inicioConcluido', inicio);
      sp.set('fimConcluido', fim);
      sp.set('etapa', 'CONCLUIDO');
    } else {
      sp.set('inicio', inicio);
      sp.set('fim', fim);
    }
    const aging = agingDaCategoria(categoria);
    if (aging) sp.set('aging', aging);
    if (metodo) {
      const filtrosMet = filtrosNegociacaoDoMetodo(metodo);
      for (const [k, v] of Object.entries(filtrosMet)) sp.set(k, v);
    }
    if (agenteIds.length > 0) sp.set('criadoPor', agenteIds.join(','));
    navigate(`/negociacoes?${sp.toString()}`);
  }

  useEffect(() => {
    setLoading(true);
    obterMatrizRecuperacao({ inicio, fim, modoFiltro, agenteIds })
      .then(setMatriz)
      .catch(e => console.error('Erro matriz-recuperacao:', e))
      .finally(() => setLoading(false));
  }, [inicio, fim, modoFiltro, JSON.stringify(agenteIds)]);

  const valorChave = valorMostrado === 'bruto' ? 'valorBruto' : 'valorLiquido';

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h3
            className="text-[0.8125rem] font-bold"
            title="Matriz cruzando categoria de inadimplência (Baixa: 0–60 dias / Média: 61–150 / Alta: 150+) com método de pagamento. Bruto = valor reconhecido. Líquido = valor após taxas Asaas (vem do payment.netValue). Categorização usa a parcela MAIS ANTIGA do acordo."
          >
            Recuperação por Categoria de Inadimplência
          </h3>
          <p className="text-[0.6875rem] text-on-surface-variant">
            Aging do acordo × método de pagamento — passe o mouse sobre as categorias para ver detalhes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle bruto/liquido */}
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-[0.6875rem]">
            <button
              onClick={() => setValorMostrado('bruto')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                valorMostrado === 'bruto'
                  ? 'bg-white shadow-sm font-semibold text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Bruto
            </button>
            <button
              onClick={() => setValorMostrado('liquido')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                valorMostrado === 'liquido'
                  ? 'bg-white shadow-sm font-semibold text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Líquido
            </button>
          </div>
          {/* Toggle formato */}
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-[0.6875rem]">
            <button
              onClick={() => setFormatoValor('compacto')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                formatoValor === 'compacto'
                  ? 'bg-white shadow-sm font-semibold text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="Mostrar valores arredondados (R$ 11k)"
            >
              Compacto
            </button>
            <button
              onClick={() => setFormatoValor('completo')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                formatoValor === 'completo'
                  ? 'bg-white shadow-sm font-semibold text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="Mostrar valores completos (R$ 11.500,00)"
            >
              Completo
            </button>
          </div>
          {/* Toggle modo filtro */}
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-[0.6875rem]">
            <button
              onClick={() => setModoFiltro('negociado')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                modoFiltro === 'negociado'
                  ? 'bg-white shadow-sm font-semibold text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="Acordos cuja data de criação está no período"
            >
              Negociado
            </button>
            <button
              onClick={() => setModoFiltro('pago')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                modoFiltro === 'pago'
                  ? 'bg-white shadow-sm font-semibold text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="Pagamentos confirmados no período (independente de quando o acordo foi criado)"
            >
              Pago
            </button>
          </div>
          {/* Datas */}
          <input
            type="date"
            value={inicio}
            onChange={(e) => onChangeInicio(e.target.value)}
            className="px-2 py-1 rounded-md border border-gray-200 text-[0.6875rem]"
          />
          <span className="text-[0.6875rem] text-on-surface-variant">até</span>
          <input
            type="date"
            value={fim}
            onChange={(e) => onChangeFim(e.target.value)}
            className="px-2 py-1 rounded-md border border-gray-200 text-[0.6875rem]"
          />
        </div>
      </div>

      {/* Conteudo */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      ) : !matriz || matriz.totais.qtdAlunos === 0 ? (
        <p className="text-[0.8125rem] text-on-surface-variant py-8 text-center">
          Nenhum pagamento registrado no período
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[0.75rem] border-collapse">
            <thead>
              <tr className="text-on-surface-variant text-[0.6875rem]">
                <th className="text-left py-2 px-2 font-semibold w-20">Categoria</th>
                {METODOS_MATRIZ.map(m => (
                  <th key={m} className="text-right py-2 px-2 font-semibold">
                    {m}
                  </th>
                ))}
                <th className="text-right py-2 px-2 font-semibold border-l border-gray-200">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {matriz.matriz.map(linha => (
                <tr key={linha.categoria} className="border-t border-gray-100">
                  <td className="py-2 px-2">
                    <span
                      className="inline-block px-2 py-0.5 rounded-md font-semibold text-[0.6875rem]"
                      style={{
                        color: CATEGORIA_COR[linha.categoria],
                        backgroundColor: `${CATEGORIA_COR[linha.categoria]}15`,
                        cursor: 'help',
                      }}
                      title={CATEGORIA_HINT[linha.categoria]}
                    >
                      {linha.categoria}
                    </span>
                  </td>
                  {METODOS_MATRIZ.map(m => {
                    const c = linha.metodos[m];
                    const valor = c?.[valorChave] ?? 0;
                    const clicavel = valor > 0;
                    return (
                      <td
                        key={m}
                        onClick={clicavel ? () => irParaNegociacoes(linha.categoria, m) : undefined}
                        className={`text-right py-2 px-2 tabular-nums ${clicavel ? 'cursor-pointer hover:bg-primary/5 transition-colors' : ''}`}
                        title={
                          c && c.qtdAlunos > 0
                            ? `Clique para ver os ${c.qtdAlunos} aluno${c.qtdAlunos > 1 ? 's' : ''}\nBruto ${fmt(c.valorBruto)} • Líquido ${fmt(c.valorLiquido)}`
                            : undefined
                        }
                      >
                        {valor > 0 ? (
                          <>
                            <div className="font-medium">{fmtSwitch(valor, formatoValor)}</div>
                            <div className="text-[0.5625rem] text-on-surface-variant">
                              {c.qtdAlunos} aluno{c.qtdAlunos > 1 ? 's' : ''}
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td
                    onClick={linha.totalCategoria.qtdAlunos > 0 ? () => irParaNegociacoes(linha.categoria) : undefined}
                    className={`text-right py-2 px-2 tabular-nums border-l border-gray-200 font-semibold ${linha.totalCategoria.qtdAlunos > 0 ? 'cursor-pointer hover:bg-primary/5 transition-colors' : ''}`}
                    title={linha.totalCategoria.qtdAlunos > 0 ? `Clique para ver os ${linha.totalCategoria.qtdAlunos} aluno${linha.totalCategoria.qtdAlunos > 1 ? 's' : ''} da categoria ${linha.categoria}` : undefined}
                  >
                    <div>{fmtSwitch(linha.totalCategoria[valorChave], formatoValor)}</div>
                    <div className="text-[0.5625rem] text-on-surface-variant font-normal">
                      {linha.totalCategoria.qtdAlunos} aluno{linha.totalCategoria.qtdAlunos !== 1 ? 's' : ''}
                    </div>
                  </td>
                </tr>
              ))}
              {/* Total geral */}
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="py-2 px-2 font-bold text-[0.6875rem]">Total</td>
                {METODOS_MATRIZ.map(m => {
                  const total = matriz.matriz.reduce(
                    (acc, linha) => acc + (linha.metodos[m]?.[valorChave] ?? 0),
                    0
                  );
                  const totalAlunos = matriz.matriz.reduce(
                    (acc, linha) => acc + (linha.metodos[m]?.qtdAlunos ?? 0),
                    0
                  );
                  return (
                    <td key={m} className="text-right py-2 px-2 tabular-nums font-semibold">
                      {total > 0 ? (
                        <>
                          <div>{fmtSwitch(total, formatoValor)}</div>
                          <div className="text-[0.5625rem] text-on-surface-variant font-normal">
                            {totalAlunos}
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="text-right py-2 px-2 tabular-nums border-l border-gray-200 font-bold text-on-surface">
                  <div>{fmtSwitch(matriz.totais[valorChave], formatoValor)}</div>
                  <div className="text-[0.5625rem] text-on-surface-variant font-normal">
                    {matriz.totais.qtdAlunos} aluno{matriz.totais.qtdAlunos !== 1 ? 's' : ''}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Diferenca bruto vs liquido */}
          {valorMostrado === 'liquido' && matriz.totais.valorBruto > 0 && (
            <div className="mt-3 text-[0.6875rem] text-on-surface-variant flex items-center gap-3">
              <span>
                Bruto total: <span className="font-semibold">{fmt(matriz.totais.valorBruto)}</span>
              </span>
              <span>•</span>
              <span>
                Taxas Asaas:{' '}
                <span className="font-semibold text-red-600">
                  {fmt(matriz.totais.valorBruto - matriz.totais.valorLiquido)}
                </span>{' '}
                (
                {(
                  ((matriz.totais.valorBruto - matriz.totais.valorLiquido) /
                    matriz.totais.valorBruto) *
                  100
                ).toFixed(2)}
                %)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
