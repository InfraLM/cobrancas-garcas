import { X } from 'lucide-react';
import type { Tag } from '../../types/tag';
import { TAG_COR_CLASSES, TAG_COR_DEFAULT } from '../../types/tag';

interface Props {
  tag: Tag;
  onRemove?: () => void;
  compacto?: boolean;
  title?: string;
}

export default function TagChip({ tag, onRemove, compacto = false, title }: Props) {
  const cor = (tag.cor && TAG_COR_CLASSES[tag.cor]) || TAG_COR_DEFAULT;
  const tooltip = title || tag.descricao || `${tag.label} (${tag.categoria})`;

  if (compacto) {
    return (
      <span
        title={tooltip}
        className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[0.625rem] font-medium ${cor.bg} ${cor.text} ${cor.border}`}
      >
        {tag.label}
      </span>
    );
  }

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[0.75rem] font-medium ${cor.bg} ${cor.text} ${cor.border}`}
    >
      {tag.label}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 hover:bg-black/10 rounded-full p-0.5 transition-colors"
          aria-label={`Remover tag ${tag.label}`}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
