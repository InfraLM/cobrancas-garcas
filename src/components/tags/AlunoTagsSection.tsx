import { useEffect, useState } from 'react';
import { Tag as TagIcon } from 'lucide-react';
import type { Tag, AlunoTag } from '../../types/tag';
import * as tagsService from '../../services/tags';
import TagChip from './TagChip';
import TagSelector from './TagSelector';

interface Props {
  pessoaCodigo: number;
  // Quando true, exibe versao compacta (chips menores, sem botao remover) — para usar no header da conversa
  compacto?: boolean;
  // Permitir editar (adicionar/remover). Default true. Compacto geralmente tem editavel=false.
  editavel?: boolean;
  // Callback opcional para notificar mudanca (ex: re-render de outras partes)
  onChange?: () => void;
}

// Componente reutilizavel: exibe tags ativas do aluno + permite adicionar/remover.
// Usado no AlunoDrawer (variante padrao) e no HeaderChat (variante compacta).
export default function AlunoTagsSection({ pessoaCodigo, compacto = false, editavel = true, onChange }: Props) {
  const [catalogo, setCatalogo] = useState<Tag[]>([]);
  const [aplicadas, setAplicadas] = useState<AlunoTag[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    Promise.all([
      tagsService.listarCatalogo(),
      tagsService.listarPorAluno(pessoaCodigo),
    ])
      .then(([cat, ap]) => {
        if (cancelado) return;
        setCatalogo(cat);
        setAplicadas(ap);
      })
      .catch(e => { if (!cancelado) setErro(e.message); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [pessoaCodigo]);

  async function aplicarTag(tag: Tag) {
    // Atualizacao otimista: chip aparece instantaneamente. Se backend falhar, reverte.
    const tempId = `temp-${Date.now()}-${tag.id}`;
    const tempAtrib: AlunoTag = {
      id: tempId,
      pessoaCodigo,
      tagId: tag.id,
      tag,
      observacao: null,
      origemConversaId: null,
      origemAcordoId: null,
      criadoPor: 0,
      criadoPorNome: null,
      criadoEm: new Date().toISOString(),
      removidoEm: null,
      removidoPor: null,
      removidoPorNome: null,
    };
    setAplicadas(prev => [tempAtrib, ...prev]);
    try {
      const real = await tagsService.aplicarTag(pessoaCodigo, { tagId: tag.id });
      // Substitui a atribuicao temporaria pela real (com id correto vindo do backend)
      setAplicadas(prev => prev.map(a => (a.id === tempId ? real : a)));
      onChange?.();
    } catch (e) {
      // Falhou — remove a otimista
      setAplicadas(prev => prev.filter(a => a.id !== tempId));
      setErro((e as Error).message);
    }
  }

  async function removerTag(atrib: AlunoTag) {
    try {
      await tagsService.removerTag(pessoaCodigo, atrib.id);
      setAplicadas(prev => prev.filter(a => a.id !== atrib.id));
      onChange?.();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const codigosAplicados = new Set(aplicadas.map(a => a.tag.codigo));

  if (compacto) {
    // Versao compacta: chips menores, sem remover, sem texto auxiliar
    if (carregando || aplicadas.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-1">
        {aplicadas.map(a => (
          <TagChip key={a.id} tag={a.tag} compacto />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-wider">
        <TagIcon size={11} />
        Tags
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {carregando ? (
          <span className="text-[0.75rem] text-gray-400">Carregando...</span>
        ) : aplicadas.length === 0 && !editavel ? (
          <span className="text-[0.75rem] text-gray-400">Nenhuma tag aplicada</span>
        ) : (
          <>
            {aplicadas.map(a => (
              <TagChip
                key={a.id}
                tag={a.tag}
                onRemove={editavel ? () => removerTag(a) : undefined}
              />
            ))}
            {editavel && (
              <TagSelector
                catalogo={catalogo}
                jaAplicadasCodigos={codigosAplicados}
                onSelect={aplicarTag}
              />
            )}
          </>
        )}
      </div>

      {erro && (
        <p className="text-[0.6875rem] text-red-600">{erro}</p>
      )}
    </div>
  );
}
