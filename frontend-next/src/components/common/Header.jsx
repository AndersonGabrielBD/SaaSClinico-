'use client'

import { useAuth } from '@/context/AuthContext'
import { LogOut, User, Menu, ChevronDown, Search, Bell } from 'lucide-react'
import { useState } from 'react'

export default function Header({ onMenuClick }) {
  const { user, signOut } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const displayName = user?.nome || user?.email?.split('@')[0] || 'Usuário'
  const displayRole = user?.role === 'admin' ? 'Administrador'
    : user?.role === 'recepcao' ? 'Recepção'
    : user?.role === 'fono' ? 'Fonoaudiólogo'
    : user?.role || 'Profissional'

  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-neutral-100/80 h-[72px] px-4 md:px-6 flex items-center gap-4 sticky top-0 z-30">
      {/* Left — mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 hover:bg-neutral-100 rounded-xl text-neutral-500 transition-colors"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile logo */}
      <div className="lg:hidden absolute left-1/2 -translate-x-1/2 font-bold text-sm text-neutral-900 tracking-tight">
        ClinFlow
      </div>

      {/* Search bar - desktop */}
      <div className="hidden lg:flex relative flex-1 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Buscar pacientes, agendamentos..."
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-neutral-50 border border-neutral-200/60 rounded-xl 
                     focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/40 
                     outline-none transition-all duration-200 placeholder:text-neutral-400"
        />
      </div>

      {/* Right section */}
      <div className="hidden lg:block flex-1" />

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="relative p-2.5 hover:bg-neutral-100 rounded-xl text-neutral-500 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
        </button>

        {/* User section */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-neutral-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-xs font-bold text-white">{initials}</span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-neutral-800 leading-tight">{displayName}</p>
              <p className="text-[11px] text-neutral-400 leading-tight">{displayRole}</p>
            </div>
            <ChevronDown className={`hidden md:block w-4 h-4 text-neutral-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-neutral-100 rounded-2xl shadow-float z-20 py-1.5 overflow-hidden animate-scale-in">
                <div className="px-4 py-3 border-b border-neutral-100">
                  <p className="text-sm font-semibold text-neutral-900 truncate">{displayName}</p>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">{user?.email}</p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { setUserMenuOpen(false); signOut() }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair do sistema
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
