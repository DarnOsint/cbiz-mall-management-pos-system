import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatPrice } from '../lib/currency'
import { X, Wallet, Square, Clock, Banknote, ReceiptText } from 'lucide-react'
import type { TillSession, CashMovement } from '../types'
import { useToast } from '../context/ToastContext'

interface ShiftTotals {
  total_sales: number
  cash_sales: number
  card_sales: number
  mobile_sales: number
  credit_sales: number
  refunds: number
  expenses: number
  cash_in: number
  cash_out: number
  expected_cash: number
}

interface Props {
  currentShift: TillSession | null
  onShiftChange: (shift: TillSession | null) => void
}

export default function ShiftManager({ currentShift, onShiftChange }: Props) {
  const { profile } = useAuth()
  const toast = useToast()

  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [openingCash, setOpeningCash] = useState('')
  const [opening, setOpening] = useState(false)

  const [closingCash, setClosingCash] = useState('')
  const [closeNotes, setCloseNotes] = useState('')
  const [closing, setClosing] = useState(false)
  const [shiftTotals, setShiftTotals] = useState<ShiftTotals | null>(null)
  const [hasOpenOrders, setHasOpenOrders] = useState(false)
  const [elapsed, setElapsed] = useState('')

  const closingInFlight = useRef(false)

  useEffect(() => {
    if (!currentShift) return
    const update = () => {
      const diff = Date.now() - new Date(currentShift.opened_at).getTime()
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setElapsed(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [currentShift])

  const handleOpenShift = async () => {
    if (!profile || !openingCash || parseFloat(openingCash) < 0) return
    setOpening(true)
    try {
      const amount = parseFloat(openingCash)
      const shiftId = crypto.randomUUID()
      const { error: shiftErr } = await supabase.from('till_sessions').insert({
        id: shiftId,
        opened_at: new Date().toISOString(),
        opened_by: profile.id,
        status: 'open',
        opening_cash: amount,
        card_total: 0,
        mobile_total: 0,
        credit_total: 0,
        total_sales: 0,
        total_refunds: 0,
        total_expenses: 0,
      })
      if (shiftErr) throw shiftErr

      await supabase.from('cash_movements').insert({
        id: crypto.randomUUID(),
        shift_id: shiftId,
        type: 'cash_in',
        amount: amount,
        description: 'Opening float',
        performed_by: profile.id,
        performed_by_name: profile.full_name,
        created_at: new Date().toISOString(),
      })

      const { data: newShift } = await supabase
        .from('till_sessions')
        .select('*')
        .eq('id', shiftId)
        .single()

      if (newShift) onShiftChange(newShift as TillSession)
      setShowOpenModal(false)
      setOpeningCash('')
      toast.success('Shift Opened', `Float: ${formatPrice(amount)}`)
    } catch (err) {
      toast.error('Error', 'Failed to open shift')
      console.error(err)
    } finally {
      setOpening(false)
    }
  }

  const loadCloseData = async () => {
    if (!currentShift || !profile) return

    const { data: movements } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('shift_id', currentShift.id)

    const cm = (movements || []) as CashMovement[]

    const orderIds = cm.filter(m => m.type === 'sale' && m.reference_id).map(m => m.reference_id!)

    const { data: ordersData } = orderIds.length > 0
      ? await supabase.from('orders').select('id, total_amount, payment_method').in('id', orderIds)
      : { data: [] }

    const orders = (ordersData || []) as { id: string; total_amount: number; payment_method: string | null }[]

    const pending = orders.filter(o => o.payment_method === null || o.payment_method === '' || ['open', 'pending'].includes((o as any).status || ''))
    setHasOpenOrders(pending.length > 0)

    let cash_sales = 0, card_sales = 0, mobile_sales = 0, credit_sales = 0
    let refunds_total = 0, expenses_total = 0, cash_in_total = 0, cash_out_total = 0

    for (const order of orders) {
      const pm = order.payment_method || ''
      if (pm === 'cash') {
        cash_sales += order.total_amount
      } else if (pm.startsWith('cash+card:')) {
        const parts = pm.split(':')[1]?.split('+') || []
        cash_sales += parseFloat(parts[0] || '0')
        card_sales += parseFloat(parts[1] || '0')
      } else if (pm.startsWith('cash+transfer:')) {
        const parts = pm.split(':')[1]?.split('+') || []
        cash_sales += parseFloat(parts[0] || '0')
        mobile_sales += parseFloat(parts[1] || '0')
      } else if (pm === 'card' || pm === 'bank_pos') {
        card_sales += order.total_amount
      } else if (pm.startsWith('transfer')) {
        mobile_sales += order.total_amount
      } else if (pm === 'credit') {
        credit_sales += order.total_amount
      }
    }

    for (const m of cm) {
      if (m.type === 'refund') refunds_total += m.amount
      else if (m.type === 'expense') expenses_total += m.amount
      else if (m.type === 'cash_in') cash_in_total += m.amount
      else if (m.type === 'cash_out') cash_out_total += m.amount
    }

    cash_in_total -= currentShift.opening_cash

    const total_sales = cash_sales + card_sales + mobile_sales + credit_sales
    const expected_cash = currentShift.opening_cash + cash_sales - refunds_total - expenses_total + cash_in_total - cash_out_total

    setShiftTotals({
      total_sales,
      cash_sales,
      card_sales,
      mobile_sales,
      credit_sales,
      refunds: refunds_total,
      expenses: expenses_total,
      cash_in: cash_in_total,
      cash_out: cash_out_total,
      expected_cash,
    })
  }

  const handleOpenClose = () => {
    setClosingCash('')
    setCloseNotes('')
    setShiftTotals(null)
    setHasOpenOrders(false)
    loadCloseData()
    setShowCloseModal(true)
  }

  const handleCloseShift = async () => {
    if (!currentShift || !profile || !shiftTotals || closingInFlight.current) return
    closingInFlight.current = true
    setClosing(true)
    try {
      const variance = parseFloat(closingCash || '0') - shiftTotals.expected_cash

      const { error } = await supabase
        .from('till_sessions')
        .update({
          closed_at: new Date().toISOString(),
          closed_by: profile.id,
          status: 'closed',
          closing_cash: parseFloat(closingCash || '0'),
          expected_cash: shiftTotals.expected_cash,
          cash_variance: variance,
          card_total: shiftTotals.card_sales,
          mobile_total: shiftTotals.mobile_sales,
          credit_total: shiftTotals.credit_sales,
          total_sales: shiftTotals.total_sales,
          total_refunds: shiftTotals.refunds,
          total_expenses: shiftTotals.expenses,
          notes: closeNotes.trim() || null,
        })
        .eq('id', currentShift.id)

      if (error) throw error

      onShiftChange(null)
      setShowCloseModal(false)
      toast.success('Shift Closed', `Variance: ${formatPrice(variance)}`)
    } catch (err) {
      toast.error('Error', 'Failed to close shift')
      console.error(err)
    } finally {
      setClosing(false)
      closingInFlight.current = false
    }
  }

  const totalSalesFromMovements = shiftTotals
    ? shiftTotals.cash_sales + shiftTotals.card_sales + shiftTotals.mobile_sales + shiftTotals.credit_sales
    : 0

  if (!currentShift) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
          <Wallet size={28} className="text-amber-400" />
        </div>
        <h2 className="text-white text-xl font-bold mb-2">No Active Shift</h2>
        <p className="text-gray-400 text-sm mb-6 text-center max-w-sm">
          Open a shift to start accepting payments and recording sales.
        </p>
        <button
          onClick={() => setShowOpenModal(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-3 rounded-xl transition-colors"
        >
          <Wallet size={18} />
          Open Shift
        </button>

        {showOpenModal && (
          <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl w-full max-w-sm border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-bold text-lg">Open Shift</h3>
                <button onClick={() => setShowOpenModal(false)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="mb-5">
                <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                  Opening Cash Float (SSP)
                </label>
                <input
                  type="number"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-amber-500"
                  autoFocus
                />
                <p className="text-gray-500 text-xs mt-2">
                  Enter the amount of cash in the till at the start of your shift.
                </p>
              </div>
              <button
                onClick={handleOpenShift}
                disabled={!openingCash || parseFloat(openingCash) < 0 || opening}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-xl py-3 transition-colors"
              >
                {opening ? 'Opening...' : `Open Shift with ${formatPrice(parseFloat(openingCash) || 0)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const saleMovementsTotal = 0

  return (
    <>
      <div className="bg-gray-900 border-b border-gray-800 px-3 py-1.5 shrink-0">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-gray-400">
              <Wallet size={13} className="text-amber-400" />
              <span className="text-white font-semibold">{formatPrice(currentShift.opening_cash)}</span>
            </span>
            <span className="w-px h-4 bg-gray-700" />
            <span className="flex items-center gap-1.5 text-gray-400">
              <ReceiptText size={13} className="text-amber-400" />
              <span className="text-white font-semibold">{formatPrice(currentShift.total_sales)}</span>
            </span>
            <span className="w-px h-4 bg-gray-700" />
            <span className="flex items-center gap-1.5 text-gray-400">
              <Clock size={13} className="text-amber-400" />
              <span className="text-white font-mono font-semibold">{elapsed}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-green-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
              Active
            </span>
            <button
              onClick={handleOpenClose}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
            >
              <Square size={11} />
              Close Shift
            </button>
          </div>
        </div>
      </div>

      {showCloseModal && shiftTotals && (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4">
          <div className="bg-gray-950 rounded-2xl w-full max-w-lg border border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-gray-950 z-10">
              <div>
                <h3 className="text-white font-bold text-lg">Close Shift</h3>
                <p className="text-gray-400 text-xs">End-of-shift reconciliation</p>
              </div>
              <button onClick={() => setShowCloseModal(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-2.5">
                <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold">Expected Cash Breakdown</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-300">
                    <span>Opening Float</span>
                    <span className="text-white font-medium">{formatPrice(currentShift.opening_cash)}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Cash Sales</span>
                    <span className="text-white font-medium">{formatPrice(shiftTotals.cash_sales)}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Cash In (other)</span>
                    <span className="text-white font-medium">{formatPrice(Math.max(0, shiftTotals.cash_in))}</span>
                  </div>
                  {shiftTotals.refunds > 0 && (
                    <div className="flex justify-between text-red-400">
                      <span>Refunds (paid out)</span>
                      <span>-{formatPrice(shiftTotals.refunds)}</span>
                    </div>
                  )}
                  {shiftTotals.expenses > 0 && (
                    <div className="flex justify-between text-red-400">
                      <span>Expenses</span>
                      <span>-{formatPrice(shiftTotals.expenses)}</span>
                    </div>
                  )}
                  {shiftTotals.cash_out > 0 && (
                    <div className="flex justify-between text-red-400">
                      <span>Cash Out (other)</span>
                      <span>-{formatPrice(shiftTotals.cash_out)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-700 pt-2 flex justify-between text-white font-bold">
                    <span>Expected Cash in Drawer</span>
                    <span className="text-amber-400">{formatPrice(shiftTotals.expected_cash)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-2">
                <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold">Sales by Payment Method</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-300">
                    <span>Cash</span>
                    <span className="text-white">{formatPrice(shiftTotals.cash_sales)}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Card (POS)</span>
                    <span className="text-white">{formatPrice(shiftTotals.card_sales)}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Transfer / Mobile</span>
                    <span className="text-white">{formatPrice(shiftTotals.mobile_sales)}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Credit</span>
                    <span className="text-white">{formatPrice(shiftTotals.credit_sales)}</span>
                  </div>
                  <div className="border-t border-gray-700 pt-2 flex justify-between text-white font-bold">
                    <span>Total Sales</span>
                    <span className="text-amber-400">{formatPrice(totalSalesFromMovements)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
                <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold">Cash Count</p>
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">Actual Cash in Drawer (SSP)</label>
                  <input
                    type="number"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-amber-500"
                    autoFocus
                  />
                </div>
                {closingCash && (
                  <div className={`rounded-xl p-3 border ${parseFloat(closingCash) >= shiftTotals.expected_cash ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <p className="text-gray-400 text-xs mb-1">Variance</p>
                    <p className={`text-lg font-bold ${parseFloat(closingCash) >= shiftTotals.expected_cash ? 'text-green-400' : 'text-red-400'}`}>
                      {parseFloat(closingCash) >= shiftTotals.expected_cash ? '+' : ''}{formatPrice(parseFloat(closingCash) - shiftTotals.expected_cash)}
                    </p>
                    {parseFloat(closingCash) !== shiftTotals.expected_cash && (
                      <p className="text-gray-500 text-xs mt-1">
                        {parseFloat(closingCash) > shiftTotals.expected_cash ? 'Over — check if any unrecorded items' : 'Short — check for unrecorded payouts'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">Notes (optional)</label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Any notes about this shift..."
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {hasOpenOrders && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-red-400 text-xs font-medium">
                    There are unpaid orders during this shift. Close them before closing the shift.
                  </p>
                </div>
              )}

              <button
                onClick={handleCloseShift}
                disabled={!closingCash || parseFloat(closingCash) < 0 || closing || hasOpenOrders}
                className="w-full bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl py-3 transition-colors"
              >
                {closing ? 'Closing...' : 'Confirm Close Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
