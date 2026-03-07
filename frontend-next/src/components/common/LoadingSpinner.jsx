export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-7 w-7',
    lg: 'h-10 w-10',
    xl: 'h-14 w-14',
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`animate-spin rounded-full border-2 border-neutral-200 border-t-primary-500 ${sizeClasses[size]}`}
      />
    </div>
  )
}

export function LoadingSkeleton({ rows = 4, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-5 border border-neutral-100">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-10 h-10 rounded-full bg-neutral-100 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-neutral-100 rounded-full animate-pulse w-1/3" />
              <div className="h-3 bg-neutral-100 rounded-full animate-pulse w-1/4" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-neutral-100 rounded-full animate-pulse w-full" />
            <div className="h-3 bg-neutral-100 rounded-full animate-pulse w-5/6" />
          </div>
        </div>
      ))}
    </div>
  )
}
