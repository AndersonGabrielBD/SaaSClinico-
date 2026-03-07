'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { LogIn, AlertCircle, Mail } from 'lucide-react'
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

    // Validação de campos vazios
    if (!email || !password) {
      setError('Preencha todos os campos para continuar')
      setFieldErrors({
        email: !email,
        password: !password
      })
      return
    }

    // Validação de formato de email
    if (!validateEmail(email)) {
      setError('Por favor, insira um e-mail válido')
      setFieldErrors({ email: true, password: false })
      return
    }
    
    try {
      await signIn(email, password)
      // Se chegou aqui, login foi bem-sucedido e o router.replace foi chamado
    } catch (err) {
      // Previne qualquer navegação em caso de erro
      e.preventDefault()
      
      const errorMessage = err.message || 'Erro ao fazer login'
      
      // Identificar tipo de erro para feedback visual específico
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

  const Redirect = () => {
    redirect('/login')
  }

  

  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    // Apenas remove o estilo de erro visual, mas mantém a mensagem até o próximo submit
    if (fieldErrors.email) {
      setFieldErrors({ ...fieldErrors, email: false })
    }
  }

  const handlePasswordChange = (e) => {
    setPassword(e.target.value)
    // Apenas remove o estilo de erro visual, mas mantém a mensagem até o próximo submit
    if (fieldErrors.password) {
      setFieldErrors({ ...fieldErrors, password: false })
    }
  }

  return (
    <div className="min-h-screen flex bg-neutral-50">
      {/* Left panel — branding (desktop only) */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 bg-primary-500 p-12">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <LogIn className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-base tracking-tight">ClinFlow</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-3">
            Gestão clínica<br />simples e eficiente
          </h2>
          <p className="text-white/70 text-sm leading-relaxed">
            Plataforma completa para clínicas de fonoaudiologia. Agenda, prontuários, financeiro e muito mais.
          </p>
        </div>
        <p className="text-white/40 text-xs">© 2026 ClinFlow</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
              <LogIn className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-neutral-900 tracking-tight">ClinFlow</span>
          </div>

          <h1 className="text-2xl font-bold text-neutral-900 mb-1">Entrar</h1>
          <p className="text-sm text-neutral-500 mb-8">Acesse sua conta para continuar</p>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${fieldErrors.email ? 'text-red-400' : 'text-neutral-400'}`} />
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  autoComplete="email"
                  className={`w-full pl-10 pr-4 py-2.5 text-sm border rounded-lg outline-none transition
                    focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
                    ${fieldErrors.email ? 'border-red-300 bg-red-50' : 'border-neutral-200 bg-white'}`}
                  placeholder="seu@email.com"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <PasswordInput
              label="Senha"
              value={password}
              onChange={handlePasswordChange}
              placeholder="••••••••"
              hasError={fieldErrors.password}
              disabled={loading}
              errorIcon={AlertCircle}
            />

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-100 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Forgot password */}
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                Esqueceu a senha?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary-500 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
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
