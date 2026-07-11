'use client'
import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'

// Стек відкритих модалок: Escape закриває ЛИШЕ верхню (інакше у вкладених
// модалках — напр. форма локації всередині панелі — Escape закрив би всі одразу).
const modalStack: Array<() => void> = []

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const entry = () => closeRef.current()
    modalStack.push(entry)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === entry) entry()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const i = modalStack.indexOf(entry)
      if (i >= 0) modalStack.splice(i, 1)
    }
  }, [])
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-xl shadow-2xl p-card-padding w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-headline-sm font-bold text-primary">{title}</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-primary" aria-label="Закрити"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
