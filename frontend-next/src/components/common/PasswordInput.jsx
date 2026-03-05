import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'

/**
 * Campo de entrada de senha reutilizável com toggle de mostrar/esconder
 * @param {string} label - Rótulo do campo
 * @param {string} value - Valor do campo
 * @param {function} onChange - Callback para mudança de valor
 * @param {string} placeholder - Placeholder do campo
 * @param {boolean} hasError - Se o campo tem erro
 * @param {boolean} disabled - Se o campo está desabilitado
 * @param {string} errorIcon - Ícone para exibir em caso de erro (opcional)
 */
export default function PasswordInput({
  label,
  value,
  onChange,
  placeholder = '••••••••',
  hasError = false,
  disabled = false,
  errorIcon: ErrorIcon = null
}) {
  const [showPassword, setShowPassword] = useState(false)

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Lock className={`w-5 h-5 ${hasError ? 'text-red-500' : 'text-neutral-400'}`} />
        </div>
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition ${
            hasError
              ? 'border-red-300 focus:ring-red-500 bg-red-50'
              : 'border-neutral-300 focus:ring-primary-500'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1">
          {ErrorIcon && hasError && (
            <ErrorIcon className="w-5 h-5 text-red-500" />
          )}
          <button
            type="button"
            onClick={togglePasswordVisibility}
            disabled={disabled}
            className="text-neutral-400 hover:text-neutral-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title={showPassword ? 'Esconder senha' : 'Mostrar senha'}
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
