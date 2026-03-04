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
  ClipboardCheck
} from 'lucide-react'
import { getUserRole } from '@/utils/auth'
import { canAccessModule } from '@/utils/roles'
import { useMemo } from 'react'

const allMenuItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    module: 'dashboard'
  },
  {
    name: 'Pacientes',
    href: '/pacientes',
    icon: Users,
    module: 'pacientes'
  },
  {
    name: 'Agenda',
    href: '/agenda',
    icon: Calendar,
    module: 'agenda'
  },
  {
    name: 'Prontuários',
    href: '/prontuarios',
    icon: FileText,
    module: 'prontuarios'
  },
  {
    name: 'Frequência',
    href: '/frequencia',
    icon: ClipboardCheck,
    module: 'frequencia'
  },
  {
    name: 'Financeiro',
    href: '/financeiro',
    icon: DollarSign,
    module: 'financeiro'
  },
  {
    name: 'Configurações',
    href: '/configuracoes',
    icon: Settings,
    module: 'configuracoes'
  }
]

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname()
  const userRole = getUserRole()
  
  // Filtrar itens do menu baseado no role do usuário
  const menuItems = useMemo(() => {
    if (!userRole) return []
    return allMenuItems.filter(item => canAccessModule(userRole, item.module))
  }, [userRole])

  return (
    <>
      {/* Overlay para mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white border-r border-neutral-200
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <nav className="p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => onClose && onClose()}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                      ${isActive 
                        ? 'bg-primary-50 text-primary-600 font-medium' 
                        : 'text-neutral-700 hover:bg-neutral-50'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>
  )
}
