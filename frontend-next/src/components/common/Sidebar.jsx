'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  FileText,
  DollarSign,
  Settings,
  ClipboardCheck,
  X,
  Activity,
  DoorOpen,
  Tag
} from 'lucide-react'
import { getUserRole } from '@/utils/auth'
import { canAccessModule } from '@/utils/roles'
import { useMemo } from 'react'

const allMenuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { name: 'Pacientes', href: '/pacientes', icon: Users, module: 'pacientes' },
  { name: 'Agenda', href: '/agenda', icon: Calendar, module: 'agenda' },
  { name: 'Prontuários', href: '/prontuarios', icon: FileText, module: 'prontuarios' },
  { name: 'Frequência', href: '/frequencia', icon: ClipboardCheck, module: 'frequencia' },
  { name: 'Financeiro', href: '/financeiro', icon: DollarSign, module: 'financeiro' },
  { name: 'Salas', href: '/salas', icon: DoorOpen, module: 'salas' },
  { name: 'Tipos de Atend.', href: '/tipos-atendimento', icon: Tag, module: 'tipos_atendimento' },
  { name: 'Configurações', href: '/configuracoes', icon: Settings, module: 'configuracoes' },
]

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname()
  const userRole = getUserRole()
  
  const menuItems = useMemo(() => {
    if (!userRole) return []
    return allMenuItems.filter(item => canAccessModule(userRole, item.module))
  }, [userRole])

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-60 bg-white border-r border-neutral-100
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        role="navigation"
        aria-label="Menu principal"
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-neutral-100 flex-shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-neutral-900 tracking-tight">ClinFlow</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 hover:bg-neutral-100 rounded-md text-neutral-500"
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-0.5">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => onClose && onClose()}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      min-h-[42px] transition-all duration-150
                      ${isActive 
                        ? 'bg-primary-50 text-primary-700' 
                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary-600' : 'text-neutral-400'}`} />
                    <span>{item.name}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="px-3 pb-4 flex-shrink-0">
          <div className="border-t border-neutral-100 pt-3">
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider px-3 mb-1">
              Sistema
            </p>
            <p className="text-xs text-neutral-400 px-3">
              Gestão de Clínicas
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
