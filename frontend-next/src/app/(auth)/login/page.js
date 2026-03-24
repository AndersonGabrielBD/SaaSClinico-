'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { LogIn, AlertCircle, Mail, Activity } from 'lucide-react'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import PasswordInput from '@/components/common/PasswordInput'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({ email: false, password: false })
  const { signIn, loading } = useAuth()

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    setError('')
    setFieldErrors({ email: false, password: false })

    if (!email || !password) {
      setError('Preencha todos os campos para continuar')
      setFieldErrors({ email: !email, password: !password })
      return
    }

    if (!validateEmail(email)) {
      setError('Por favor, insira um e-mail válido')
      setFieldErrors({ email: true, password: false })
      return
    }
    
    try {
      await signIn(email, password)
    } catch (err) {
      e.preventDefault()
      const errorMessage = err.message || 'Erro ao fazer login'
      
      if (errorMessage.includes('credentials') || errorMessage.includes('Invalid')) {
        setError('E-mail ou senha incorretos. Verifique seus dados e tente novamente.')
        setFieldErrors({ email: true, password: true })
      } else if (errorMessage.includes('email')) {
        setError('E-mail não encontrado no sistema')
        setFieldErrors({ email: true, password: false })
      } else if (errorMessage.includes('password') || errorMessage.includes('senha')) {
        setError('Senha incorreta. Tente novamente.')
        setFieldErrors({ email: false, password: true })
      } else {
        setError(errorMessage)
        setFieldErrors({ email: true, password: true })
      }
    }
  }

  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: false })
  }

  const handlePasswordChange = (e) => {
    setPassword(e.target.value)
    if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: false })
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-primary-50/40 via-neutral-50 to-blue-50/30">
      {/* Left panel — branding (desktop only) */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 bg-gradient-to-br from-primary-600 to-primary-800 p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/20" />
          <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-white/10" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">ClinFlow</span>
          </div>
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Gestão clínica<br />simples e eficiente
          </h2>
          <p className="text-white/70 text-base leading-relaxed max-w-xs">
            Plataforma completa para clínicas. Agenda, prontuários, financeiro e muito mais.
          </p>
        </div>
        <p className="text-white/30 text-xs relative z-10">© 2026 ClinFlow — Gestão de Clínicas</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-neutral-900 tracking-tight text-lg block">ClinFlow</span>
              <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Gestão Clínica</span>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-neutral-900 mb-1.5 tracking-tight">Bem-vindo</h1>
          <p className="text-sm text-neutral-500 mb-8">Acesse sua conta para continuar</p>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-2">
                E-mail
              </label>
              <div className="relative">
                <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${fieldErrors.email ? 'text-red-400' : 'text-neutral-400'}`} />
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  autoComplete="email"
                  className={`w-full pl-10 pr-4 py-3 text-sm border rounded-xl outline-none transition-all
                    focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
                    ${fieldErrors.email ? 'border-red-300 bg-red-50' : 'border-neutral-200 bg-white'}`}
                  placeholder="seu@email.com"
                  disabled={loading}
                />
              </div>
            </div>

            <PasswordInput
              label="Senha"
              value={password}
              onChange={handlePasswordChange}
              placeholder="••••••••"
              hasError={fieldErrors.password}
              disabled={loading}
              errorIcon={AlertCircle}
            />

            {error && (
              <div className="flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl animate-shake">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-primary-600 hover:text-primary-700 font-semibold">
                Esqueceu a senha?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary-500 text-white text-sm font-bold py-3 rounded-xl hover:bg-primary-600 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Entrar no sistema
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
