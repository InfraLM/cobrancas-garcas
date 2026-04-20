import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { LigacoesProvider, useLigacoesContext } from '../../contexts/LigacoesContext';
import { RealtimeProvider } from '../../contexts/RealtimeContext';
import IlhaChamada from '../ligacoes/IlhaChamada';
import WebRTCIframe from '../ligacoes/WebRTCIframe';

function AppContent() {
  const location = useLocation();
  const lig = useLigacoesContext();

  const naTelaLigacoes = location.pathname === '/atendimento/ligacoes';

  // Ilha mostra sempre que ha ligacao ativa E nao esta na tela de ligacoes
  const temChamadaAtiva = lig.ligacaoAtiva &&
    ['discando', 'tocando', 'conectada'].includes(lig.ligacaoAtiva.status);
  const mostrarIlha = temChamadaAtiva && !naTelaLigacoes;

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto px-6 pb-6">
          <Outlet />
        </main>
      </div>

      {mostrarIlha && lig.ligacaoAtiva && (
        <IlhaChamada
          telefone={lig.ligacaoAtiva.telefone}
          pessoaNome={lig.ligacaoAtiva.aluno?.nome}
          inicio={lig.ligacaoAtiva.inicio}
          status={lig.ligacaoAtiva.status}
          onClick={lig.voltarDaIlha}
          onDesligar={lig.desligarChamada}
        />
      )}

      {/* WebRTC iframe — persistente enquanto sessao ativa */}
      <WebRTCIframe
        url={lig.webrtcUrl}
        sipRegistrado={lig.statusConexao.sipRegistrado}
      />
    </div>
  );
}

export default function AppLayout() {
  return (
    <RealtimeProvider>
      <LigacoesProvider>
        <AppContent />
      </LigacoesProvider>
    </RealtimeProvider>
  );
}
