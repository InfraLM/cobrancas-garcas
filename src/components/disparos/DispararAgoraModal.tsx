import { useEffect, useMemo, useState } from 'react';
import { Loader2, Send, AlertTriangle, CheckCircle, XCircle, Receipt, User } from 'lucide-react';
import Modal from '../ui/Modal';
import type { TemplateBlip } from '../../types/templateBlip';
import type { RegraSegmentacao } from '../../types/segmentacao';
import { listarRegras } from '../../services/segmentacao';
import { preverDisparo, dispararAgora, resumoBatch } from '../../services/disparos';
import type { PrevisaoDisparo, ResumoBatch } from '../../services/disparos';

interface Props {
  template: TemplateBlip;
  onFechar: () => void;
}

type Fase = 'CONFIG' | 'CONFIRMANDO' | 'DISPARANDO' | 'FINALIZADO';

export default function DispararAgoraModal({ template, onFechar }: Props) {
  const [regras, setRegras] = useState<RegraSegmentacao[]>([]);
  const [segmentacaoId, setSegmentacaoId] = useState<string>('');
  const [previsao, setPrevisao] = useState<PrevisaoDisparo | null>(null);
  const [prevendo, setPrevendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>('CONFIG');
  const [disparoIds, setDisparoIds] = useState<string[]>([]);
  const [resumo, setResumo] = useState<ResumoBatch | null>(null);

  useEffect(() => {
    listarRegras().then(setRegras).catch(() => setRegras([]));
  }, []);

  // Filtra regras compativeis com o escopo do template.
  // Template TITULO aceita so regras TITULO. Template AMBOS aceita qualquer regra.
  const regrasCompativeis = useMemo(() => {
    const escopo = template.escopo || 'AMBOS';
    if (escopo === 'TITULO') {
      return regras.filter(r => (r.tipo || 'ALUNO') === 'TITULO');
    }
    return regras;
  }, [regras, template.escopo]);

  const escopoTemplate = template.escopo || 'AMBOS';
  const exigeTitulo = escopoTemplate === 'TITULO';

  async function handlePrever() {
    if (!segmentacaoId) { setErro('Selecione uma segmentação'); return; }
    setErro(null);
    setPrevendo(true);
    try {
      const p = await preverDisparo({ templateBlipId: template.id, segmentacaoId });
      setPrevisao(p);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao prever');
      setPrevisao(null);
    } finally {
      setPrevendo(false);
    }
  }

  async function handleConfirmar() {
    if (!previsao) return;
    setFase('DISPARANDO');
    setErro(null);
    try {
      const r = await dispararAgora({ templateBlipId: template.id, segmentacaoId });
      setDisparoIds(r.disparoIds);
      // Polling resumo
      const polling = setInterval(async () => {
        try {
          const res = await resumoBatch(r.disparoIds);
          setResumo(res);
          if (res.pendentes === 0) {
            clearInterval(polling);
            setFase('FINALIZADO');
          }
        } catch { /* ignora erros de polling */ }
      }, 2000);
      // Timeout de seguranca — 10min
      setTimeout(() => clearInterval(polling), 10 * 60 * 1000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao disparar');
      setFase('CONFIG');
    }
  }

  const resumoFinal = resumo || { enviados: 0, falhas: 0, pendentes: disparoIds.length };
  const totalBatch = disparoIds.length;
  const progresso = totalBatch > 0
    ? Math.round(((resumoFinal.enviados + resumoFinal.falhas) / totalBatch) * 100)
    : 0;

  return (
    <Modal
      aberto={true}
      onFechar={fase === 'DISPARANDO' ? () => {} : onFechar}
      titulo="Disparar mensagem agora"
      largura="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-[0.75rem] uppercase tracking-wider text-gray-500 font-semibold">Template selecionado</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-[0.875rem] font-medium text-gray-900">{template.titulo}</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.625rem] font-semibold ${exigeTitulo ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}>
              {exigeTitulo ? <><Receipt size={10} /> Exige por título</> : <><User size={10} /> Universal</>}
            </span>
          </div>
          <p className="text-[0.75rem] font-mono text-gray-400">{template.nomeBlip}</p>
        </div>

        {fase === 'CONFIG' && (
          <>
            <div>
              <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">
                Segmentação alvo
                {exigeTitulo && <span className="ml-2 text-[0.6875rem] font-normal text-violet-700">(apenas regras por TÍTULO)</span>}
              </label>
              <select
                value={segmentacaoId}
                onChange={e => { setSegmentacaoId(e.target.value); setPrevisao(null); }}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem] bg-white"
              >
                <option value="">Selecione...</option>
                {regrasCompativeis.map(r => {
                  const tipoR = r.tipo || 'ALUNO';
                  const contador = tipoR === 'TITULO'
                    ? (typeof r.totalTitulos === 'number' ? `${r.totalTitulos} títulos` : '')
                    : (typeof r.totalAlunos === 'number' ? `${r.totalAlunos} alunos` : '');
                  return (
                    <option key={r.id} value={r.id}>
                      {tipoR === 'TITULO' ? '📎 ' : '👤 '}{r.nome}{contador ? ` · ${contador}` : ''}
                    </option>
                  );
                })}
              </select>
              {regrasCompativeis.length === 0 && exigeTitulo && (
                <p className="text-[0.6875rem] text-amber-700 mt-1">
                  Nenhuma segmentação por título cadastrada. Crie uma em /segmentacao para disparar este template.
                </p>
              )}
              <p className="text-[0.6875rem] text-gray-400 mt-1">
                A segmentação será re-executada ao disparar — {exigeTitulo ? 'títulos pagos ou fora do escopo já foram removidos' : 'alunos que pagaram já foram removidos'}.
              </p>
            </div>

            <button
              onClick={handlePrever}
              disabled={!segmentacaoId || prevendo}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-gray-100 text-gray-700 text-[0.8125rem] hover:bg-gray-200 disabled:opacity-50"
            >
              {prevendo ? <Loader2 size={13} className="animate-spin" /> : null}
              Prever disparo
            </button>

            {previsao && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 space-y-2">
                {previsao.tipo === 'TITULO' ? (
                  <>
                    <p className="text-[0.875rem] font-semibold text-emerald-800">
                      {previsao.totalComTelefone} mensagens serão enviadas
                    </p>
                    <p className="text-[0.75rem] text-emerald-700">
                      {previsao.totalEncontrados} títulos encontrados
                      {previsao.alunosUnicos ? ` · ${previsao.alunosUnicos} aluno${previsao.alunosUnicos !== 1 ? 's' : ''} único${previsao.alunosUnicos !== 1 ? 's' : ''}` : ''}
                      {typeof previsao.valorTotal === 'number' ? ` · ${previsao.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} total` : ''}
                      {previsao.totalSemTelefone > 0 ? ` · ${previsao.totalSemTelefone} sem telefone` : ''}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[0.875rem] font-semibold text-emerald-800">
                      {previsao.totalComTelefone} aluno{previsao.totalComTelefone !== 1 ? 's' : ''} receberão a mensagem
                    </p>
                    <p className="text-[0.75rem] text-emerald-700">
                      Encontrados: {previsao.totalEncontrados}
                      {previsao.totalSemTelefone > 0 && <> · Sem telefone: {previsao.totalSemTelefone}</>}
                    </p>
                  </>
                )}
                {previsao.amostra.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[0.6875rem] uppercase tracking-wider text-emerald-600 font-semibold">Amostra</p>
                    <ul className="mt-1 space-y-0.5">
                      {previsao.amostra.slice(0, 5).map((a, i) => (
                        <li key={`${a.codigo}-${i}`} className="text-[0.75rem] text-emerald-800">
                          · {a.nome}
                          {previsao.tipo === 'TITULO' && typeof a.tituloValor === 'number' && (
                            <span className="text-emerald-600"> — {a.tituloValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              {typeof a.diasAteVenc === 'number' && (
                                <> · {a.diasAteVenc === 0 ? 'vence hoje' : a.diasAteVenc > 0 ? `em ${a.diasAteVenc}d` : `venceu há ${Math.abs(a.diasAteVenc)}d`}</>
                              )}
                            </span>
                          )}
                        </li>
                      ))}
                      {previsao.amostra.length > 5 && <li className="text-[0.6875rem] text-emerald-600">e mais...</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {erro && <p className="text-[0.8125rem] text-red-600">{erro}</p>}

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="text-[0.75rem] text-amber-700 flex items-center gap-1.5">
                <AlertTriangle size={14} /> Disparo não pode ser desfeito
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onFechar}
                  className="px-4 py-2 rounded-lg text-[0.8125rem] text-gray-500 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmar}
                  disabled={!previsao || previsao.totalComTelefone === 0}
                  className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-emerald-600 text-white text-[0.8125rem] font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Send size={13} /> Confirmar e disparar
                </button>
              </div>
            </div>
          </>
        )}

        {(fase === 'DISPARANDO' || fase === 'FINALIZADO') && (
          <>
            <div className="p-4 rounded-xl bg-gray-50 space-y-3">
              <div className="flex items-center gap-2">
                {fase === 'DISPARANDO' ? (
                  <Loader2 size={16} className="animate-spin text-primary" />
                ) : (
                  <CheckCircle size={16} className="text-emerald-600" />
                )}
                <p className="text-[0.875rem] font-semibold text-gray-900">
                  {fase === 'DISPARANDO' ? 'Disparando mensagens...' : 'Disparo concluído'}
                </p>
              </div>

              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${progresso}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[0.75rem]">
                <div className="p-2 rounded-md bg-emerald-50">
                  <p className="font-semibold text-emerald-700">{resumoFinal.enviados}</p>
                  <p className="text-[0.6875rem] text-emerald-600">enviados</p>
                </div>
                <div className="p-2 rounded-md bg-gray-100">
                  <p className="font-semibold text-gray-700">{resumoFinal.pendentes}</p>
                  <p className="text-[0.6875rem] text-gray-500">pendentes</p>
                </div>
                <div className="p-2 rounded-md bg-red-50">
                  <p className="font-semibold text-red-700">{resumoFinal.falhas}</p>
                  <p className="text-[0.6875rem] text-red-600">falhas</p>
                </div>
              </div>

              {fase === 'DISPARANDO' && (
                <p className="text-[0.75rem] text-gray-500 text-center">
                  Cada mensagem tem wait de 2s para respeitar rate limit da Blip.
                  Você pode fechar este modal — o disparo continua em background.
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                onClick={onFechar}
                className="h-9 px-5 rounded-lg bg-gray-900 text-white text-[0.8125rem] font-medium hover:bg-gray-800"
              >
                {fase === 'FINALIZADO' ? 'Fechar' : 'Fechar (continua em background)'}
              </button>
            </div>
          </>
        )}

        {fase === 'CONFIG' && erro && (
          <div className="flex items-center gap-2 text-red-600">
            <XCircle size={14} />
            <p className="text-[0.8125rem]">{erro}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
