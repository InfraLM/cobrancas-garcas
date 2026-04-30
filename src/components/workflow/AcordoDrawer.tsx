import { useState } from 'react';
import type { AcordoFinanceiro } from '../../types/acordo';
import { etapaLabel, etapaCor } from '../../types/acordo';
import Drawer from '../ui/Drawer';
import { getAvatarColor, getIniciais } from '../../utils/avatarColor';
import EtapaSelecao from './etapas/EtapaSelecao';
import EtapaTermoEnviado from './etapas/EtapaTermoEnviado';
import EtapaCobrancaCriada from './etapas/EtapaCobrancaCriada';
import EtapaVincularSei from './etapas/EtapaVincularSei';
import EtapaChecandoPagamento from './etapas/EtapaChecandoPagamento';
import EtapaConcluido from './etapas/EtapaConcluido';
import ModalCancelarNegociacao from './ModalCancelarNegociacao';
import {
  ClipboardList,
  FileSignature,
  CreditCard,
  Link2,
  Clock,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

const etapaIcone: Record<string, LucideIcon> = {
  SELECAO: ClipboardList,
  TERMO_ENVIADO: FileSignature,
  ACORDO_GERADO: CreditCard,
  SEI_VINCULADO: Link2,
  CHECANDO_PAGAMENTO: Clock,
  CONCLUIDO: CheckCircle2,
};

interface AcordoDrawerProps {
  acordo: AcordoFinanceiro | null;
  aberto: boolean;
  onFechar: () => void;
  onAtualizado?: () => void;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AcordoDrawer({ acordo, aberto, onFechar, onAtualizado }: AcordoDrawerProps) {
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  if (!acordo) return null;

  const cor = getAvatarColor(acordo.pessoaNome);
  const iniciais = getIniciais(acordo.pessoaNome);
  const cores = etapaCor[acordo.etapa];
  const Icone = etapaIcone[acordo.etapa] || ClipboardList;
  const podeCancelar = acordo.etapa !== 'CONCLUIDO' && acordo.etapa !== 'CANCELADO';

  function renderEtapa() {
    switch (acordo!.etapa) {
      case 'SELECAO': return <EtapaSelecao acordo={acordo!} onAtualizado={onAtualizado} />;
      case 'TERMO_ENVIADO': return <EtapaTermoEnviado acordo={acordo!} onAtualizado={onAtualizado} />;
      case 'ACORDO_GERADO': return <EtapaCobrancaCriada acordo={acordo!} onAtualizado={onAtualizado} />;
      case 'SEI_VINCULADO': return <EtapaVincularSei acordo={acordo!} onAtualizado={onAtualizado} />;
      case 'CHECANDO_PAGAMENTO': return <EtapaChecandoPagamento acordo={acordo!} onAtualizado={onAtualizado} />;
      case 'CONCLUIDO': return <EtapaConcluido acordo={acordo!} onAtualizado={onAtualizado} />;
      default: return null;
    }
  }

  return (
    <Drawer aberto={aberto} onFechar={onFechar} largura="w-[560px]">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-br from-surface-container-low to-surface px-6 pt-6 pb-5">
        {/* Etapa badge + acao de cancelar */}
        <div className="flex items-center justify-between mb-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${cores.bg}`}>
            <Icone size={14} className={cores.text} />
            <span className={`text-[0.75rem] font-semibold ${cores.text}`}>{etapaLabel[acordo.etapa]}</span>
          </div>
          {podeCancelar && (
            <button
              onClick={() => setModalCancelarAberto(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.75rem] text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <XCircle size={14} />
              Cancelar negociação
            </button>
          )}
        </div>

        {/* Aluno */}
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 shadow-sm"
            style={{ backgroundColor: cor.bg, color: cor.text }}
          >
            {iniciais}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-on-surface truncate">{acordo.pessoaNome}</h2>
            <p className="text-[0.8125rem] text-on-surface-variant mt-0.5">
              {acordo.cursoNome} · {acordo.turmaIdentificador}
            </p>
          </div>
        </div>

        {/* Resumo financeiro */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="bg-white/60 rounded-xl px-4 py-3">
            <span className="text-[0.5625rem] font-bold uppercase tracking-[0.1em] text-on-surface-variant/40">Saldo devedor</span>
            <p className="text-sm font-bold text-on-surface mt-0.5">{formatarMoeda(Number(acordo.valorSaldoDevedor))}</p>
          </div>
          <div className="bg-white/60 rounded-xl px-4 py-3">
            <span className="text-[0.5625rem] font-bold uppercase tracking-[0.1em] text-on-surface-variant/40">Desconto</span>
            <p className="text-sm font-bold text-emerald-600 mt-0.5">
              {Number(acordo.descontoAcordoPercentual) > 0 ? `${Number(acordo.descontoAcordoPercentual).toFixed(1)}%` : formatarMoeda(Number(acordo.descontoAcordo))}
            </p>
          </div>
          <div className="bg-primary/5 rounded-xl px-4 py-3">
            <span className="text-[0.5625rem] font-bold uppercase tracking-[0.1em] text-primary/50">Valor acordo</span>
            <p className="text-sm font-bold text-primary mt-0.5">{formatarMoeda(Number(acordo.valorAcordo))}</p>
          </div>
        </div>

        {/* Parcelas resumo */}
        <div className="mt-3 flex items-center gap-3 text-[0.75rem] text-on-surface-variant">
          <span>{acordo.pagamentos.length} pagamento{acordo.pagamentos.length !== 1 ? 's' : ''}</span>
          <span className="text-on-surface-variant/20">·</span>
          <span>Agente: {acordo.criadoPorNome}</span>
          {acordo.negociacaoContaReceberCodigo && (
            <>
              <span className="text-on-surface-variant/20">·</span>
              <span className="text-indigo-600 font-mono">SEI #{acordo.negociacaoContaReceberCodigo}</span>
            </>
          )}
        </div>
      </div>

      {/* Conteúdo da etapa */}
      <div className="px-6 py-5">
        {renderEtapa()}
      </div>

      {/* Histórico de etapas */}
      <div className="px-6 pb-6">
        <div className="border-t border-gray-100 pt-5">
          <span className="text-[0.625rem] font-bold uppercase tracking-wider text-on-surface-variant/40">Histórico</span>
          <div className="mt-3 space-y-0">
            {[
              { label: 'Negociação criada', data: acordo.criadoEm, icone: ClipboardList, cor: 'text-sky-500' },
              { label: 'Termo enviado', data: acordo.termoEnviadoEm, icone: FileSignature, cor: 'text-violet-500' },
              { label: 'Termo assinado', data: acordo.termoAssinadoEm, icone: CheckCircle2, cor: 'text-emerald-500' },
              { label: 'Cobrança gerada', data: acordo.acordoGeradoEm, icone: CreditCard, cor: 'text-amber-500' },
              { label: 'SEI vinculado', data: acordo.seiVinculadoEm, icone: Link2, cor: 'text-indigo-500' },
              { label: 'Cancelado', data: acordo.canceladoEm, icone: Clock, cor: 'text-red-500', detalhe: acordo.motivoCancelamento },
            ].filter(e => e.data).map((etapa, idx) => {
              const EtapaIcone = etapa.icone;
              return (
                <div key={idx} className="flex items-start gap-3 py-2">
                  <div className="flex flex-col items-center pt-0.5">
                    <EtapaIcone size={14} className={etapa.cor} />
                    {idx < 5 && <div className="w-px h-4 bg-gray-100 mt-1" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.8125rem] text-on-surface">{etapa.label}</span>
                      <span className="text-[0.75rem] text-on-surface-variant/60 shrink-0 ml-2">
                        {new Date(etapa.data!).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {(etapa as any).detalhe && (
                      <p className="text-[0.6875rem] text-on-surface-variant/80 mt-0.5 italic">
                        “{(etapa as any).detalhe}”
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal de cancelamento */}
      <ModalCancelarNegociacao
        acordo={acordo}
        aberto={modalCancelarAberto}
        onFechar={() => setModalCancelarAberto(false)}
        onCancelado={() => { onAtualizado?.(); onFechar(); }}
      />
    </Drawer>
  );
}
