'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/common/Header'
import Sidebar from '@/components/common/Sidebar'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const closeSidebar = () => setSidebarOpen(false)

  // Evita scroll do conteúdo por trás do overlay no mobile (iOS/Safari “vaza” o scroll
  // e pode deslocar o shell inteiro, fazendo o header sumir ao fechar o menu).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 1023px)')
    const apply = () => {
      if (!mq.matches) {
        document.body.style.removeProperty('overflow')
        document.documentElement.style.removeProperty('overflow')
        return
      }
      if (sidebarOpen) {
        document.body.style.overflow = 'hidden'
        document.documentElement.style.overflow = 'hidden'
      } else {
        document.body.style.removeProperty('overflow')
        document.documentElement.style.removeProperty('overflow')
      }
    }
    apply()
    mq.addEventListener('change', apply)
    return () => {
      mq.removeEventListener('change', apply)
      document.body.style.removeProperty('overflow')
      document.documentElement.style.removeProperty('overflow')
    }
  }, [sidebarOpen])

  return (
    <ProtectedRoute>
      <div className="flex h-screen min-h-0 min-w-0">
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
        
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          
          <main className="min-h-0 min-w-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden overscroll-y-contain bg-gradient-to-br from-primary-50/30 via-neutral-50 to-blue-50/20 max-lg:pt-[72px] lg:pt-0">
            <div className="mx-auto w-full max-w-[1400px] min-w-0 px-4 py-6 md:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
