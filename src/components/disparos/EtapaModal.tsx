import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Receipt, Trash2, Eye, Info } from 'lucide-react';
import Modal from '../ui/Modal';
import type { ReguaCobranca, EtapaRegua, SimulacaoEtapa } from '../../types/reguaCobranca';
import type { TemplateBlip } from '../../types/templateBlip';
import type { RegraSegmentacao } from '../../types/segmentacao';
import { listarTemplatesBlip } from '../../services/templatesBlip';
import { listarRegrasComFiltros } from '../../services/segmentacao';
import { criarEtapa, atualizarEtapa, removerEtapa, simularEtapa, previewMensagemEtapa } from '../../services/reguas';
import NovaRegraModal from '../segmentacao/NovaRegraModal';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  regua: ReguaCobranca;
  etapaEditando?: EtapaRegua | null;
  onSalvo: () => void;
}

export default function EtapaModal({ aberto, onFechar, regua, etapaEditando, onSalvo }: Props) {
  const [nome, setNome] = useState('');
  const [dias, setDias] = useState<number>(-7);
  const [direcao, setDirecao] = useState<'antes' | 'depois' | 'dia'>('antes');
  const [templateBlipId, setTemplateBlipId] = useState<string>('');
  const [segmentacaoId, setSegmentacaoId] = useState<string>('');
  const [horario, setHorario] = useState<string>('');
  const [ativo, setAtivo] = useState(true);

  const [templates, setTemplates] = useState<TemplateBlip[]>([]);
  const [segmentacoes, setSegmentacoes] = useState<RegraSegmentacao[]>([]);
  const [simulacao, setSimulacao] = useState<SimulacaoEtapa | null>(null);
  const [previewTexto, setPreviewTexto] = useState<string>('');
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novaSegAberto, setNovaSegAberto] = useState(false);

  // Init
  useEffect(() => {
    if (!aberto) return;
    (async () => {
      setCarregando(true);
      try {
        const [tpls, segs] = await Promise.all([
          listarTemplatesBlip({ ativo: true }),
          listarRegrasComFiltros({ reguaOwnerId: regua.id, tipo: 'TITULO' }),
        ]);
        setTemplates(tpls);
        setSegmentacoes(segs);
      } finally {
        setCarregando(false);
      }
    })();
  }, [aberto, regua.id]);

  // Preenche estado ao editar
  useEffect(() => {
    if (!aberto) return;
    if (etapaEditando) {
      setNome(etapaEditando.nome);
      const d = etapaEditando.diasRelativoVenc;
      if (d === 0) { setDirecao('dia'); setDias(0); }
      else if (d < 0) { setDirecao('antes'); setDias(Math.abs(d)); }
      else { setDirecao('depois'); setDias(d); }
      setTemplateBlipId(etapaEditando.templateBlipId);
      setSegmentacaoId(etapaEditando.segmentacaoId);
      setHorario(etapaEditando.horario || '');
      setAtivo(etapaEditando.ativo);
    } else {
      setNome('');
      setDirecao('antes');
      setDias(7);
      setTemplateBlipId('');
      setSegmentacaoId('');
      setHorario('');
      setAtivo(true);
    }
    setSimulacao(null);
    setPreviewTexto('');
    setErro(null);
  }, [etapaEditando, aberto]);

  const templateSelecionado = useMemo(
    () => templates.find(t => t.id === templateBlipId),
    [templates, templateBlipId]
  );

  const diasRelativoVenc = direcao === 'dia' ? 0 : direcao === 'antes' ? -Math.abs(dias) : Math.abs(dias);

  async function handleSimular() {
    if (!etapaEditando) {
      setErro('Salve a etapa antes de simular');
      return;
    }
    setErro(null);
    try {
      const s = await simularEtapa(regua.id, etapaEditando.id);
      setSimulacao(s);
      const pr = await previewMensagemEtapa(regua.id, etapaEditando.id);
      setPreviewTexto(pr.preview);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao simular');
    }
  }

  async function handleSalvar() {
    setErro(null);
    if (!templateBlipId) { setErro('Selecione um template'); return; }
    if (!segmentacaoId) { setErro('Selecione ou crie uma segmentação'); return; }

    const payload = {
      nome: nome.trim() || undefined,
      diasRelativoVenc,
      templateBlipId,
      segmentacaoId,
      horario: horario || null,
      ativo,
    };

    setSalvando(true);
    try {
      if (etapaEditando) {
        await atualizarEtapa(regua.id, etapaEditando.id, payload);
      } else {
        await criarEtapa(regua.id, payload);
      }
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemover() {
    if (!etapaEditando) return;
    if (!confirm(`Remover etapa "${etapaEditando.nome}"?`)) return;
    setSalvando(true);
    try {
      await removerEtapa(regua.id, etapaEditando.id);
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao remover');
    } finally {
      setSalvando(false);
    }
  }

  // Filtra templates compativeis (TITULO ou AMBOS — todos sao TITULO aqui, entao todos passam)
  const templatesCompativeis = templates.filter(t => t.ativo);

  return (
    <>
      <Modal
        aberto={aberto}
        onFechar={salvando ? () => {} : onFechar}
        titulo={etapaEditando ? 'Editar etapa' : 'Nova etapa'}
        largura="max-w-2xl"
      >
        {carregando ? (
          <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50/50 border border-sky-100">
              <Info size={14} className="text-sky-600 mt-0.5 shrink-0" />
              <div className="text-[0.75rem] text-sky-800 space-y-1">
                <p>A segmentação é consultada <span className="font-semibold">no momento exato do disparo</span>. Títulos que mudaram de situação (ex: aluno pagou) entre ativação e envio são automaticamente excluídos.</p>
                <p className="text-sky-700">Réguas automáticas disparam por vencimento de título. Para gatilhos não-temporais (plantão, engajamento, etc.) use <span className="font-semibold">Disparar agora</span> na aba Templates.</p>
              </div>
            </div>

            <div>
              <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Nome da etapa</label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: 7 dias antes — rec inativa"
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem]"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Quantos dias</label>
                <input
                  type="number"
                  value={dias}
                  onChange={e => setDias(Math.max(0, Number(e.target.value) || 0))}
                  disabled={direcao === 'dia'}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem]"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Quando</label>
                <select
                  value={direcao}
                  onChange={e => setDirecao(e.target.value as 'antes' | 'depois' | 'dia')}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem] bg-white"
                >
                  <option value="antes">Antes do vencimento</option>
                  <option value="dia">No dia do vencimento</option>
                  <option value="depois">Depois do vencimento</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Template Blip</label>
              <select
                value={templateBlipId}
                onChange={e => setTemplateBlipId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem] bg-white"
              >
                <option value="">Selecione...</option>
                {templatesCompativeis.map(t => (
                  <option key={t.id} value={t.id}>{t.titulo} ({t.nomeBlip})</option>
                ))}
              </select>
              {templateSelecionado && (
                <div className="mt-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-[0.6875rem] uppercase tracking-wider text-gray-500 font-semibold mb-1">Preview do template</p>
                  <pre className="text-[0.75rem] text-gray-700 whitespace-pre-wrap font-sans">{templateSelecionado.conteudoPreview}</pre>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Segmentação (por título)</label>
              <div className="flex gap-2">
                <select
                  value={segmentacaoId}
                  onChange={e => setSegmentacaoId(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem] bg-white"
                >
                  <option value="">Selecione ou crie...</option>
                  <optgroup label="Específicas desta régua">
                    {segmentacoes.filter(s => s.reguaOwnerId === regua.id).map(s => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Globais compatíveis">
                    {segmentacoes.filter(s => s.escopoUso === 'GLOBAL').map(s => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </optgroup>
                </select>
                <button
                  type="button"
                  onClick={() => setNovaSegAberto(true)}
                  className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-emerald-600 text-white text-[0.75rem] hover:bg-emerald-700"
                  title="Criar segmentação específica para esta etapa"
                >
                  <Plus size={12} /> Criar
                </button>
              </div>
              <p className="text-[0.6875rem] text-gray-400 mt-1">
                Segmentação criada aqui fica vinculada a esta régua e não aparece em /segmentação.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">
                  Horário de disparo
                  <span className="ml-1 text-[0.6875rem] font-normal text-gray-400">(padrão {regua.horarioPadrao})</span>
                </label>
                <input
                  type="time"
                  value={horario}
                  onChange={e => setHorario(e.target.value)}
                  placeholder={regua.horarioPadrao}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem]"
                />
              </div>
              <div>
                <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Status</label>
                <div className="flex items-center gap-2 h-9">
                  <input
                    type="checkbox"
                    id="etapa-ativa"
                    checked={ativo}
                    onChange={e => setAtivo(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="etapa-ativa" className="text-[0.8125rem] text-gray-700">Etapa ativa</label>
                </div>
              </div>
            </div>

            {etapaEditando && (
              <div className="rounded-xl bg-gray-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[0.75rem] uppercase tracking-wider text-gray-500 font-semibold">
                    Simulação agora
                  </p>
                  <button
                    type="button"
                    onClick={handleSimular}
                    className="inline-flex items-center gap-1 text-[0.75rem] text-primary hover:underline"
                  >
                    <Eye size={11} /> Simular
                  </button>
                </div>
                {simulacao ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 text-[0.8125rem]">
                      <span className="font-semibold text-emerald-700">
                        <Receipt size={11} className="inline mr-1" />
                        {simulacao.total} títulos
                      </span>
                      <span className="text-gray-600">· {simulacao.alunosUnicos} alunos</span>
                      <span className="text-gray-600">· {simulacao.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    {previewTexto && (
                      <div className="p-2 bg-white rounded border border-gray-100">
                        <p className="text-[0.6875rem] text-gray-400 mb-1">Mensagem que será enviada (exemplo):</p>
                        <pre className="text-[0.75rem] text-gray-800 whitespace-pre-wrap font-sans">{previewTexto}</pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[0.75rem] text-gray-400">Clique em "Simular" para ver quantos alunos seriam atingidos hoje.</p>
                )}
              </div>
            )}

            {erro && <p className="text-[0.8125rem] text-red-600">{erro}</p>}

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div>
                {etapaEditando && (
                  <button
                    type="button"
                    onClick={handleRemover}
                    disabled={salvando}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-red-600 text-[0.8125rem] hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={13} /> Remover etapa
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onFechar}
                  disabled={salvando}
                  className="px-4 py-2 rounded-lg text-[0.8125rem] text-gray-500 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvar}
                  disabled={salvando}
                  className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-gray-900 text-white text-[0.8125rem] font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {salvando && <Loader2 size={13} className="animate-spin" />}
                  {etapaEditando ? 'Atualizar etapa' : 'Salvar etapa'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <NovaRegraModal
        aberto={novaSegAberto}
        onFechar={() => setNovaSegAberto(false)}
        reguaOwnerId={regua.id}
        tipoFixo="TITULO"
        onSalva={async (regraCriada) => {
          setNovaSegAberto(false);
          const segs = await listarRegrasComFiltros({ reguaOwnerId: regua.id, tipo: 'TITULO' });
          setSegmentacoes(segs);
          if (regraCriada?.id) setSegmentacaoId(regraCriada.id);
        }}
      />
    </>
  );
}
