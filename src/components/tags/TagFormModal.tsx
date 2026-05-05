import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import CorPicker from './CorPicker';
import TagChip from './TagChip';
import * as tagsService from '../../services/tags';
import type { Tag } from '../../types/tag';
import { rotuloCategoria, CATEGORIA_LABELS } from '../../types/tag';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  tag?: Tag | null;  // null/undefined = modo criar; objeto = modo editar
  categoriasExistentes: string[];
  onSalvo: (tag: Tag) => void;
}

const CODIGO_REGEX = /^[A-Z][A-Z0-9_]*$/;

export default function TagFormModal({ aberto, onFechar, tag, categoriasExistentes, onSalvo }: Props) {
  const editando = !!tag;
  const qtdAfetada = tag?.qtdAplicadaAtiva ?? 0;

  const [categoria, setCategoria] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('');
  const [usandoNovaCategoria, setUsandoNovaCategoria] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [label, setLabel] = useState('');
  const [descricao, setDescricao] = useState('');
  const [cor, setCor] = useState<string>('gray');
  const [ordem, setOrdem] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Lista combinada: categorias do banco + as 4 conhecidas (sem duplicar)
  const todasCategorias = Array.from(new Set([...Object.keys(CATEGORIA_LABELS), ...categoriasExistentes]));

  useEffect(() => {
    if (!aberto) return;
    if (tag) {
      setCategoria(tag.categoria);
      setUsandoNovaCategoria(false);
      setNovaCategoria('');
      setCodigo(tag.codigo);
      setLabel(tag.label);
      setDescricao(tag.descricao || '');
      setCor(tag.cor || 'gray');
      setOrdem(tag.ordem);
    } else {
      setCategoria(todasCategorias[0] || '');
      setUsandoNovaCategoria(false);
      setNovaCategoria('');
      setCodigo('');
      setLabel('');
      setDescricao('');
      setCor('gray');
      setOrdem(0);
    }
    setErro(null);
    setSalvando(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, tag?.id]);

  const categoriaFinal = usandoNovaCategoria ? novaCategoria.trim().toUpperCase() : categoria;
  const mudouCategoria = editando && tag && categoriaFinal !== tag.categoria;

  function validar(): string | null {
    if (!categoriaFinal) return 'Selecione ou informe uma categoria';
    if (!label.trim()) return 'Label obrigatório';
    if (!cor) return 'Selecione uma cor';
    if (!editando) {
      if (!codigo.trim()) return 'Código obrigatório';
      if (!CODIGO_REGEX.test(codigo)) return 'Código deve estar em SCREAMING_SNAKE_CASE (ex: BUSCOU_CANCELAMENTO)';
    }
    return null;
  }

  async function salvar() {
    const erroVal = validar();
    if (erroVal) { setErro(erroVal); return; }

    if (mudouCategoria && qtdAfetada > 0) {
      const ok = window.confirm(
        `Mudar a categoria desta tag de ${rotuloCategoria(tag!.categoria)} para ${rotuloCategoria(categoriaFinal)} vai reclassificar ${qtdAfetada} aluno(s) que tem esta tag aplicada. Continuar?`
      );
      if (!ok) return;
    }

    setSalvando(true);
    setErro(null);
    try {
      let salva: Tag;
      if (editando) {
        salva = await tagsService.atualizarTag(tag!.id, {
          categoria: categoriaFinal,
          label: label.trim(),
          descricao: descricao.trim() || null,
          cor,
          ordem,
        });
      } else {
        salva = await tagsService.criarTag({
          categoria: categoriaFinal,
          codigo: codigo.trim().toUpperCase(),
          label: label.trim(),
          descricao: descricao.trim() || undefined,
          cor,
          ordem,
        });
      }
      onSalvo(salva);
      onFechar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  // Preview do chip
  const tagPreview: Tag = {
    id: 'preview',
    categoria: categoriaFinal || 'preview',
    codigo: codigo || 'PREVIEW',
    label: label || 'Preview da tag',
    descricao: descricao || null,
    cor,
    ordem,
    ativo: true,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo={editando ? 'Editar tag' : 'Nova tag'} largura="max-w-xl">
      <div className="flex flex-col gap-4">
        {/* Categoria */}
        <div>
          <label className="block text-[0.75rem] font-medium text-gray-700 mb-1.5">Categoria</label>
          {!usandoNovaCategoria ? (
            <div className="flex items-center gap-2">
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[0.8125rem] focus:outline-none focus:border-primary"
              >
                {todasCategorias.map(c => (
                  <option key={c} value={c}>{rotuloCategoria(c)}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setUsandoNovaCategoria(true)}
                className="text-[0.75rem] text-primary hover:underline whitespace-nowrap"
              >
                + Nova categoria
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={novaCategoria}
                onChange={e => setNovaCategoria(e.target.value.toUpperCase())}
                placeholder="EX: SAUDE"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[0.8125rem] font-mono focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => { setUsandoNovaCategoria(false); setNovaCategoria(''); }}
                className="text-[0.75rem] text-gray-500 hover:underline whitespace-nowrap"
              >
                Cancelar
              </button>
            </div>
          )}
          {mudouCategoria && qtdAfetada > 0 && (
            <p className="text-[0.6875rem] text-amber-600 mt-1">
              ⚠ Esta mudança reclassifica {qtdAfetada} aluno(s) com esta tag aplicada
            </p>
          )}
        </div>

        {/* Codigo */}
        <div>
          <label className="block text-[0.75rem] font-medium text-gray-700 mb-1.5">
            Código
            {editando && <span className="ml-2 text-gray-400 font-normal">(imutável após criação)</span>}
          </label>
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            disabled={editando}
            placeholder="EX: BUSCOU_CANCELAMENTO"
            className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-[0.8125rem] font-mono focus:outline-none focus:border-primary ${editando ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
          />
          {!editando && (
            <p className="text-[0.6875rem] text-gray-500 mt-1">
              SCREAMING_SNAKE_CASE. Use letras, números e underscore.
            </p>
          )}
        </div>

        {/* Label */}
        <div>
          <label className="block text-[0.75rem] font-medium text-gray-700 mb-1.5">Label (texto exibido)</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Está sem receber"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[0.8125rem] focus:outline-none focus:border-primary"
          />
        </div>

        {/* Descricao */}
        <div>
          <label className="block text-[0.75rem] font-medium text-gray-700 mb-1.5">Descrição (opcional)</label>
          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            rows={2}
            placeholder="Contexto que ajude o agente a entender quando aplicar"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[0.8125rem] focus:outline-none focus:border-primary resize-none"
          />
        </div>

        {/* Cor + Ordem */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[0.75rem] font-medium text-gray-700 mb-1.5">Cor</label>
            <CorPicker value={cor} onChange={setCor} />
          </div>
          <div>
            <label className="block text-[0.75rem] font-medium text-gray-700 mb-1.5">Ordem</label>
            <input
              type="number"
              value={ordem}
              onChange={e => setOrdem(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[0.8125rem] focus:outline-none focus:border-primary"
            />
            <p className="text-[0.6875rem] text-gray-500 mt-1">Menor = aparece primeiro na categoria</p>
          </div>
        </div>

        {/* Preview */}
        <div className="pt-3 border-t border-gray-100">
          <p className="text-[0.625rem] uppercase tracking-wider text-gray-500 mb-2">Preview</p>
          <TagChip tag={tagPreview} />
        </div>

        {erro && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[0.75rem] text-red-700">
            {erro}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onFechar}
            disabled={salvando}
            className="px-4 py-2 rounded-lg text-[0.8125rem] text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="px-4 py-2 rounded-lg text-[0.8125rem] font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar tag'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
