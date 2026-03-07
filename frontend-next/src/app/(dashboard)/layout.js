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
      <div className="flex h-screen overflow-hidden bg-neutral-50">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          
          <main className="flex-1 overflow-y-auto">
            <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
