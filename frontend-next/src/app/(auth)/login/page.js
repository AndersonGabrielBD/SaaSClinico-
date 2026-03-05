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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-neutral-100 px-4">
      <div className="max-w-md w-full">
        {/* Logo e Título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl mb-4">
            <span className="text-white font-bold text-2xl">FF</span>
          </div>
          <h1 className="text-3xl font-bold text-primary-700 mb-2">
            ClinFlow
          </h1>
          <p className="text-neutral-600">
            Sistema de Gestão para Clínicas de Fonoaudiologia
          </p>
        </div>

        {/* Card de Login */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-neutral-900 mb-6">
            Entrar no sistema
          </h2>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className={`w-5 h-5 ${fieldErrors.email ? 'text-red-500' : 'text-neutral-400'}`} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  autoComplete="email"
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition ${
                    fieldErrors.email
                      ? 'border-red-300 focus:ring-red-500 bg-red-50'
                      : 'border-neutral-300 focus:ring-primary-500'
                  }`}
                  placeholder="seu@email.com"
                  disabled={loading}
                />
                {fieldErrors.email && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  </div>
                )}
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

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg animate-shake">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Erro ao fazer login</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-500 text-white py-3 rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Entrar
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-neutral-500">
            <Link href="/forgot-password" className="text-primary-600 hover:text-primary-700 font-medium">
              Esqueceu sua senha?
            </Link>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 text-center text-xs text-neutral-500">
          Ao entrar, você concorda com nossos{' '}
          <a href="#" className="text-primary-600 hover:underline">
            Termos de Uso
          </a>{' '}
          e{' '}
          <a href="#" className="text-primary-600 hover:underline">
            Política de Privacidade (LGPD)
          </a>
        </div>
      </div>
    </div>
  )
}
