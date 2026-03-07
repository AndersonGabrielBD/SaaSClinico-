'use client';

import { useState } from 'react';
import { Mail, Lock, KeyRound, AlertCircle, CheckCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { api, ResetPasswordRequestResponse, ResetPasswordResponse } from '@/lib/api';
import Link from 'next/link';

export default function ResetPassword() {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmaSenha, setShowConfirmaSenha] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await api.post<ResetPasswordRequestResponse>(
        '/auth/reset-password-request',
        { email }
      );

      if (result.sucesso) {
        setStep('reset');
      } else {
        setError(result.mensagem || 'Erro ao gerar código');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (novaSenha !== confirmaSenha) {
      setError('As senhas não correspondem');
      setLoading(false);
      return;
    }

    if (novaSenha.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres');
      setLoading(false);
      return;
    }

    try {
      const result = await api.post<ResetPasswordResponse>(
        '/auth/reset-password',
        { email, reset_code: resetCode, nova_senha: novaSenha }
      );

      if (result.sucesso) {
        setSuccess(result.mensagem || 'Senha alterada com sucesso!');
        setTimeout(() => { window.location.href = '/login'; }, 2000);
      } else {
        setError(result.mensagem || 'Erro ao resetar senha');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  const senhaForte = novaSenha.length >= 12;
  const senhaOk = novaSenha.length >= 8;

  return (
    <div className="min-h-screen flex bg-neutral-50">
      {/* Painel esquerdo — branding (apenas desktop) */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 bg-primary-500 p-12">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-base tracking-tight">ClinFlow</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-3">
            Recuperação<br />de acesso
          </h2>
          <p className="text-white/70 text-sm leading-relaxed">
            {step === 'request'
              ? 'Informe seu e-mail e enviaremos um código para redefinir sua senha com segurança.'
              : 'Digite o código recebido por e-mail e defina sua nova senha.'}
          </p>
        </div>
        <p className="text-white/40 text-xs">© 2026 ClinFlow</p>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-neutral-900 tracking-tight">ClinFlow</span>
          </div>

          {/* Indicador de passos */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step === 'request' ? 'bg-primary-500 text-white' : 'bg-primary-100 text-primary-600'
            }`}>
              {step === 'reset' ? <CheckCircle className="w-4 h-4" /> : '1'}
            </div>
            <div className={`h-px flex-1 transition-colors ${step === 'reset' ? 'bg-primary-400' : 'bg-neutral-200'}`} />
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step === 'reset' ? 'bg-primary-500 text-white' : 'bg-neutral-200 text-neutral-400'
            }`}>2</div>
          </div>

          {step === 'request' ? (
            <>
              <h1 className="text-2xl font-bold text-neutral-900 mb-1">Recuperar senha</h1>
              <p className="text-sm text-neutral-500 mb-8">Informe o e-mail da sua conta</p>

              <form onSubmit={handleRequestCode} noValidate className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
                    E-mail ou CPF
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full pl-10 pr-4 py-2.5 text-sm border border-neutral-200 bg-white rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-100 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-primary-500 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar código'
                  )}
                </button>

                <div className="text-center pt-1">
                  <Link href="/login" className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" />
                    Voltar ao login
                  </Link>
                </div>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-neutral-900 mb-1">Nova senha</h1>
              <p className="text-sm text-neutral-500 mb-8">
                Código enviado para <span className="font-medium text-neutral-700">{email}</span>
              </p>

              <form onSubmit={handleResetPassword} noValidate className="space-y-4">
                {/* Código */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
                    Código de verificação
                  </label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                    placeholder="Ex: 43R9SYF6"
                    maxLength={8}
                    className="w-full px-4 py-2.5 text-sm border border-neutral-200 bg-white rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 font-mono tracking-widest text-center font-bold"
                    required
                    disabled={loading}
                  />
                  <p className="text-xs text-neutral-400 mt-1">Verifique sua caixa de entrada (e spam)</p>
                </div>

                {/* Nova senha */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
                    Nova senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type={showNovaSenha ? 'text' : 'password'}
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full pl-10 pr-10 py-2.5 text-sm border border-neutral-200 bg-white rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNovaSenha(!showNovaSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                      tabIndex={-1}
                    >
                      {showNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Barra de força */}
                  {novaSenha && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div className={`h-1 flex-1 rounded-full transition-colors ${novaSenha.length >= 1 ? (senhaForte ? 'bg-green-500' : senhaOk ? 'bg-yellow-400' : 'bg-red-400') : 'bg-neutral-200'}`} />
                      <div className={`h-1 flex-1 rounded-full transition-colors ${senhaOk ? (senhaForte ? 'bg-green-500' : 'bg-yellow-400') : 'bg-neutral-200'}`} />
                      <div className={`h-1 flex-1 rounded-full transition-colors ${senhaForte ? 'bg-green-500' : 'bg-neutral-200'}`} />
                      <span className={`text-xs font-medium ml-1 ${senhaForte ? 'text-green-600' : senhaOk ? 'text-yellow-600' : 'text-red-500'}`}>
                        {senhaForte ? 'Forte' : senhaOk ? 'Ok' : 'Fraca'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirmar senha */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type={showConfirmaSenha ? 'text' : 'password'}
                      value={confirmaSenha}
                      onChange={(e) => setConfirmaSenha(e.target.value)}
                      placeholder="Repita a nova senha"
                      className={`w-full pl-10 pr-10 py-2.5 text-sm border rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 ${
                        confirmaSenha && confirmaSenha !== novaSenha
                          ? 'border-red-300 bg-red-50'
                          : 'border-neutral-200 bg-white'
                      }`}
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmaSenha(!showConfirmaSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                      tabIndex={-1}
                    >
                      {showConfirmaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-100 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2.5 p-3 bg-green-50 border border-green-100 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <p className="text-sm text-green-700 font-medium">{success}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-primary-500 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar nova senha'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('request');
                    setResetCode('');
                    setNovaSenha('');
                    setConfirmaSenha('');
                    setError('');
                    setSuccess('');
                  }}
                  className="w-full text-xs text-neutral-500 hover:text-neutral-700 py-1.5 transition-colors inline-flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Usar outro e-mail
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
