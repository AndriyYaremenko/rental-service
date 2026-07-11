import { Icon } from './Icon'

export function KpiCard({ label, value, delta, icon, iconTone = 'primary' }: { label: string; value: string; delta?: { text: string; positive?: boolean }; icon: string; iconTone?: 'primary' | 'secondary' }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(26,43,60,0.05)] p-card-padding border border-surface-container">
      <div className="flex justify-between items-start mb-2">
        <span className="text-on-surface-variant text-label-md uppercase tracking-widest">{label}</span>
        <div className={`p-2 rounded-lg ${iconTone === 'secondary' ? 'bg-secondary-container text-secondary' : 'bg-primary-fixed text-primary'}`}><Icon name={icon} /></div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-display-lg text-primary font-bold">{value}</span>
        {delta && <span className={`font-bold text-body-md ${delta.positive ? 'text-secondary' : 'text-error'}`}>{delta.text}</span>}
      </div>
    </div>
  )
}
