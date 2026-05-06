import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Send, Copy as CopyIcon, Power, Trash2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import Drawer from '../ui/Drawer';
import TemplateMetaPreview from './TemplateMetaPreview';
import type { TemplateMeta } from '../../types/templateMeta';
import {
  STATUS_META_LABELS,
  STATUS_META_CLASSES,
  CATEGORIA_META_LABELS,
  QUALITY_META_LABELS,
  QUALITY_META_CLASSES,
} from '../../types/templateMeta';
import { submeterTemplateMeta, deletarTemplateMeta, atualizarTemplateMeta } from '../../services/templatesMeta';

interface Props {
  template: TemplateMeta;
  onFechar: () => void;
  onMudou: () => void;
}

export default function TemplateMetaDrawer({ template, onFechar, onMudou }: Props) {
  const navigate = useNavigate();
  const [acaoEmCurso, setAcaoEmCurso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeEditar = template.status === 'DRAFT' || template.status === 'REJECTED';
  const podeSubmeter = template.status === 'DRAFT' || template.status === 'REJECTED';
  const podeDuplicar = ['APPROVED', 'PAUSED', 'DISABLED', 'REJECTED'].includes(template.status);
  const podeAtivarDesativar = template.status === 'APPROVED';
  const exemplos = (template.components.find(c => c.type === 'BODY') as any)?.example?.body_text?.[0] || [];
  const variaveisPreview: Record<string, string> = {};
  exemplos.forEach((v: string, i: number) => { variaveisPreview[String(i + 1)] = v; });

  async function handleSubmeter() {
    if (!confirm(`Submeter "${template.name}" para aprovação Meta?\n\nApós submetido, não dá pra editar até a Meta responder (5min-2h).`)) return;
    setAcaoEmCurso(true);
    setErro(null);
    try {
      await submeterTemplateMeta(template.id);
      onMudou();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAcaoEmCurso(false);
    }
  }

  async function handleDeletar() {
    if (!confirm(`Excluir "${template.name}"?\n\nIsso remove na Meta e desativa localmente.`)) return;
    setAcaoEmCurso(true);
    setErro(null);
    try {
      await deletarTemplateMeta(template.id);
      onMudou();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAcaoEmCurso(false);
    }
  }

  async function handleAlternarAtivo() {
    setAcaoEmCurso(true);
    setErro(null);
    try {
      await atualizarTemplateMeta(template.id, { ativo: !template.ativo });
      onMudou();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAcaoEmCurso(false);
    }
  }

  function handleEditar() {
    onFechar();
    navigate(`/configuracoes/templates-conversa/meta/${template.id}`);
  }

  function handleDuplicar() {
    onFechar();
    navigate(`/configuracoes/templates-conversa/novo-meta?duplicar=${template.id}`);
  }

  return (
    <Drawer aberto={true} onFechar={onFechar} largura="w-[640px]">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[1rem] font-semibold text-gray-900 font-mono truncate">{template.name}</p>
              <p className="text-[0.75rem] text-gray-500 mt-0.5">{template.language} · {CATEGORIA_META_LABELS[template.category as keyof typeof CATEGORIA_META_LABELS] || template.category}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`text-[0.6875rem] px-2 py-0.5 rounded border ${STATUS_META_CLASSES[template.status]}`}>
                {STATUS_META_LABELS[template.status]}
              </span>
              {template.qualityRating && template.qualityRating !== 'UNKNOWN' && (
                <span className={`text-[0.625rem] px-1.5 py-0.5 rounded ${QUALITY_META_CLASSES[template.qualityRating]}`}>
                  Qualidade: {QUALITY_META_LABELS[template.qualityRating]}
                </span>
              )}
            </div>
          </div>

          {/* Aviso de status crítico */}
          {template.status === 'REJECTED' && template.rejectReason && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[0.75rem] font-semibold text-red-800">Rejeitado pela Meta</p>
                  <p className="text-[0.6875rem] text-red-700 mt-0.5">Motivo: {template.rejectReason}</p>
                  <p className="text-[0.6875rem] text-red-700 mt-1">Edite o conteúdo e ressubmeta. Conteúdo aprovado pode ser usado normalmente.</p>
                </div>
              </div>
            </div>
          )}
          {template.status === 'PAUSED' && (
            <div className="mt-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
              <div className="flex items-start gap-2">
                <RefreshCw size={14} className="text-orange-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[0.75rem] font-semibold text-orange-800">Pausado por qualidade baixa</p>
                  <p className="text-[0.6875rem] text-orange-700 mt-0.5">A Meta pausou esse template por causa de bloqueios/reports. Volta automático em 3-6h. Considere duplicar e ajustar texto.</p>
                </div>
              </div>
            </div>
          )}
          {template.status === 'DISABLED' && (
            <div className="mt-3 p-3 rounded-lg bg-zinc-100 border border-zinc-300">
              <p className="text-[0.75rem] text-zinc-700">Desativado permanentemente. Crie um template novo (com nome diferente) para substituir.</p>
            </div>
          )}
          {template.status === 'PENDING' && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-[0.75rem] text-amber-800">Aguardando aprovação Meta. Geralmente 5min-2h. Use "Sincronizar Meta" pra checar.</p>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          <p className="text-[0.6875rem] font-bold text-gray-500 uppercase tracking-wider mb-2">Preview</p>
          <TemplateMetaPreview components={template.components} variaveis={variaveisPreview} />

          {/* Conteúdo bruto */}
          <div className="mt-5 space-y-3">
            <p className="text-[0.6875rem] font-bold text-gray-500 uppercase tracking-wider">Estrutura</p>
            {template.components.map((c, i) => (
              <ComponenteResumo key={i} comp={c} />
            ))}
          </div>

          {/* Datas */}
          <div className="mt-5 space-y-1 text-[0.6875rem] text-gray-500">
            <p>Criado: {new Date(template.criadoEm).toLocaleString('pt-BR')}{template.criadoPorNome ? ` por ${template.criadoPorNome}` : ''}</p>
            {template.submetidoEm && <p>Submetido: {new Date(template.submetidoEm).toLocaleString('pt-BR')}</p>}
            {template.aprovadoEm && <p>Aprovado: {new Date(template.aprovadoEm).toLocaleString('pt-BR')}</p>}
          </div>

          {erro && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-[0.75rem] text-red-700">
              {erro}
            </div>
          )}
        </div>

        {/* Footer com ações */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center gap-2 flex-wrap bg-gray-50">
          {podeEditar && (
            <button onClick={handleEditar} disabled={acaoEmCurso} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-[0.75rem] font-medium hover:bg-gray-800 disabled:opacity-50">
              <Pencil size={13} /> Editar
            </button>
          )}
          {podeSubmeter && (
            <button onClick={handleSubmeter} disabled={acaoEmCurso} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-[0.75rem] font-medium hover:bg-emerald-700 disabled:opacity-50">
              <Send size={13} /> Submeter para aprovação
            </button>
          )}
          {podeDuplicar && (
            <button onClick={handleDuplicar} disabled={acaoEmCurso} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-[0.75rem] hover:bg-gray-50 disabled:opacity-50">
              <CopyIcon size={13} /> Duplicar
            </button>
          )}
          {podeAtivarDesativar && (
            <button onClick={handleAlternarAtivo} disabled={acaoEmCurso} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-[0.75rem] hover:bg-gray-50 disabled:opacity-50">
              <Power size={13} /> {template.ativo ? 'Desativar' : 'Reativar'}
            </button>
          )}
          <div className="flex-1" />
          <button onClick={handleDeletar} disabled={acaoEmCurso} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 text-[0.75rem] disabled:opacity-50">
            <Trash2 size={13} /> Excluir
          </button>
        </div>
      </div>
    </Drawer>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────

function ComponenteResumo({ comp }: { comp: any }) {
  if (comp.type === 'HEADER') {
    return (
      <div className="text-[0.75rem] text-gray-700">
        <span className="font-semibold">Header ({comp.format}):</span> {comp.text || '(mídia)'}
      </div>
    );
  }
  if (comp.type === 'BODY') {
    return (
      <div className="text-[0.75rem] text-gray-700">
        <span className="font-semibold">Body:</span>
        <pre className="mt-1 whitespace-pre-wrap font-mono text-[0.6875rem] bg-gray-50 p-2 rounded border border-gray-100">{comp.text}</pre>
      </div>
    );
  }
  if (comp.type === 'FOOTER') {
    return <div className="text-[0.75rem] text-gray-700"><span className="font-semibold">Footer:</span> {comp.text}</div>;
  }
  if (comp.type === 'BUTTONS') {
    return (
      <div className="text-[0.75rem] text-gray-700">
        <span className="font-semibold">Botões:</span>
        <ul className="mt-1 space-y-0.5 list-disc list-inside text-[0.6875rem]">
          {(comp.buttons || []).map((b: any, i: number) => (
            <li key={i}>{b.type}: <code className="font-mono">{b.text}</code> {b.url ? <ExternalLink size={10} className="inline text-gray-400" /> : null}</li>
          ))}
        </ul>
      </div>
    );
  }
  return null;
}
