export default function ResponsiveTable({ children, className = '' }) {
  return (
    <div className={`w-full overflow-x-auto overscroll-x-contain ${className}`}>
      {children}
    </div>
  )
}

