import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AtendimentoPage from './pages/AtendimentoPage';
import ConversasPage from './pages/ConversasPage';
import LigacoesPage from './pages/LigacoesPage';
import DisparosPage from './pages/DisparosPage';
import WorkflowNegociacoesPage from './pages/WorkflowNegociacoesPage';
import WorkflowRecorrenciaPage from './pages/WorkflowRecorrenciaPage';
import WorkflowFicouFacilPage from './pages/WorkflowFicouFacilPage';
import AlunosPage from './pages/AlunosPage';
import TitulosPage from './pages/TitulosPage';
import NegociacoesPage from './pages/NegociacoesPage';
import SegmentacaoPage from './pages/SegmentacaoPage';
import OcorrenciasPage from './pages/OcorrenciasPage';
import RepositorioPage from './pages/RepositorioPage';
import ConfiguracoesPage from './pages/ConfiguracoesPage';
import UsuariosPage from './pages/UsuariosPage';
import TemplatesWhatsappPage from './pages/TemplatesWhatsappPage';
import TemplatesConversaPage from './pages/TemplatesConversaPage';
import TemplateMetaEditorPage from './pages/TemplateMetaEditorPage';
import TagsPage from './pages/TagsPage';
import AtividadesPage from './pages/AtividadesPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/atendimento/conversas" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/atendimento" element={<AtendimentoPage />} />
            <Route path="/atendimento/conversas" element={<ConversasPage />} />
            <Route path="/atendimento/ligacoes" element={<LigacoesPage />} />
            <Route path="/atendimento/disparos" element={<DisparosPage />} />
            <Route path="/atendimento/atividades" element={<AtividadesPage />} />
            <Route path="/workflow/negociacoes" element={<WorkflowNegociacoesPage />} />
            <Route path="/workflow/recorrencia" element={<WorkflowRecorrenciaPage />} />
            <Route path="/workflow/ficou-facil" element={<WorkflowFicouFacilPage />} />
            <Route path="/alunos" element={<AlunosPage />} />
            <Route path="/titulos" element={<TitulosPage />} />
            <Route path="/negociacoes" element={<NegociacoesPage />} />
            <Route path="/segmentacao" element={<SegmentacaoPage />} />
            <Route path="/ocorrencias" element={<OcorrenciasPage />} />
            <Route path="/repositorio" element={<RepositorioPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="/configuracoes/usuarios" element={<UsuariosPage />} />
            <Route path="/configuracoes/templates-whatsapp" element={<TemplatesWhatsappPage />} />
            <Route path="/configuracoes/templates-conversa" element={<TemplatesConversaPage />} />
            <Route path="/configuracoes/templates-conversa/novo-meta" element={<TemplateMetaEditorPage />} />
            <Route path="/configuracoes/templates-conversa/meta/:id" element={<TemplateMetaEditorPage />} />
            <Route path="/configuracoes/tags" element={<TagsPage />} />
            <Route path="*" element={<Navigate to="/atendimento/conversas" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
