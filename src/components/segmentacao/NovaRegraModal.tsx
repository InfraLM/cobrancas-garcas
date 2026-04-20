import { useState, useEffect } from 'react';
import type { Condicao, Operador, RegraSegmentacao } from '../../types/segmentacao';
import { CAMPOS_SEGMENTACAO, OPERADOR_LABELS } from '../../types/segmentacao';
import Modal from '../ui/Modal';
import { Plus, Save, Loader2, Trash2 } from 'lucide-react';
import { criarRegra, atualizarRegra, executarCondicoes } from '../../services/segmentacao';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onSalva?: () => void;
  regraEditando?: RegraSegmentacao | null;
}

function novaCondicao(): Condicao {
  return { campo: '', operador: 'igual', valor: '' };
}

export default function NovaRegraModal({ aberto, onFechar, onSalva, regraEditando }: Props) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [condicoes, setCondicoes] = useState<Condicao[]>([novaCondicao()]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ total: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (regraEditando) {
      setNome(regraEditando.nome);
      setDescricao(regraEditando.descricao || '');
      setCondicoes(regraEditando.condicoes.length > 0 ? regraEditando.condicoes : [novaCondicao()]);
    } else {
      setNome('');
      setDescricao('');
      setCondicoes([novaCondicao()]);
    }
    setPreview(null);
  }, [regraEditando, aberto]);

  const categorias = [...new Set(CAMPOS_SEGMENTACAO.map(c => c.categoria))];

  function updateCondicao(idx: number, patch: Partial<Condicao>) {
    setCondicoes(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
    setPreview(null);
  }

  function removeCondicao(idx: number) {
    setCondicoes(prev => prev.filter((_, i) => i !== idx));
    setPreview(null);
  }

  async function handlePreview() {
    const validas = condicoes.filter(c => c.campo);
    if (validas.length === 0) return;
    setPreviewLoading(true);
    try {
      const res = await executarCondicoes(validas, { limit: 1 });
      setPreview({ total: res.total });
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSalvar() {
    if (!nome.trim()) return;
    const validas = condicoes.filter(c => c.campo);
    if (validas.length === 0) return;

    setSaving(true);
    try {
      if (regraEditando) {
        await atualizarRegra(regraEditando.id, { nome: nome.trim(), descricao: descricao.trim() || undefined, condicoes: validas });
      } else {
        await criarRegra({ nome: nome.trim(), descricao: descricao.trim() || undefined, condicoes: validas });
      }
      setNome('');
      setDescricao('');
      setCondicoes([novaCondicao()]);
      setPreview(null);
      onSalva?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo={regraEditando ? 'Editar regra' : 'Nova regra de segmentacao'} largura="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[0.75rem] font-medium text-on-surface mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Alta inadimplencia"
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-[0.75rem] font-medium text-on-surface mb-1">Descricao</label>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Opcional"
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>

        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-gray-400 mb-2">Condicoes (AND)</p>
          <div className="space-y-2">
            {condicoes.map((cond, idx) => {
              const campoObj = CAMPOS_SEGMENTACAO.find(c => c.id === cond.campo);
              return (
                <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  {/* Campo */}
                  <select value={cond.campo} onChange={e => updateCondicao(idx, { campo: e.target.value, operador: 'igual', valor: '' })}
                    className="flex-1 h-8 px-2 rounded-md border border-gray-200 text-[0.75rem] bg-white">
                    <option value="">Selecione...</option>
                    {categorias.map(cat => (
                      <optgroup key={cat} label={cat}>
                        {CAMPOS_SEGMENTACAO.filter(c => c.categoria === cat).map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  {/* Operador */}
                  {campoObj && (
                    <select value={cond.operador} onChange={e => updateCondicao(idx, { operador: e.target.value as Operador })}
                      className="w-28 h-8 px-2 rounded-md border border-gray-200 text-[0.75rem] bg-white">
                      {campoObj.operadores.map(op => (
                        <option key={op} value={op}>{OPERADOR_LABELS[op]}</option>
                      ))}
                    </select>
                  )}

                  {/* Valor */}
                  {campoObj && campoObj.tipo === 'lista' && (
                    <select value={String(cond.valor)} onChange={e => updateCondicao(idx, { valor: e.target.value })}
                      className="flex-1 h-8 px-2 rounded-md border border-gray-200 text-[0.75rem] bg-white">
                      <option value="">Selecione...</option>
                      {(campoObj.opcoes || []).map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  )}

                  {campoObj && (campoObj.tipo === 'numero' || campoObj.tipo === 'moeda') && (
                    <>
                      <input type="number" value={String(cond.valor)} onChange={e => updateCondicao(idx, { valor: Number(e.target.value) })}
                        placeholder="Valor" className="w-24 h-8 px-2 rounded-md border border-gray-200 text-[0.75rem] bg-white" />
                      {cond.operador === 'entre' && (
                        <input type="number" value={String(cond.valor2 || '')} onChange={e => updateCondicao(idx, { valor2: Number(e.target.value) })}
                          placeholder="Ate" className="w-24 h-8 px-2 rounded-md border border-gray-200 text-[0.75rem] bg-white" />
                      )}
                    </>
                  )}

                  {campoObj && campoObj.tipo === 'data' && (
                    <>
                      <input type="date" value={String(cond.valor || '')} onChange={e => updateCondicao(idx, { valor: e.target.value })}
                        className="w-36 h-8 px-2 rounded-md border border-gray-200 text-[0.75rem] bg-white" />
                      {cond.operador === 'entre' && (
                        <input type="date" value={String(cond.valor2 || '')} onChange={e => updateCondicao(idx, { valor2: e.target.value })}
                          className="w-36 h-8 px-2 rounded-md border border-gray-200 text-[0.75rem] bg-white" />
                      )}
                    </>
                  )}

                  <button onClick={() => removeCondicao(idx)} className="p-1 text-gray-300 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <button onClick={() => setCondicoes(prev => [...prev, novaCondicao()])}
            className="flex items-center gap-1 mt-2 text-[0.75rem] text-primary hover:underline">
            <Plus size={12} /> Adicionar condicao
          </button>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-3">
          <button onClick={handlePreview} disabled={previewLoading || condicoes.every(c => !c.campo)}
            className="h-8 px-4 rounded-lg text-[0.75rem] font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 transition-colors">
            {previewLoading ? <Loader2 size={12} className="animate-spin" /> : 'Preview'}
          </button>
          {preview && (
            <span className="text-[0.8125rem] font-medium text-on-surface">{preview.total} alunos encontrados</span>
          )}
        </div>

        {/* Acoes */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button onClick={onFechar} className="h-9 px-4 rounded-lg text-[0.8125rem] text-gray-500 hover:bg-gray-100">
            Cancelar
          </button>
          <button onClick={handleSalvar} disabled={saving || !nome.trim() || condicoes.every(c => !c.campo)}
            className="flex items-center gap-2 h-9 px-5 rounded-lg bg-gray-900 text-white text-[0.8125rem] font-medium hover:bg-gray-800 disabled:opacity-40">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {regraEditando ? 'Atualizar' : 'Salvar regra'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
