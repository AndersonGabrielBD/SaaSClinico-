export default function EmptyState({ 
  icon, 
  title, 
  description, 
  action,
  actionLabel 
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      {icon && (
        <div className="mb-5 w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400">
          {icon}
        </div>
      )}
      
      <h3 className="text-base font-bold text-neutral-800 mb-1.5">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-neutral-500 mb-6 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      
      {action && actionLabel && (
        <button
          onClick={action}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all shadow-sm hover:shadow-md active:scale-[0.97]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
