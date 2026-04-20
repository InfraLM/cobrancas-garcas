import { useState, useEffect } from 'react';
import type { Aluno } from '../../types/aluno';
import { listarOcorrencias } from '../../services/alunos';
import type { OcorrenciaTimeline } from '../../services/alunos';
import {
  Loader2, MessageSquare, Phone, PhoneOff, Headphones, Stethoscope,
  AlertTriangle, CheckCircle, MessageCircle, FileText, Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const TIPO_CONFIG: Record<string, { icone: LucideIcon; cor: string; label: string }> = {
  WHATSAPP_ENVIADO:     { icone: MessageSquare,  cor: 'text-blue-600 bg-blue-50',     label: 'WhatsApp enviado' },
  WHATSAPP_RECEBIDO:    { icone: MessageCircle,  cor: 'text-emerald-600 bg-emerald-50', label: 'WhatsApp recebido' },
  LIGACAO_ATENDIDA:     { icone: Phone,          cor: 'text-green-600 bg-green-50',    label: 'Ligacao atendida' },
  LIGACAO_NAO_ATENDIDA: { icone: PhoneOff,       cor: 'text-red-500 bg-red-50',        label: 'Ligacao nao atendida' },
  TICKET_SUPORTE:       { icone: Headphones,     cor: 'text-purple-600 bg-purple-50',  label: 'Ticket de suporte' },
  PLANTAO:              { icone: Stethoscope,    cor: 'text-amber-600 bg-amber-50',    label: 'Plantao' },
  SERASA_NEGATIVADO:    { icone: AlertTriangle,  cor: 'text-red-600 bg-red-50',        label: 'Serasa negativado' },
  SERASA_BAIXADO:       { icone: CheckCircle,    cor: 'text-green-600 bg-green-50',    label: 'Serasa baixado' },
  CONVERSA_CRIADA:      { icone: MessageSquare,  cor: 'text-indigo-600 bg-indigo-50',  label: 'Conversa de cobranca' },
  CONVERSA_ENCERRADA:   { icone: FileText,       cor: 'text-gray-600 bg-gray-100',     label: 'Conversa encerrada' },
};

const DEFAULT_CONFIG = { icone: Shield, cor: 'text-gray-500 bg-gray-100', label: 'Evento' };

function formatarData(data: string | null) {
  if (!data) return '—';
  const d = new Date(data);
  if (isNaN(d.getTime())) return data;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AlunoTabOcorrencias({ aluno }: { aluno: Aluno }) {
  const [items, setItems] = useState<OcorrenciaTimeline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listarOcorrencias(aluno.codigo)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [aluno.codigo]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <FileText size={24} className="text-gray-300" />
        <p className="text-[0.8125rem] text-gray-400">Nenhuma ocorrencia registrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item, idx) => {
        const cfg = TIPO_CONFIG[item.tipo] || DEFAULT_CONFIG;
        const Icone = cfg.icone;
        const isLast = idx === items.length - 1;

        return (
          <div key={item.id} className="flex gap-3">
            {/* Linha vertical + icone */}
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cfg.cor}`}>
                <Icone size={13} strokeWidth={2} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" />}
            </div>

            {/* Conteudo */}
            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-[0.75rem] font-medium text-on-surface">{cfg.label}</span>
                <span className="text-[0.625rem] text-gray-400">{formatarData(item.data)}</span>
              </div>
              <p className="text-[0.75rem] text-on-surface-variant mt-0.5 break-words">{item.descricao}</p>
              {item.agente && (
                <p className="text-[0.625rem] text-gray-400 mt-0.5">por {item.agente}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
