import type { InputHTMLAttributes } from 'react'

export function Input({ label, error, className = '', ...props }: { label?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      {label && <span className="block text-label-md uppercase tracking-wider text-on-surface-variant mb-1">{label}</span>}
      <input className={`w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 text-body-md focus:border-secondary focus:ring-2 focus:ring-secondary/40 outline-none transition-all ${error ? 'border-error' : ''} ${className}`} {...props} />
      {error && <span className="block text-body-md text-error mt-1">{error}</span>}
    </label>
  )
}
