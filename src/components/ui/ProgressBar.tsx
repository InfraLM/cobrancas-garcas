interface ProgressBarProps {
  valor: number;
  label?: string;
  cor?: 'default' | 'success' | 'warning' | 'danger';
}

const corBarra = {
  default: 'bg-gray-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

export default function ProgressBar({ valor, label, cor = 'default' }: ProgressBarProps) {
  const pct = Math.min(Math.max(valor * 100, 0), 100);

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[0.8125rem] text-gray-500">{label}</span>
          <span className="text-[0.8125rem] font-semibold text-gray-900">{pct.toFixed(0)}%</span>
        </div>
      )}
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${corBarra[cor]} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
