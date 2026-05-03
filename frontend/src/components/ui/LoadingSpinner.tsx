interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
}

export function LoadingSpinner({ size = 'md', className = '', label }: LoadingSpinnerProps) {
  return (
    <div className={['flex flex-col items-center justify-center gap-3', className].join(' ')}>
      <svg
        className={['animate-spin text-primary', sizeClasses[size]].join(' ')}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {label && <p className="text-sm text-gray-500">{label}</p>}
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <LoadingSpinner size="lg" label="Carregando..." />
    </div>
  )
}
