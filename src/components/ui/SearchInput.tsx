import { Search } from 'lucide-react';

interface SearchInputProps {
  valor: string;
  onChange: (valor: string) => void;
  placeholder?: string;
}

export default function SearchInput({ valor, onChange, placeholder = 'Buscar...' }: SearchInputProps) {
  return (
    <div className="relative">
      <Search size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/70 text-[0.8125rem] text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:bg-white focus:shadow-sm focus:shadow-black/[0.03] transition-all"
      />
    </div>
  );
}
