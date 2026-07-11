'use client'
import { useEffect, type ReactNode } from 'react'
import { Icon } from './Icon'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-xl shadow-2xl p-card-padding w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-headline-sm font-bold text-primary">{title}</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-primary" aria-label="Закрити"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
