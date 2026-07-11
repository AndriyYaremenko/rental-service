import type { ReactNode } from 'react'
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(26,43,60,0.05)] p-card-padding border border-surface-container ${className}`}>{children}</div>
}
