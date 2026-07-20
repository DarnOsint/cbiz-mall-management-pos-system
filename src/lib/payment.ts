/**
 * payment.ts — pure functions for all payment calculations.
 * No React, no Supabase. Fully testable.
 */

import type { OrderItem } from '../types'
import { supabase } from './supabase'

export const DEFAULT_VAT_RATE = 0.075

let cachedVatRate: number | null = null
let vatFetchPromise: Promise<number> | null = null

// ─── Basic totals ─────────────────────────────────────────────────────────

export function calcSubtotal(totalAmount: number): number {
  return totalAmount
}

export function calcVat(subtotal: number, rate?: number): number {
  return subtotal * (rate ?? DEFAULT_VAT_RATE)
}

export function calcTotal(subtotal: number, rate?: number): number {
  return subtotal + calcVat(subtotal, rate)
}

export async function getVatRate(): Promise<number> {
  if (cachedVatRate !== null) return cachedVatRate
  if (vatFetchPromise) return vatFetchPromise
  vatFetchPromise = (async () => {
    try {
      const { data } = await supabase.from('settings').select('value').eq('id', 'vat_rate').single()
      const rate = data ? Number(data.value) : DEFAULT_VAT_RATE
      cachedVatRate = isNaN(rate) ? DEFAULT_VAT_RATE : rate
      return cachedVatRate
    } catch {
      return DEFAULT_VAT_RATE
    }
  })()
  return vatFetchPromise
}

export function clearVatCache() {
  cachedVatRate = null
  vatFetchPromise = null
}

export function calcChange(tendered: number, total: number): number {
  return tendered - total
}

// ─── Payment validation ───────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'bank_pos' | 'bank_transfer' | 'credit'

export interface PaymentValidationInput {
  method: PaymentMethod
  total: number
  cashTendered?: number
  debtorName?: string
}

export function canProcess(input: PaymentValidationInput): boolean {
  const { method, total, cashTendered, debtorName } = input
  if (method === 'cash') {
    return typeof cashTendered === 'number' && cashTendered >= total
  }
  if (method === 'credit') {
    return typeof debtorName === 'string' && debtorName.trim().length > 0
  }
  // bank_pos and bank_transfer — no extra validation needed client-side
  return true
}

// ─── Split bill ───────────────────────────────────────────────────────────

export function getPersonItems(
  orderItems: OrderItem[],
  assignments: Record<string, number>,
  personIdx: number
): OrderItem[] {
  return orderItems.filter((item) => assignments[item.id] === personIdx)
}

export function getPersonTotal(
  orderItems: OrderItem[],
  assignments: Record<string, number>,
  personIdx: number
): number {
  return getPersonItems(orderItems, assignments, personIdx).reduce(
    (sum, item) => sum + (item.total_price || 0),
    0
  )
}

export function getUnassignedItems(
  orderItems: OrderItem[],
  assignments: Record<string, number>
): OrderItem[] {
  return orderItems.filter((item) => assignments[item.id] === undefined)
}

export function allItemsAssigned(
  orderItems: OrderItem[],
  assignments: Record<string, number>
): boolean {
  return getUnassignedItems(orderItems, assignments).length === 0
}

// ─── Till session helpers ─────────────────────────────────────────────────

export function calcExpectedCash(openingFloat: number, cashSales: number, payouts: number): number {
  return openingFloat + cashSales - payouts
}

export function calcShortfall(expected: number, actual: number): number {
  return expected > actual ? expected - actual : 0
}

export function calcSurplus(expected: number, actual: number): number {
  return actual > expected ? actual - expected : 0
}
