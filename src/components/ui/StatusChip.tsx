export type ChipStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'ACTIVE' | 'ENDED'

export const STATUS_LABEL: Record<ChipStatus, string> = {
  PAID: 'Оплачено', PARTIAL: 'Частково', UNPAID: 'Не оплачено',
  ACTIVE: 'Активний', ENDED: 'Завершений',
}

const BASE = 'px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-tighter'
export function chipClass(status: ChipStatus): string {
  const tone: Record<ChipStatus, string> = {
    PAID: 'bg-secondary-container text-on-secondary-container',
    ACTIVE: 'bg-secondary-container text-on-secondary-container',
    PARTIAL: 'bg-primary-fixed text-primary-container',
    UNPAID: 'bg-error-container text-on-error-container',
    ENDED: 'bg-surface-container-highest text-on-surface-variant',
  }
  return `${BASE} ${tone[status]}`
}

export function StatusChip({ status }: { status: ChipStatus }) {
  return <span className={chipClass(status)}>{STATUS_LABEL[status]}</span>
}
