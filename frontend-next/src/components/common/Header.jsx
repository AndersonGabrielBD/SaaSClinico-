'use client'

import { useAuth } from '@/context/AuthContext'
import { LogOut, User, Menu, ChevronDown } from 'lucide-react'
import { useState } from 'react'

export default function Header({ onMenuClick }) {
  const { user, signOut } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const displayName = user?.nome || user?.email?.split('@')[0] || 'Usuário'
  const displayRole = user?.role === 'admin' ? 'Administrador'
    : user?.role === 'recepcao' ? 'Recepção'
    : user?.role === 'fono' ? 'Fonoaudiólogo'
    : user?.role || 'Profissional'

  return (
    <header className="bg-white border-b border-neutral-100 h-16 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left — mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 hover:bg-neutral-100 rounded-lg text-neutral-500"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile logo */}
      <div className="lg:hidden absolute left-1/2 -translate-x-1/2 font-bold text-sm text-neutral-900 tracking-tight">
        ClinFlow
      </div>

      {/* Desktop — empty left filler so user section stays right */}
      <div className="hidden lg:block" />

      {/* Right — user section */}
      <div className="relative">
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-neutral-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-primary-600" />
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-neutral-800 leading-tight">{displayName}</p>
            <p className="text-xs text-neutral-400 leading-tight">{displayRole}</p>
          </div>
          <ChevronDown className={`hidden md:block w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {userMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-neutral-100 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-neutral-50">
                <p className="text-sm font-medium text-neutral-800 truncate">{displayName}</p>
                <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setUserMenuOpen(false); signOut() }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair do sistema
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
