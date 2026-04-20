import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    if (!credentialResponse.credential) return;
    setError(null);

    try {
      await loginWithGoogle(credentialResponse.credential);
      navigate('/atendimento/conversas');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login com Google');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <img src="/logo-vermelho.svg" alt="Liberdade Médica" className="h-8 mb-4" />
          <h1 className="text-xl font-semibold text-on-surface">Sistema de Cobranca</h1>
          <p className="text-[0.8125rem] text-on-surface-variant mt-1">Faca login para continuar</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm shadow-black/[0.04] p-6">
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Falha no login com Google')}
              theme="outline"
              size="large"
              width="320"
              text="signin_with"
              logo_alignment="left"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 mt-4 rounded-lg bg-error/10 text-error text-[0.75rem]">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <p className="text-[0.6875rem] text-on-surface-variant text-center mt-4">
            Apenas usuarios previamente cadastrados podem acessar.
          </p>
        </div>
      </div>
    </div>
  );
}
