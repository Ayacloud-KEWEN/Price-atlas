import Decimal from 'decimal.js'
import {
  BIZ_STATUS, CHANNEL_TYPES, SALE_TYPES, PRICE_TYPES, TAX_STATUS, SHIPPING_STATUS, STOCK_STATUS, CONDITIONS,
} from '../../shared/templates'
import { MEASURE_UNITS, QUOTE_UNITS, METRIC_LABELS } from '../../shared/pricing'

export { BIZ_STATUS, CHANNEL_TYPES, SALE_TYPES, PRICE_TYPES, TAX_STATUS, SHIPPING_STATUS, STOCK_STATUS, CONDITIONS, QUOTE_UNITS, METRIC_LABELS }

/** 金额展示：保留原始精度（至少 2 位），不引入汇率换算 */
export function fmtMoney(v: string | number | null | undefined, currency?: string | null) {
  if (v === null || v === undefined || v === '') return '—'
  let out: string
  try {
    const d = new Decimal(v)
    const dp = Math.min(4, Math.max(2, d.decimalPlaces()))
    const [int, frac] = d.toFixed(dp).split('.')
    out = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac ? '.' + frac : '')
  } catch { out = String(v) }
  return currency ? out + ' ' + currency : out
}

export function fmtDate(v: string | number | Date | null | undefined, withTime = false) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  return withTime ? `${date} ${p(d.getHours())}:${p(d.getMinutes())}` : date
}

/** datetime-local 输入框的值（本地时区） */
export function toLocalInput(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export const unitLabel = (u?: string | null) => (u && u in MEASURE_UNITS ? (MEASURE_UNITS as any)[u].label : u ?? '')

export function fmtSize(value?: string | number | null, unit?: string | null) {
  if (value === null || value === undefined || value === '') return ''
  return new Decimal(value).toDecimalPlaces(3).toString() + unitLabel(unit)
}

/** 规格摘要，如 “6 × 750ml” */
export function specSummary(v: { packCount?: number | null; unitSize?: string | null; unitSizeUnit?: string | null; edition?: string | null; label?: string | null; packDescription?: string | null }) {
  const parts: string[] = []
  const size = fmtSize(v.unitSize, v.unitSizeUnit)
  if (v.packCount && v.packCount > 1) parts.push(size ? `${v.packCount} × ${size}` : `${v.packCount} 件装`)
  else if (size) parts.push(size)
  if (v.packDescription) parts.push(v.packDescription)
  if (v.edition) parts.push(v.edition)
  if (v.label) parts.push(v.label)
  return parts.join(' · ')
}

export const statusClass = (s: string) => ({
  draft: 'bg-warn-50 text-warn',
  pending: 'bg-sky-50 text-sky-800',
  confirmed: 'bg-brand-50 text-brand',
  void: 'bg-danger-50 text-danger line-through',
} as Record<string, string>)[s] ?? 'bg-bg text-muted'

export const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`)
