export default function EmptyState({ 
  icon, 
  title, 
  description, 
  action,
  actionLabel 
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="mb-4 p-4 rounded-2xl bg-neutral-100 text-neutral-400">
          {icon}
        </div>
      )}
      
      <h3 className="text-base font-semibold text-neutral-800 mb-1.5">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-neutral-500 mb-6 max-w-sm">
          {description}
        </p>
      )}
      
      {action && actionLabel && (
        <button
          onClick={action}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
