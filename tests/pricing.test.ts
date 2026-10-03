import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeUnitPrices, parseAmountInput } from '../shared/pricing'

test('鱼子酱 3罐×30g 整盒120', () => {
  const r = computeUnitPrices({ amount: '120', quoteUnit: 'package', packCount: 3, unitSize: 30, unitSizeUnit: 'g' })
  assert.equal(r.perItem, '40.00')
  assert.equal(r.per100g, '133.33')
  assert.equal(r.per100ml, null)
})
test('葡萄酒 6×750ml 整箱90', () => {
  const r = computeUnitPrices({ amount: '90', quoteUnit: 'package', packCount: 6, unitSize: 750, unitSizeUnit: 'ml' })
  assert.equal(r.perItem, '15.00')
  assert.equal(r.perL, '20.00')
  assert.equal(r.per100g, null)
})
test('香水 50ml 80', () => {
  const r = computeUnitPrices({ amount: '80', quoteUnit: 'item', unitSize: 50, unitSizeUnit: 'ml' })
  assert.equal(r.per100ml, '160.00')
  assert.equal(r.perItem, '80.00')
})
test('耳机 无净含量', () => {
  const r = computeUnitPrices({ amount: '120', quoteUnit: 'item' })
  assert.equal(r.perItem, '120.00')
  assert.equal(r.per100g, null)
  assert.equal(r.per100ml, null)
})
test('混合套装不拆分', () => {
  const r = computeUnitPrices({ amount: '200', quoteUnit: 'package', packCount: 4, unitSize: 30, unitSizeUnit: 'ml', isMixedSet: true })
  assert.equal(r.perPackage, '200.00')
  assert.equal(r.perItem, null)
  assert.equal(r.per100ml, null)
})
test('不做重量体积换算', () => {
  const r = computeUnitPrices({ amount: '10', quoteUnit: 'l', unitSize: 100, unitSizeUnit: 'g' })
  assert.equal(r.perL, '10.00')
  assert.ok(r.notes.length)
})
test('金额解析', () => {
  assert.deepEqual(parseAmountInput('12,5'), { ok: true, value: '12.5' })
  assert.deepEqual(parseAmountInput('1.234,56'), { ok: true, value: '1234.56' })
  assert.deepEqual(parseAmountInput('1,234.56'), { ok: true, value: '1234.56' })
  const a: any = parseAmountInput('1,234')
  assert.equal(a.ok, false)
  assert.ok(a.ambiguous)
  assert.deepEqual(parseAmountInput('0,125'), { ok: true, value: '0.125' })
})
