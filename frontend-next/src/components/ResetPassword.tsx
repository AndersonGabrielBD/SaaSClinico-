// filepath: frontend-next/src/components/ResetPassword.tsx
'use client';

import { useState } from 'react';
import { Mail, Lock, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { api, ResetPasswordRequestResponse, ResetPasswordResponse } from '@/lib/api';

export default function ResetPassword() {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  // Passo 1: Solicitar código
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await api.post<ResetPasswordRequestResponse>(
        '/auth/reset-password-request',
        { email }
      );

      if (result.sucesso) {
        setMessage(`✅ Código gerado: ${result.reset_code}`);
        setResetCode('');
        setStep('reset');
      } else {
        setError(result.mensagem || 'Erro ao gerar código');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar com o servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Passo 2: Resetar senha
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (novaSenha !== confirmaSenha) {
      setError('❌ As senhas não correspondem');
      setLoading(false);
      return;
    }

    if (novaSenha.length < 8) {
      setError('❌ A senha deve ter no mínimo 8 caracteres');
      setLoading(false);
      return;
    }

    try {
      const result = await api.post<ResetPasswordResponse>(
        '/auth/reset-password',
        {
          email,
          reset_code: resetCode,
          nova_senha: novaSenha,
        }
      );

      if (result.sucesso) {
        setMessage('✅ ' + result.mensagem);
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setError('❌ ' + (result.mensagem || 'Erro ao resetar senha'));
      }
    } catch (err) {
      setError('❌ ' + (err instanceof Error ? err.message : 'Erro ao alterar senha'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(resetCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card Principal */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <Lock className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Recuperar Senha</h1>
            <p className="text-gray-600 mt-2">
              {step === 'request'
                ? 'Insira seu email ou CPF para receber um código'
                : 'Use o código para redefinir sua senha'}
            </p>
          </div>

          {/* Passo 1: Solicitar Código */}
          {step === 'request' ? (
            <form onSubmit={handleRequestCode} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email ou CPF
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@example.com ou 12345678900"
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition"
                    required
                  />
                </div>
              </div>

              {/* Alertas */}
              {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {message && (
                <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded-lg flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-green-700 text-sm font-mono">{message}</p>
                </div>
              )}

              {/* Botão Principal */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Gerando...
                  </>
                ) : (
                  'Gerar Código'
                )}
              </button>

              {/* Link para Login */}
              <div className="text-center pt-2">
                <a href="/login" className="text-green-600 hover:text-green-700 font-semibold text-sm">
                  ← Voltar ao Login
                </a>
              </div>
            </form>
          ) : (
            /* Passo 2: Resetar Senha */
            <form onSubmit={handleResetPassword} className="space-y-5">
              {/* Código de Reset */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Código de Reset (8 caracteres)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                    placeholder="ABC123XY"
                    maxLength={8}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition font-mono text-center text-lg font-bold tracking-widest"
                    required
                  />
                  <button
                    type="button"
                    onClick={copyCodeToClipboard}
                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                    title="Copiar código"
                  >
                    {codeCopied ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Nova Senha */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nova Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition"
                    required
                  />
                </div>
              </div>

              {/* Confirmar Senha */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={confirmaSenha}
                    onChange={(e) => setConfirmaSenha(e.target.value)}
                    placeholder="Confirme sua senha"
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition"
                    required
                  />
                </div>
              </div>

              {/* Indicador de Força da Senha */}
              {novaSenha && (
                <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
                  <p className="text-blue-700 text-sm">
                    <span className={novaSenha.length >= 8 ? 'text-green-600' : 'text-orange-600'}>
                      {novaSenha.length >= 12 ? '✓ Senha forte' : '⚠ Senha normal'}
                    </span>
                  </p>
                </div>
              )}

              {/* Alertas */}
              {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {message && (
                <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded-lg flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-green-700 text-sm font-semibold">{message}</p>
                </div>
              )}

              {/* Botão Principal */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Alterando...
                  </>
                ) : (
                  'Resetar Senha'
                )}
              </button>

              {/* Botão Voltar */}
              <button
                type="button"
                onClick={() => {
                  setStep('request');
                  setResetCode('');
                  setNovaSenha('');
                  setConfirmaSenha('');
                  setMessage('');
                  setError('');
                }}
                className="w-full text-green-600 hover:text-green-700 font-semibold py-2 rounded-lg transition border-2 border-green-200 hover:border-green-300"
              >
                ← Voltar
              </button>
            </form>
          )}
        </div>

        {/* Footer com Dica */}
        <div className="text-center mt-6 text-gray-600 text-sm">
          <p>
            🔒 Seus dados estão seguros com{' '}
            <span className="font-semibold text-green-600">ClinFlow</span>
          </p>
        </div>
      </div>
    </div>
  );
}
