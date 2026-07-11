import type { ReactNode } from 'react'

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-stack-lg">
      <h1 className="text-headline-md font-bold text-primary">{title}</h1>
      {action}
    </div>
  )
}
