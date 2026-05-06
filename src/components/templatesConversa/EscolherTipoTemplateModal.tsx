import { Zap, BadgeCheck, X } from 'lucide-react';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onEscolher: (tipo: 'atalho' | 'meta') => void;
}

export default function EscolherTipoTemplateModal({ aberto, onFechar, onEscolher }: Props) {
  if (!aberto) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onFechar} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl pointer-events-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-[1.0625rem] font-semibold text-gray-900">Como você quer criar este template?</h2>
              <p className="text-[0.75rem] text-gray-500 mt-0.5">Existem dois tipos para a tela de conversas. Escolha o que se encaixa melhor.</p>
            </div>
            <button onClick={onFechar} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 p-6">
            {/* Atalho rápido */}
            <button
              onClick={() => onEscolher('atalho')}
              className="text-left bg-white border-2 border-gray-200 hover:border-gray-900 hover:bg-gray-50 rounded-xl p-5 transition-all group"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-900 group-hover:text-white transition-colors">
                  <Zap size={16} />
                </span>
                <h3 className="text-[0.875rem] font-semibold text-gray-900">Atalho rápido</h3>
              </div>
              <p className="text-[0.75rem] text-gray-600 mb-3">
                Texto pronto para reutilizar durante uma conversa <strong>ativa</strong> (dentro da janela 24h).
              </p>
              <ul className="space-y-1 text-[0.6875rem] text-gray-500">
                <li>• Texto livre, sem aprovação</li>
                <li>• Pode editar quando quiser</li>
                <li>• Só funciona em conversa aberta</li>
              </ul>
            </button>

            {/* Template Meta */}
            <button
              onClick={() => onEscolher('meta')}
              className="text-left bg-white border-2 border-emerald-200 hover:border-emerald-600 hover:bg-emerald-50/40 rounded-xl p-5 transition-all group"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <BadgeCheck size={16} />
                </span>
                <h3 className="text-[0.875rem] font-semibold text-gray-900">Modelo Meta (oficial)</h3>
              </div>
              <p className="text-[0.75rem] text-gray-600 mb-3">
                Mensagem aprovada pela Meta para enviar <strong>fora da janela de 24h</strong> em conversas WABA.
              </p>
              <ul className="space-y-1 text-[0.6875rem] text-gray-500">
                <li>• Aprovação 5min-2h (Meta)</li>
                <li>• Pode ter botões e mídia</li>
                <li>• Travado depois de aprovado</li>
              </ul>
            </button>
          </div>

          <div className="px-6 pb-5 -mt-2">
            <p className="text-[0.6875rem] text-gray-400 leading-relaxed">
              💡 Não tem certeza? Use <strong>Atalho rápido</strong> para mensagens rotineiras durante conversa.
              Use <strong>Modelo Meta</strong> apenas se precisar enviar a mensagem quando a janela de 24h da WABA já fechou.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
