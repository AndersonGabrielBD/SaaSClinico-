import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  icon?: ReactNode
  className?: string
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  className = '',
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed select-none'
  
  const variants = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600 active:scale-[0.97] shadow-sm hover:shadow-md',
    secondary: 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 active:scale-[0.97]',
    danger: 'bg-red-500 text-white hover:bg-red-600 active:scale-[0.97] shadow-sm hover:shadow-md',
    ghost: 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 active:scale-[0.97]',
    outline: 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 active:scale-[0.97] shadow-sm',
  }
  
  const sizes = {
    // Mobile-first: touch target confortável (>= ~44px)
    sm: 'px-3 py-2 text-sm h-11',
    md: 'px-4 py-2.5 text-sm h-10',
    lg: 'px-5 py-3 text-sm h-11',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent opacity-70" />
      ) : icon}
      {children}
    </button>
  )
}
