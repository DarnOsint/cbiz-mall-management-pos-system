import { supabase } from './supabase'
import type { Order, OrderItem, ReceiptData, PrinterConfig, PrintJob } from '../types'

const PRINT_SERVICE_URL = `http://127.0.0.1:9101`

export function getPrintServiceUrl(): string {
  return PRINT_SERVICE_URL
}

export function isPrintServiceAvailable(): Promise<boolean> {
  return fetch(`${PRINT_SERVICE_URL}/health`, { signal: AbortSignal.timeout(2000) })
    .then((r) => r.ok)
    .catch(() => false)
}

export async function fetchPrinterConfig(types: string[]): Promise<PrinterConfig | null> {
  const { data } = await supabase.from('settings').select('value').eq('id', 'printers').single()

  if (!data?.value) return null

  const printers: PrinterConfig[] = Array.isArray(data.value) ? data.value : JSON.parse(data.value)
  const match = printers.find((p) => types.some((t) => p.types.includes(t as any)))
  return match || printers[0] || null
}

export async function fetchAllPrinters(): Promise<PrinterConfig[]> {
  const { data } = await supabase.from('settings').select('value').eq('id', 'printers').single()

  if (!data?.value) return []

  return Array.isArray(data.value) ? data.value : JSON.parse(data.value)
}

function formatCurrency(amount: number): string {
  return `N${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function buildReceiptData(
  type: 'customer' | 'internal',
  order: Order,
  items: OrderItem[],
  staffName: string,
  tipAmount?: number,
  amountReceived?: number
): ReceiptData {
  const orderRef = `BSP-${String(order.id).slice(0, 8).toUpperCase()}`
  const date = new Date(order.created_at).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const time = new Date(order.created_at).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  const pmRaw = (order.payment_method ?? '').toLowerCase()
  const pmLabel = pmRaw.startsWith('transfer:')
    ? `TRANSFER - ${pmRaw.replace('transfer:', '').toUpperCase()}`
    : pmRaw === 'cash'
      ? 'CASH'
      : pmRaw === 'card'
        ? 'BANK POS'
        : pmRaw === 'credit'
          ? 'PAY LATER (DEBT)'
          : pmRaw.toUpperCase()

  const billableItems = items.filter(
    (i) => !(i as unknown as { return_accepted?: boolean }).return_accepted
  )

  // Group items by name
  const grouped = new Map<string, { qty: number; total: number; price: number }>()
  billableItems.forEach((item) => {
    const name =
      (item as unknown as { menu_items?: { name: string } }).menu_items?.name ||
      (item as unknown as { modifier_notes?: string }).modifier_notes ||
      'Item'
    const existing = grouped.get(name)
    const qty = item.quantity || 1
    const price = (item as unknown as { total_price?: number }).total_price || 0
    if (existing) {
      existing.qty += qty
      existing.total += price
    } else {
      grouped.set(name, {
        qty,
        total: price,
        price: (item as unknown as { unit_price?: number }).unit_price || 0,
      })
    }
  })

  const subtotal = billableItems.reduce(
    (sum, i) =>
      sum +
      ((i as unknown as { total_price?: number }).total_price || 0) +
      0,
    0
  )

  const total = subtotal

  const tipsAmount = tipAmount || 0
  const received = amountReceived || 0

  const header = [
    { label: 'Ref', value: orderRef },
    { label: 'Date', value: date },
    { label: 'Time', value: time },
    { label: 'Order', value: order.order_type === 'return' ? 'Return' : 'Counter' },
    { label: 'Served by', value: staffName || 'Staff' },
  ]

  if (type !== 'internal') {
    header.push({ label: 'Payment', value: pmLabel })
  }

  const itemsList = Array.from(grouped.entries()).map(([name, g]) => ({
    name,
    qty: g.qty,
    price: formatCurrency(g.price),
    total: formatCurrency(g.total),
  }))

  const totals: ReceiptData['totals'] = [
    { label: 'TOTAL', value: formatCurrency(total), bold: true, double: true },
  ]

  if (tipsAmount > 0) {
    totals.unshift({ label: 'Tip', value: formatCurrency(tipsAmount) })
    totals.unshift({
      label: 'Amt Received',
      value: formatCurrency(received > 0 ? received : total + tipsAmount),
    })
  }

  const footer =
    type === 'customer'
      ? ['** PAYMENT CONFIRMED **', '', 'Thank you for visiting!', 'Please come again']
      : type === 'internal'
        ? ['-- INTERNAL COPY --', '', 'Thank you']
        : ['Thank you']

  return {
    title: 'C.Biz POS',
    subtitle: '',
    header,
    items: itemsList,
    totals,
    footer,
  }
}

export async function queuePrintJob(
  order: Order,
  type: 'customer' | 'internal',
  items: OrderItem[],
  staffName: string,
  tipAmount?: number,
  amountReceived?: number
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  const orderRef = `BSP-${String(order.id).slice(0, 8).toUpperCase()}`

  const printer = await fetchPrinterConfig(
    type === 'customer' || type === 'internal' ? ['customer', 'internal'] : [type]
  )

  const receipt = buildReceiptData(type, order, items, staffName, tipAmount, amountReceived)

  // First, try the local print service directly (fast path)
  if (printer) {
    try {
      const printRes = await fetch(`${PRINT_SERVICE_URL}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerIp: printer.ip,
          printerPort: printer.port,
          receipt,
          copies: printer.copies || 1,
          jobId: `${orderRef}-${type}`,
        }),
        signal: AbortSignal.timeout(15000),
      })

      const result = await printRes.json()

      if (result.success) {
        await supabase.from('print_jobs').insert({
          order_id: order.id,
          receipt_number: orderRef,
          type,
          status: 'printed',
          copies: printer.copies || 1,
          printer_ip: printer.ip,
          receipt_data: receipt as any,
          printed_at: new Date().toISOString(),
        })

        return { success: true, jobId: `${orderRef}-${type}` }
      }

      // Failed — queue with retry schedule
      await supabase.from('print_jobs').insert({
        order_id: order.id,
        receipt_number: orderRef,
        type,
        status: 'failed',
        copies: printer.copies || 1,
        printer_ip: printer.ip,
        receipt_data: receipt as any,
        error_message: result.error || 'Print failed',
        retry_count: 0,
        max_retries: 5,
        next_retry_at: new Date(Date.now() + 5000).toISOString(),
      })

      return { success: false, jobId: `${orderRef}-${type}`, error: result.error }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Print service unreachable'

      await supabase.from('print_jobs').insert({
        order_id: order.id,
        receipt_number: orderRef,
        type,
        status: 'failed',
        copies: printer.copies || 1,
        printer_ip: printer.ip,
        receipt_data: receipt as any,
        error_message: msg,
        retry_count: 0,
        max_retries: 5,
        next_retry_at: new Date(Date.now() + 5000).toISOString(),
      })

      return { success: false, jobId: `${orderRef}-${type}`, error: msg }
    }
  }

  // No printer configured — queue as pending
  await supabase.from('print_jobs').insert({
    order_id: order.id,
    receipt_number: orderRef,
    type,
    status: 'pending',
    copies: 1,
    receipt_data: receipt as any,
  })

  return { success: false, jobId: `${orderRef}-${type}`, error: 'No printer configured' }
}

export async function reprintJob(jobId: string): Promise<{ success: boolean; error?: string }> {
  const { data: job } = await supabase.from('print_jobs').select('*').eq('id', jobId).single()

  if (!job) return { success: false, error: 'Print job not found' }

  const printer = await fetchPrinterConfig(
    job.type === 'customer' || job.type === 'internal' ? ['customer', 'internal'] : [job.type]
  )

  if (!printer) return { success: false, error: 'No printer configured for this job type' }

  try {
    const res = await fetch(`${PRINT_SERVICE_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printerIp: printer.ip,
        printerPort: printer.port,
        receipt: job.receipt_data,
        copies: job.copies || 1,
        jobId: `reprint-${job.id}`,
      }),
      signal: AbortSignal.timeout(15000),
    })

    const result = await res.json()

    await supabase
      .from('print_jobs')
      .update({
        status: result.success ? 'printed' : 'failed',
        error_message: result.success ? null : result.error || 'Reprint failed',
        printed_at: result.success ? new Date().toISOString() : null,
        retry_count: job.retry_count + (result.success ? 0 : 1),
        next_retry_at: result.success ? null : new Date(Date.now() + 5000).toISOString(),
      })
      .eq('id', jobId)

    return { success: result.success, error: result.error }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Print service unreachable'
    return { success: false, error: msg }
  }
}

export async function retryFailedJobs(): Promise<number> {
  const { data: failedJobs } = await supabase
    .from('print_jobs')
    .select('*')
    .eq('status', 'failed')
    .lte('next_retry_at', new Date().toISOString())
    .lt('retry_count', 'max_retries')
    .limit(10)

  if (!failedJobs || failedJobs.length === 0) return 0

  let retried = 0
  for (const job of failedJobs) {
    const result = await reprintJob(job.id)
    if (result.success) retried++
  }

  return retried
}
