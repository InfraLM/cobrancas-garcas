import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLigacoesContext } from '../contexts/LigacoesContext';
import StatusBar from '../components/ligacoes/StatusBar';
import BotaoChamar from '../components/ligacoes/BotaoChamar';
import SeletorTipoLigacao from '../components/ligacoes/SeletorTipoLigacao';
import ConfigCampanha from '../components/ligacoes/ConfigCampanha';
import TesteAudio from '../components/ligacoes/TesteAudio';
import PainelConectando from '../components/ligacoes/PainelConectando';
import PainelLigacaoAtiva from '../components/ligacoes/PainelLigacaoAtiva';
import SeletorQualificacao from '../components/ligacoes/SeletorQualificacao';
import AgendarCallbackModal from '../components/ligacoes/AgendarCallbackModal';
import NovaNegociacaoDrawer from '../components/workflow/NovaNegociacaoDrawer';
import PainelOffline from '../components/ligacoes/PainelOffline';
import PainelDebugLogs from '../components/ligacoes/PainelDebugLogs';

export default function LigacoesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const lig = useLigacoesContext();

  // Return from island
  useEffect(() => {
    if (lig.ilhaAtiva) lig.voltarDaIlha();
  }, []);

  // Pick up phone from URL
  useEffect(() => {
    const telefone = searchParams.get('telefone');
    if (telefone) {
      lig.iniciarLigacaoComTelefone(telefone);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  function handleVerMaisAluno() {
    if (lig.ligacaoAtiva?.aluno) {
      lig.minimizarParaIlha();
      navigate(`/alunos?codigo=${lig.ligacaoAtiva.aluno.codigo}`);
    }
  }

  const escuro = lig.sessao === 'ONLINE' && lig.modoAtivo;

  return (
    <div
      className={`flex flex-col h-full overflow-hidden -mx-6 -mt-1 px-6 pt-1 transition-colors duration-700 ${
        escuro ? 'bg-gray-950' : ''
      }`}
    >
      {/* Status Bar — always visible when session is active */}
      {lig.sessao !== 'OFFLINE' && (
        <StatusBar
          status={lig.statusConexao}
          estadoPagina={lig.estadoPagina}
          inicioLigacao={lig.ligacaoAtiva?.status === 'conectada' ? lig.ligacaoAtiva.inicio : null}
        />
      )}

      {/* ===== SESSION LAYER ===== */}

      {/* OFFLINE — "Go Online" screen */}
      {lig.sessao === 'OFFLINE' && (
        <PainelOffline
          onIrOnline={lig.irOnline}
          telefonePendente={lig.telefoneIndividual}
        />
      )}

      {/* CONNECTING SESSION — WebRTC + Socket + Login */}
      {lig.sessao === 'CONECTANDO_SESSAO' && (
        <PainelConectando
          etapa={lig.etapaConectando}
          onCancelar={lig.desativarRamal}
        />
      )}

      {/* AUDIO TEST — after WebRTC is active */}
      {lig.sessao === 'TESTE_AUDIO' && (
        <TesteAudio
          onIniciar={lig.confirmarAudio}
          onCancelar={lig.desativarRamal}
        />
      )}

      {/* ===== CALL LAYER (only when ONLINE) ===== */}

      {lig.sessao === 'ONLINE' && lig.estadoPagina === 'IDLE' && (
        <BotaoChamar onClick={lig.abrirSeletorTipo} onEncerrarTurno={lig.desativarRamal} />
      )}

      {lig.sessao === 'ONLINE' && lig.estadoPagina === 'SELECAO_TIPO' && (
        <SeletorTipoLigacao
          aberto
          onSelecionar={lig.selecionarTipo}
          onFechar={lig.cancelarChamada}
          telefoneInicial={lig.telefoneIndividual}
        />
      )}

      {lig.sessao === 'ONLINE' && lig.estadoPagina === 'CONFIG_CAMPANHA' && (
        <ConfigCampanha
          onConfirmar={lig.confirmarCampanha}
          onVoltar={lig.voltarParaSelecao}
        />
      )}

      {lig.sessao === 'ONLINE' && lig.estadoPagina === 'EM_LIGACAO' && (
        <PainelLigacaoAtiva
          ligacao={lig.ligacaoAtiva}
          ligacaoEncerrada={lig.ligacaoEncerrada}
          qualificacoes={lig.qualificacoes}
          eventos={lig.eventos}
          onCriarNegociacao={() => lig.setNegociacaoAberta(true)}
          onAgendarCallback={() => lig.setCallbackAberto(true)}
          onDesligarChamada={lig.desligarChamada}
          onDesativarWebRTC={lig.irOffline}
          onVerMaisAluno={handleVerMaisAluno}
          onQualificarInline={lig.qualificarLigacaoInline}
        />
      )}

      {lig.sessao === 'ONLINE' && lig.estadoPagina === 'QUALIFICACAO' && (
        <SeletorQualificacao
          qualificacoes={lig.qualificacoes}
          onSelecionar={lig.qualificarLigacao}
          aberto
        />
      )}

      {/* Modals */}
      <AgendarCallbackModal
        aluno={lig.ligacaoAtiva?.aluno || null}
        aberto={lig.callbackAberto}
        onFechar={() => lig.setCallbackAberto(false)}
        onAgendar={lig.agendarCallback}
      />

      <NovaNegociacaoDrawer
        aberto={lig.negociacaoAberta}
        onFechar={() => lig.setNegociacaoAberta(false)}
        alunoInicial={lig.ligacaoAtiva?.aluno}
      />

      {/* Debug panel */}
      <PainelDebugLogs logs={lig.debugLogs} onLimpar={lig.limparDebugLogs} />
    </div>
  );
}
