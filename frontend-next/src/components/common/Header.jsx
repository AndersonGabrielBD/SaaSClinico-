'use client'

import { useAuth } from '@/context/AuthContext'
import { LogOut, User, Menu } from 'lucide-react'

export default function Header({ onMenuClick }) {
  const { user, signOut } = useAuth()

  return (
    <header className="bg-white border-b border-neutral-200 h-16 md:h-20 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between sticky top-0 z-40">
      {/* Left - Menu Button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden inline-flex items-center justify-center p-2 hover:bg-neutral-100 rounded-lg transition-colors"
        aria-label="Abrir menu"
      >
        <Menu className="w-6 h-6 text-neutral-700" />
      </button>

      {/* Center/Left - Logo (desktop only) */}
      <div className="hidden lg:block">
        <h1 className="text-xl font-bold text-primary-600">
          ClinFlow
        </h1>
        <p className="text-xs text-neutral-500">
          Gestão de Clínicas
        </p>
      </div>

      {/* Logo on mobile - centered */}
      <div className="lg:hidden absolute left-1/2 transform -translate-x-1/2">
        <h1 className="text-lg font-bold text-primary-600">
          ClinFlow
        </h1>
      </div>

      {/* Right - User Menu */}
      <div className="flex items-center gap-3 md:gap-4">
        <div className="hidden md:flex items-center gap-3 pr-4 border-r border-neutral-200">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-primary-600" />
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-medium text-neutral-900">
              {user?.nome || user?.email || 'Usuário'}
            </p>
            <p className="text-xs text-neutral-500">
              {user?.role || 'Profissional'}
            </p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="p-2 md:p-0 md:px-3 md:py-2 text-neutral-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
          title="Sair"
        >
          <LogOut className="w-5 h-5 md:w-4 md:h-4" />
          <span className="hidden md:inline text-sm">Sair</span>
        </button>
      </div>
    </header>
  )
}
