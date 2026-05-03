import React from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  children: React.ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50',
  secondary:
    'bg-bg-secondary text-primary hover:bg-gray-200 focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50',
  danger:
    'bg-danger text-white hover:bg-red-700 focus:ring-2 focus:ring-danger focus:ring-offset-2 disabled:opacity-50',
  ghost:
    'bg-transparent text-primary hover:bg-primary/10 focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50',
  outline:
    'bg-white text-primary border border-primary hover:bg-primary/5 focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded',
  md: 'px-4 py-2 text-sm rounded',
  lg: 'px-6 py-3 text-base rounded-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 focus:outline-none',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        loading || disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
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
      )}
      {children}
    </button>
  )
}
