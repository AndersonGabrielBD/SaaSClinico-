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
  Tag,
  Package,
  ChevronRight,
  LayoutTemplate,
  Headphones,
} from 'lucide-react'
import { getUserRole } from '@/utils/auth'
import { canAccessModule, getDefaultHomePath } from '@/utils/roles'
import { useMemo } from 'react'

function isMenuItemActive(pathname, href) {
  if (pathname === href) return true
  if (href === '/configuracoes') return false
  return pathname.startsWith(`${href}/`)
}

const allMenuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { name: 'Pacientes', href: '/pacientes', icon: Users, module: 'pacientes' },
  { name: 'Agenda', href: '/agenda', icon: Calendar, module: 'agenda' },
  { name: 'Prontuários', href: '/prontuarios', icon: FileText, module: 'prontuarios' },
  {
    name: 'Modelos de evolução',
    href: '/configuracoes/modelos-evolucao',
    icon: LayoutTemplate,
    module: 'modelos_evolucao',
  },
  { name: 'Frequência', href: '/frequencia', icon: ClipboardCheck, module: 'frequencia' },
  { name: 'Mensalidades', href: '/financeiro/mensalidades', icon: DollarSign, module: 'financeiro' },
  { name: 'Pacotes', href: '/financeiro/pacotes', icon: Package, module: 'financeiro' },
  { name: 'Salas', href: '/salas', icon: DoorOpen, module: 'salas' },
  { name: 'Tipos de Atend.', href: '/tipos-atendimento', icon: Tag, module: 'tipos_atendimento' },
  { name: 'Suporte', href: '/suporte', icon: Headphones, module: 'suporte' },
  { name: 'Configurações', href: '/configuracoes', icon: Settings, module: 'configuracoes' },
]

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname()
  const userRole = getUserRole()
  
  const menuItems = useMemo(() => {
    if (!userRole) return []
    return allMenuItems.filter(item => canAccessModule(userRole, item.module))
  }, [userRole])

  const homeHref = useMemo(() => getDefaultHomePath(userRole), [userRole])

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[260px] bg-white
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          shadow-sidebar
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        role="navigation"
        aria-label="Menu principal"
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-[72px] flex-shrink-0">
          <Link href={homeHref} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-neutral-900 tracking-tight block leading-tight">ClinNext</span>
              <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Gestão Clínica</span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest px-3 mb-3">
            Menu
          </p>
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = isMenuItemActive(pathname, item.href)
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => onClose && onClose()}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium
                      min-h-[44px] transition-all duration-200 group relative
                      ${isActive 
                        ? 'bg-primary-500 text-white shadow-sm' 
                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                      }
                    `}
                  >
                    <div className={`
                      w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                      ${isActive 
                        ? 'bg-white/20' 
                        : 'bg-neutral-100 group-hover:bg-neutral-200/70'
                      }
                    `}>
                      <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-700'}`} />
                    </div>
                    <span className="flex-1">{item.name}</span>
                    {isActive && (
                      <ChevronRight className="w-4 h-4 text-white/60" />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="px-4 pb-5 flex-shrink-0">
          <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-primary-600" />
              <p className="text-xs font-bold text-primary-800">ClinNext</p>
            </div>  
            <p className="text-[11px] text-primary-600/80 leading-relaxed">
              Sistema de gestão clínica completo
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
