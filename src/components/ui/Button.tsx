import type { ButtonHTMLAttributes } from 'react'

type Variant = 'navy' | 'ghost' | 'teal'
const VARIANT: Record<Variant, string> = {
  navy: 'bg-primary text-on-primary hover:opacity-90',
  ghost: 'border-2 border-primary text-primary hover:bg-primary hover:text-on-primary',
  teal: 'bg-secondary text-white hover:scale-105',
}
export function Button({ variant = 'navy', className = '', ...props }: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`px-6 py-3 rounded-lg font-bold text-body-md transition-all disabled:opacity-50 ${VARIANT[variant]} ${className}`} {...props} />
}
