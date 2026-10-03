import Decimal from 'decimal.js'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

/** 计量单位 -> 基础单位（重量 g，体积 ml）。不做重量与体积之间的换算。 */
export const MEASURE_UNITS = {
  g: { dim: 'weight', factor: '1', label: 'g' },
  kg: { dim: 'weight', factor: '1000', label: 'kg' },
  oz: { dim: 'weight', factor: '28.349523125', label: 'oz' },
  ml: { dim: 'volume', factor: '1', label: 'ml' },
  cl: { dim: 'volume', factor: '10', label: 'cl' },
  l: { dim: 'volume', factor: '1000', label: 'L' },
  floz: { dim: 'volume', factor: '29.5735295625', label: 'fl oz' },
} as const
export type MeasureUnit = keyof typeof MEASURE_UNITS

/** 报价单位：金额对应的是什么 */
export const QUOTE_UNITS = {
  package: '整个包装（整盒/整箱/整套）',
  item: '每件（瓶/罐/盒/个）',
  kg: '每公斤',
  l: '每升',
} as const
export type QuoteUnit = keyof typeof QUOTE_UNITS

export interface PriceInput {
  amount: string | number | null | undefined
  quoteUnit: QuoteUnit | string
  /** 该金额覆盖多少个“报价单位”，默认 1（如 2 件 30 元则 2） */
  quoteQty?: string | number | null
  /** 每个包装内的件数（6 瓶 / 3 罐），无则未知 */
  packCount?: string | number | null
  /** 单件净含量 */
  unitSize?: string | number | null
  unitSizeUnit?: string | null
  /** 混合礼盒/成分不同的套装：只保留整套价格 */
  isMixedSet?: boolean
}

export interface UnitPrices {
  computable: boolean
  perPackage: string | null
  perItem: string | null
  per100g: string | null
  perKg: string | null
  per100ml: string | null
  perL: string | null
  /** 某些派生值为何没有展示 */
  notes: string[]
}

const toDec = (v: unknown): Decimal | null => {
  if (v === null || v === undefined || v === '') return null
  try {
    const d = new Decimal(v as any)
    return d.isFinite() ? d : null
  } catch {
    return null
  }
}

const fmt = (d: Decimal | null, dp = 2) => (d ? d.toDecimalPlaces(dp).toFixed(dp) : null)

export function computeUnitPrices(input: PriceInput): UnitPrices {
  const out: UnitPrices = {
    computable: false, perPackage: null, perItem: null,
    per100g: null, perKg: null, per100ml: null, perL: null, notes: [],
  }
  const amount = toDec(input.amount)
  if (!amount || amount.isNegative()) { out.notes.push('缺少有效金额'); return out }
  const qty = toDec(input.quoteQty) ?? new Decimal(1)
  if (qty.lte(0)) { out.notes.push('报价数量无效'); return out }
  const p = amount.div(qty) // 每一个“报价单位”的价格
  const packCount = toDec(input.packCount)
  const size = toDec(input.unitSize)
  const unit = input.unitSizeUnit && input.unitSizeUnit in MEASURE_UNITS
    ? MEASURE_UNITS[input.unitSizeUnit as MeasureUnit] : null

  if (input.isMixedSet) {
    out.notes.push('混合/成分不同的套装：仅保留整套价格，不拆分单品价')
    if (input.quoteUnit === 'package') { out.perPackage = fmt(p); out.computable = true }
    return out
  }

  const dim = unit?.dim ?? null
  let items: Decimal | null = null
  let baseTotal: Decimal | null = null // g 或 ml
  switch (input.quoteUnit) {
    case 'package':
      out.perPackage = fmt(p)
      items = packCount && packCount.gt(0) ? packCount : null
      if (items && size && unit) baseTotal = items.mul(size).mul(unit.factor)
      else if (!items) out.notes.push('未填写包装内件数，无法折算每件价格')
      break
    case 'item':
      items = new Decimal(1)
      if (size && unit) baseTotal = size.mul(unit.factor)
      break
    case 'kg':
      if (dim && dim !== 'weight') out.notes.push('报价为每公斤，但规格是体积，不做重量与体积换算')
      out.per100g = fmt(p.div(10)); out.perKg = fmt(p)
      out.computable = true
      return out
    case 'l':
      if (dim && dim !== 'volume') out.notes.push('报价为每升，但规格是重量，不做重量与体积换算')
      out.per100ml = fmt(p.div(10)); out.perL = fmt(p)
      out.computable = true
      return out
    default:
      out.notes.push('未知报价单位')
      return out
  }
  if (items) out.perItem = fmt(input.quoteUnit === 'package' ? p.div(items) : p)
  if (baseTotal && baseTotal.gt(0) && dim) {
    const perBase = p.div(baseTotal)
    if (dim === 'weight') { out.per100g = fmt(perBase.mul(100)); out.perKg = fmt(perBase.mul(1000)) }
    else { out.per100ml = fmt(perBase.mul(100)); out.perL = fmt(perBase.mul(1000)) }
  } else if (!size || !unit) {
    out.notes.push('未填写净含量，不计算按重量/体积的单价')
  }
  out.computable = !!(out.perPackage || out.perItem || out.per100g || out.per100ml)
  return out
}

export type Metric = 'perItem' | 'per100g' | 'perKg' | 'per100ml' | 'perL'
export const METRIC_LABELS: Record<Metric, string> = {
  perItem: '每件', per100g: '每100g', perKg: '每公斤', per100ml: '每100ml', perL: '每升',
}

/** 比较分组键：不同币种/零售批发/价格类型/税费/新旧状态不可混合 */
export function comparabilityKey(o: {
  currency: string; saleType: string; priceType: string; taxStatus: string; condition?: string | null
}) {
  return [o.currency, o.saleType, o.priceType, o.taxStatus, o.condition || 'any'].join('|')
}

/** 容许 "1,5" "1.234,56" "1,234.56" 之类输入。含义模糊（如 1,234）时返回 ambiguous，要求用户确认。 */
export function parseAmountInput(raw: string):
  | { ok: true; value: string }
  | { ok: false; ambiguous?: { asDecimal: string; asThousand: string }; error?: string } {
  const s = raw.trim().replace(/\s/g, '').replace(/[¥€$£]/g, '')
  if (!s) return { ok: false, error: '请输入金额' }
  if (!/^[0-9.,]+$/.test(s)) return { ok: false, error: '金额只能包含数字和小数点/逗号' }
  const lastDot = s.lastIndexOf('.'); const lastComma = s.lastIndexOf(',')
  const dots = (s.match(/\./g) || []).length; const commas = (s.match(/,/g) || []).length
  const norm = (str: string) => new Decimal(str).toFixed()
  try {
    if (lastDot >= 0 && lastComma >= 0) {
      const decSep = lastDot > lastComma ? '.' : ','
      const thouSep = decSep === '.' ? ',' : '.'
      if ((s.match(new RegExp('\\' + decSep, 'g')) || []).length > 1) return { ok: false, error: '金额格式不正确' }
      return { ok: true, value: norm(s.split(thouSep).join('').replace(decSep, '.')) }
    }
    const sep = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : ''
    if (!sep) return { ok: true, value: norm(s) }
    const count = sep === '.' ? dots : commas
    const parts = s.split(sep)
    if (count > 1) {
      if (parts.slice(1).every((p) => p.length === 3)) return { ok: true, value: norm(parts.join('')) }
      return { ok: false, error: '金额格式不正确' }
    }
    const tail = parts[1] ?? ''
    if (tail.length === 3 && parts[0] !== '0' && parts[0] !== '') {
      return {
        ok: false,
        ambiguous: { asDecimal: norm(parts[0] + '.' + tail), asThousand: norm(parts[0] + tail) },
      }
    }
    return { ok: true, value: norm((parts[0] || '0') + '.' + tail) }
  } catch {
    return { ok: false, error: '金额格式不正确' }
  }
}

export function median(values: string[]): string | null {
  if (!values.length) return null
  const arr = values.map((v) => new Decimal(v)).sort((a, b) => a.cmp(b))
  const mid = Math.floor(arr.length / 2)
  const m = arr.length % 2 ? arr[mid]! : arr[mid - 1]!.add(arr[mid]!).div(2)
  return m.toDecimalPlaces(2).toFixed(2)
}
