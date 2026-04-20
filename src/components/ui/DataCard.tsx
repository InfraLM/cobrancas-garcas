interface DataCardProps {
  label: string;
  valor: string | number;
  cor?: 'default' | 'danger' | 'success' | 'warning';
}

const corTexto = {
  default: 'text-gray-900',
  danger: 'text-red-600',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
};

export default function DataCard({ label, valor, cor = 'default' }: DataCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <span className={`text-xl font-bold ${corTexto[cor]}`}>{valor}</span>
      <p className="text-[0.6875rem] text-gray-400 mt-1">{label}</p>
    </div>
  );
}
