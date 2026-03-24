'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
}

const colorMap = {
  success: 'bg-white border-green-200 text-green-800',
  error: 'bg-white border-red-200 text-red-800',
  warning: 'bg-white border-yellow-200 text-yellow-800',
  info: 'bg-white border-blue-200 text-blue-800'
}

const iconColorMap = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500'
}

const accentMap = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
}

export default function Toast({ 
  message, 
  type = 'success', 
  show, 
  onClose, 
  duration = 4000 
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  const Icon = iconMap[type] || CheckCircle

  useEffect(() => {
    if (show) {
      setIsVisible(true)
      setIsLeaving(false)
      
      const timer = setTimeout(() => {
        setIsLeaving(true)
        setTimeout(() => {
          setIsVisible(false)
          onClose?.()
        }, 300)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [show, duration, onClose])

  if (!isVisible) return null

  return (
    <div 
      className={`
        fixed bottom-6 right-6 z-50 
        flex items-center gap-3 
        pl-1 pr-4 py-1 rounded-2xl shadow-float border overflow-hidden
        ${colorMap[type]}
        transform transition-all duration-300 ease-out
        ${isLeaving ? 'translate-y-2 opacity-0 scale-95' : 'translate-y-0 opacity-100 scale-100'}
      `}
    >
      <div className={`w-1 self-stretch rounded-full ${accentMap[type]}`} />
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${type === 'success' ? 'bg-green-50' : type === 'error' ? 'bg-red-50' : type === 'warning' ? 'bg-yellow-50' : 'bg-blue-50'}`}>
        <Icon className={`w-5 h-5 ${iconColorMap[type]}`} />
      </div>
      <p className="text-sm font-medium text-neutral-800 py-2.5">{message}</p>
      <button
        onClick={() => {
          setIsLeaving(true)
          setTimeout(() => {
            setIsVisible(false)
            onClose?.()
          }, 300)
        }}
        className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors ml-2"
      >
        <X className="w-3.5 h-3.5 text-neutral-400" />
      </button>
    </div>
  )
}
