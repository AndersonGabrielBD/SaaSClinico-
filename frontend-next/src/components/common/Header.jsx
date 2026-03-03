'use client'

import { useAuth } from '@/context/AuthContext'
import { LogOut, User } from 'lucide-react'

export default function Header() {
  const { user, signOut } = useAuth()

  return (
    <header className="bg-white border-b border-neutral-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-600">
            FonoFlow
          </h1>
          <p className="text-sm text-neutral-600">
            Sistema de Gestão de Clínicas
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <User className="w-5 h-5 text-primary-600" />
            </div>
            <div>
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
            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </header>
  )
}
