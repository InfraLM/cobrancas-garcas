import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import type { TemplateBlip, CategoriaBlip, FonteDisponivel, FonteVariavel, VariavelMap } from '../../types/templateBlip';
import { CATEGORIAS_BLIP, CATEGORIA_BLIP_LABEL } from '../../types/templateBlip';
import { listarFontes, criarTemplateBlip, atualizarTemplateBlip } from '../../services/templatesBlip';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  template: TemplateBlip | null;
  onSalvou: () => void;
}

function detectarIndices(conteudo: string): number[] {
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  const set = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(conteudo)) !== null) set.add(Number(m[1]));
  return [...set].sort((a, b) => a - b);
}

export default function TemplateBlipModal({ aberto, onFechar, template, onSalvou }: Props) {
  const [nomeBlip, setNomeBlip] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<CategoriaBlip>('PRE_VENCIMENTO');
  const [conteudo, setConteudo] = useState('');
  const [mapeamento, setMapeamento] = useState<Record<number, FonteVariavel>>({});
  const [ativo, setAtivo] = useState(true);

  const [fontes, setFontes] = useState<FonteDisponivel[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) listarFontes().then(setFontes).catch(() => setFontes([]));
  }, [aberto]);

  useEffect(() => {
    if (template) {
      setNomeBlip(template.nomeBlip);
      setTitulo(template.titulo);
      setDescricao(template.descricao || '');
      setCategoria(template.categoria);
      setConteudo(template.conteudoPreview);
      const map: Record<number, FonteVariavel> = {};
      for (const v of template.variaveis) map[v.indice] = v.fonte;
      setMapeamento(map);
      setAtivo(template.ativo);
    } else {
      setNomeBlip(''); setTitulo(''); setDescricao('');
      setCategoria('PRE_VENCIMENTO'); setConteudo('');
      setMapeamento({}); setAtivo(true);
    }
    setErro(null);
  }, [template, aberto]);

  const indicesDetectados = useMemo(() => detectarIndices(conteudo), [conteudo]);

  async function handleSalvar() {
    setErro(null);
    if (!nomeBlip.trim() || !titulo.trim() || !conteudo.trim()) {
      setErro('Preencha nome Blip, título e conteúdo');
      return;
    }
    // Validar que todos os indices detectados tem mapeamento
    const faltando = indicesDetectados.filter(i => !mapeamento[i]);
    if (faltando.length > 0) {
      setErro(`Mapeie as variáveis: ${faltando.map(i => `{{${i}}}`).join(', ')}`);
      return;
    }

    const variaveis: VariavelMap[] = indicesDetectados.map(i => ({ indice: i, fonte: mapeamento[i] }));
    const payload = {
      nomeBlip: nomeBlip.trim(),
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      conteudoPreview: conteudo,
      variaveis,
      categoria,
      ativo,
    };

    setSalvando(true);
    try {
      if (template) await atualizarTemplateBlip(template.id, payload);
      else await criarTemplateBlip(payload);
      onSalvou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={salvando ? () => {} : onFechar}
      titulo={template ? 'Editar template Blip' : 'Cadastrar template Blip'}
      largura="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Título interno</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Lembrete pré-vencimento"
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Nome na Blip / Meta</label>
            <input
              value={nomeBlip}
              onChange={e => setNomeBlip(e.target.value)}
              placeholder="template_fluxo_antes_venc_rec_inativa1"
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem] font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Categoria</label>
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value as CategoriaBlip)}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem] bg-white"
            >
              {CATEGORIAS_BLIP.map(c => (
                <option key={c} value={c}>{CATEGORIA_BLIP_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Status</label>
            <div className="flex items-center gap-2 h-9">
              <input
                type="checkbox"
                id="ativo"
                checked={ativo}
                onChange={e => setAtivo(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="ativo" className="text-[0.8125rem] text-gray-700">Ativo (disponível para disparo)</label>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">Descrição (opcional)</label>
          <input
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Ex: enviado 7 dias antes para alunos sem recorrência"
            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="block text-[0.75rem] font-medium text-gray-600 mb-1">
            Conteúdo do template <span className="text-gray-400">(use {'{{1}}, {{2}}'} etc)</span>
          </label>
          <textarea
            value={conteudo}
            onChange={e => setConteudo(e.target.value)}
            rows={7}
            placeholder="*Fatura disponível!*&#10;Olá, doutor(a)!&#10;Sua fatura no valor de {{1}} vence {{2}}.&#10;Link: {{4}}"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[0.8125rem] font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        {indicesDetectados.length > 0 && (
          <div className="rounded-xl bg-gray-50 p-3 space-y-2">
            <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-gray-500">
              Mapeamento de variáveis
            </p>
            {indicesDetectados.map(i => (
              <div key={i} className="flex items-center gap-3">
                <span className="font-mono text-[0.8125rem] text-gray-700 w-14">{'{{'}{i}{'}}'}</span>
                <span className="text-gray-300">→</span>
                <select
                  value={mapeamento[i] || ''}
                  onChange={e => setMapeamento(prev => ({ ...prev, [i]: e.target.value as FonteVariavel }))}
                  className="flex-1 h-8 px-2 rounded-md border border-gray-200 text-[0.75rem] bg-white"
                >
                  <option value="">Selecionar fonte...</option>
                  {fontes.map(f => (
                    <option key={f.fonte} value={f.fonte}>
                      {f.descricao} ({f.exemplo})
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {erro && <p className="text-[0.8125rem] text-red-600">{erro}</p>}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
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
            {template ? 'Atualizar' : 'Salvar template'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
