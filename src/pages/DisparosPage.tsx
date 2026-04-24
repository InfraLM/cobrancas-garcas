import { MessageSquareQuote, Send, History, Layers } from 'lucide-react';
import Tabs from '../components/ui/Tabs';
import TemplatesBlipTab from '../components/disparos/TemplatesBlipTab';
import HistoricoDisparosTab from '../components/disparos/HistoricoDisparosTab';
import ReguasTab from '../components/disparos/ReguasTab';

const tabs = [
  { id: 'reguas', label: 'Réguas', icone: Layers },
  { id: 'templates', label: 'Templates', icone: MessageSquareQuote },
  { id: 'historico', label: 'Histórico', icone: History },
];

export default function DisparosPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 px-6 pt-1">
        <Send size={20} className="text-primary" />
        <h1 className="text-xl font-semibold text-on-surface">Disparos WhatsApp</h1>
      </div>

      <Tabs tabs={tabs}>
        {(ativo) => {
          if (ativo === 'templates') return <TemplatesBlipTab />;
          if (ativo === 'reguas') return <ReguasTab />;
          if (ativo === 'historico') return <HistoricoDisparosTab />;
          return null;
        }}
      </Tabs>
    </div>
  );
}
