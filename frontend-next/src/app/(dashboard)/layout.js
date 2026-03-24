'use client'

import { useState } from 'react'
import Header from '@/components/common/Header'
import Sidebar from '@/components/common/Sidebar'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
        
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          
          <main className="flex-1 overflow-y-auto bg-gradient-to-br from-primary-50/30 via-neutral-50 to-blue-50/20">
            <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
