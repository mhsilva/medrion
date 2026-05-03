import React from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gray'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  gray: 'bg-gray-100 text-gray-500',
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}

import type { PrescriptionStatus } from '../../types'

export function PrescriptionStatusBadge({ status }: { status: PrescriptionStatus }) {
  const map: Record<PrescriptionStatus, { variant: BadgeVariant; label: string }> = {
    generating: { variant: 'gray', label: 'Gerando...' },
    draft: { variant: 'warning', label: 'Rascunho' },
    final: { variant: 'success', label: 'Finalizada' },
    error: { variant: 'danger', label: 'Erro' },
  }
  const { variant, label } = map[status] || { variant: 'default', label: status }
  return <Badge variant={variant}>{label}</Badge>
}
