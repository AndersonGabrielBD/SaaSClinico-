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
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800'
}

const iconColorMap = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500'
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
        px-4 py-3 rounded-lg shadow-lg border
        ${colorMap[type]}
        transform transition-all duration-300 ease-out
        ${isLeaving ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${iconColorMap[type]}`} />
      <p className="text-sm font-medium">{message}</p>
      <button
        onClick={() => {
          setIsLeaving(true)
          setTimeout(() => {
            setIsVisible(false)
            onClose?.()
          }, 300)
        }}
        className="p-1 hover:bg-black/5 rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
