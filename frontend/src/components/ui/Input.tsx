import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  children: React.ReactNode
}

const baseInputClasses =
  'w-full border border-gray-300 rounded bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors duration-150'

const errorInputClasses =
  'w-full border border-danger rounded bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-danger focus:border-danger transition-colors duration-150'

export function Input({ label, error, hint, className = '', ...props }: InputProps) {
  const id = props.id || props.name
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <input
        id={id}
        className={[error ? errorInputClasses : baseInputClasses, className].join(' ')}
        {...props}
      />
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

export function Textarea({ label, error, hint, className = '', ...props }: TextareaProps) {
  const id = props.id || props.name
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <textarea
        id={id}
        className={[
          error ? errorInputClasses : baseInputClasses,
          'resize-y min-h-[80px]',
          className,
        ].join(' ')}
        {...props}
      />
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

interface PhoneInputProps {
  label?: string
  error?: string
  hint?: string
  name?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
}

function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    // (XX) XXXX-XXXX
    return digits
      .replace(/^(\d{0,2})/, '($1')
      .replace(/^(\(\d{2})(\d)/, '$1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  }
  // (XX) XXXXX-XXXX
  return digits
    .replace(/^(\d{0,2})/, '($1')
    .replace(/^(\(\d{2})(\d)/, '$1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

export function PhoneInput({ label, error, hint, name, value, onChange, required, placeholder }: PhoneInputProps) {
  const id = name
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(maskPhone(e.target.value))
  }
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        placeholder={placeholder || '(11) 99999-9999'}
        className={error ? errorInputClasses : baseInputClasses}
      />
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

export function Select({ label, error, hint, children, className = '', ...props }: SelectProps) {
  const id = props.id || props.name
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <select
        id={id}
        className={[error ? errorInputClasses : baseInputClasses, className].join(' ')}
        {...props}
      >
        {children}
      </select>
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
