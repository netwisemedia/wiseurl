'use client'

import { PAGE_SIZE_OPTIONS } from '@/lib/page-size'

export default function PageSizeSelect({ value, onChange, disabled }: { value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">Rows per page
    <select className="input w-auto! py-1!" value={value} disabled={disabled} onChange={event => onChange(Number(event.target.value))} aria-label="Rows per page">
      {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
    </select>
  </label>
}
