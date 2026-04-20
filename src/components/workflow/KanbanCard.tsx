import type { AcordoFinanceiro } from '../../types/acordo';

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function tempoRelativo(data: string) {
  const diff = Math.floor((Date.now() - new Date(data).getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return '1d';
  if (diff < 7) return `${diff}d`;
  if (diff < 30) return `${Math.floor(diff / 7)}sem`;
  return `${Math.floor(diff / 30)}m`;
}

export default function KanbanCard({ acordo, onClick }: { acordo: AcordoFinanceiro; onClick: () => void }) {
  const pgtosPagos = acordo.pagamentos.filter(p => p.situacao === 'CONFIRMADO').length;
  const totalPgtos = acordo.pagamentos.length;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg px-3 py-2.5 cursor-pointer border border-gray-100 hover:border-gray-200 transition-colors"
    >
      {/* Linha 1: Nome + tempo */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.8125rem] font-medium text-gray-900 truncate">{acordo.pessoaNome}</p>
        <span className="text-[0.625rem] text-gray-300 shrink-0">{tempoRelativo(acordo.criadoEm)}</span>
      </div>

      {/* Linha 2: Valor + desconto + meta */}
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[0.875rem] font-bold text-gray-900">{formatarMoeda(Number(acordo.valorAcordo))}</span>
        {Number(acordo.descontoAcordoPercentual) > 0 && (
          <span className="text-[0.625rem] text-emerald-600">-{Number(acordo.descontoAcordoPercentual).toFixed(1)}%</span>
        )}
        {acordo.etapa === 'CHECANDO_PAGAMENTO' && totalPgtos > 0 && (
          <span className={`text-[0.625rem] ml-auto ${pgtosPagos === totalPgtos ? 'text-emerald-600' : 'text-gray-400'}`}>
            {pgtosPagos}/{totalPgtos}
          </span>
        )}
        {acordo.negociacaoContaReceberCodigo && (
          <span className="text-[0.625rem] font-mono text-gray-300 ml-auto">#{acordo.negociacaoContaReceberCodigo}</span>
        )}
      </div>

      {/* Linha 3: Status assinatura + Agente */}
      <div className="flex items-center gap-2 mt-1.5">
        {acordo.etapa === 'TERMO_ENVIADO' && (
          acordo.termoAssinadoEm ? (
            <span className="text-[0.5625rem] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">Assinado</span>
          ) : (
            <span className="text-[0.5625rem] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">Aguardando assinatura</span>
          )
        )}
        {acordo.vincularRecorrencia && (
          <span className="text-[0.5625rem] font-medium px-1.5 py-0.5 rounded bg-violet-50 text-violet-600">Recorrência</span>
        )}
        <p className="text-[0.625rem] text-gray-300 ml-auto">{acordo.criadoPorNome}</p>
      </div>
    </div>
  );
}
