import { Check } from 'lucide-react';
import { TAG_COR_CLASSES } from '../../types/tag';

interface Props {
  value: string | null;
  onChange: (cor: string) => void;
}

const CORES = Object.keys(TAG_COR_CLASSES);

// Mini-paleta visual com bolinhas coloridas. Click seleciona.
export default function CorPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {CORES.map(cor => {
        const cls = TAG_COR_CLASSES[cor];
        const ativo = value === cor;
        return (
          <button
            key={cor}
            type="button"
            onClick={() => onChange(cor)}
            title={cor}
            className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all ${cls.bg} ${cls.border} ${
              ativo ? 'ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'
            }`}
          >
            {ativo && <Check size={12} className={cls.text} />}
          </button>
        );
      })}
    </div>
  );
}
