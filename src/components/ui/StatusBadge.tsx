type Variante = 'danger' | 'success' | 'warning' | 'neutral' | 'info' | 'purple' | 'pink' | 'blue';

interface StatusBadgeProps {
  texto: string;
  variante?: Variante;
  comDot?: boolean;
  tamanho?: 'sm' | 'md';
}

const varianteClasses: Record<Variante, { text: string; dot: string }> = {
  danger:  { text: 'text-red-600',     dot: 'bg-red-500' },
  success: { text: 'text-emerald-600', dot: 'bg-emerald-500' },
  warning: { text: 'text-amber-600',   dot: 'bg-amber-500' },
  neutral: { text: 'text-gray-500',    dot: 'bg-gray-400' },
  info:    { text: 'text-blue-600',    dot: 'bg-blue-500' },
  purple:  { text: 'text-violet-600',  dot: 'bg-violet-500' },
  pink:    { text: 'text-pink-600',    dot: 'bg-pink-500' },
  blue:    { text: 'text-blue-600',    dot: 'bg-blue-500' },
};

export default function StatusBadge({ texto, variante = 'neutral', comDot = false, tamanho = 'sm' }: StatusBadgeProps) {
  const classes = varianteClasses[variante];
  const tamClasses = tamanho === 'md' ? 'text-[0.75rem]' : 'text-[0.6875rem]';

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${classes.text} ${tamClasses}`}>
      {comDot && <span className={`w-1.5 h-1.5 rounded-full ${classes.dot}`} />}
      {texto}
    </span>
  );
}

export function varianteSituacaoParcela(situacao: string, vencida?: boolean): Variante {
  switch (situacao) {
    case 'AR': return vencida ? 'danger' : 'neutral';
    case 'RE': return 'success';
    case 'NE': return 'warning';
    case 'CF': return 'neutral';
    default: return 'neutral';
  }
}

export function labelSituacaoParcela(situacao: string, vencida?: boolean): string {
  switch (situacao) {
    case 'AR': return vencida ? 'Vencido' : 'A Receber';
    case 'RE': return 'Recebido';
    case 'NE': return 'Negociado';
    case 'CF': return 'Cancelado';
    default: return situacao;
  }
}

export function varianteSituacaoMatricula(situacao: string): Variante {
  switch (situacao) {
    case 'AT': return 'success';
    case 'CA': return 'danger';
    case 'IN': return 'neutral';
    case 'TR': return 'warning';
    default: return 'neutral';
  }
}

export function variantePlantao(status: string): Variante {
  switch (status) {
    case 'Realizado': return 'success';
    case 'Cancelado': return 'danger';
    case 'Em Aberto': return 'neutral';
    default: return 'neutral';
  }
}
