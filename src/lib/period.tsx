'use client'
import { useState } from 'react'

const MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']

export function useMonth(initYear: number, initMonth: number) {
  const [year, setYear] = useState(initYear)
  const [month, setMonth] = useState(initMonth)
  return { year, month, setYear, setMonth }
}

export function MonthPicker({ year, month, setYear, setMonth }: { year: number; month: number; setYear: (y: number) => void; setMonth: (m: number) => void }) {
  return (
    <span className="inline-flex gap-2">
      <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-body-md">
        {MONTHS.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
      </select>
      <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-body-md" />
    </span>
  )
}
