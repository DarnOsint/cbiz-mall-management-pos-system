import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatPrice } from '../../../lib/currency'
import { Printer, Search, ChevronDown, Wallet, Clock, User, Banknote } from 'lucide-react'
import type { TillSession, CashMovement } from '../../../types'

interface ShiftTotals {
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

interface OrderInfo {
  id: string
  created_at: string
  total_amount: number
  payment_method: string | null
  customer_name: string | null
  staff_id: string | null
  status: string
}

export default function ShiftReport() {
  const [shifts, setShifts] = useState<TillSession[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null)
  const [shift, setShift] = useState<TillSession | null>(null)
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [orders, setOrders] = useState<OrderInfo[]>([])
  const [totals, setTotals] = useState<ShiftTotals | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSelector, setShowSelector] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadShifts()
  }, [])

  useEffect(() => {
    if (selectedShiftId) loadShiftData(selectedShiftId)
  }, [selectedShiftId])

  const loadShifts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('till_sessions')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(50)
    if (data) {
      setShifts(data as TillSession[])
      if (data.length > 0) {
        setSelectedShiftId(data[0].id)
      }
    }
    setLoading(false)
  }

  const loadShiftData = async (id: string) => {
    const { data: sData } = await supabase
      .from('till_sessions')
      .select('*')
      .eq('id', id)
      .single()
    if (sData) setShift(sData as TillSession)

    const { data: mData } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('shift_id', id)
      .order('created_at', { ascending: true })
    const cm = (mData || []) as CashMovement[]
    setMovements(cm)

    const orderIds = cm.filter(m => m.type === 'sale' && m.reference_id).map(m => m.reference_id!)
    const { data: oData } = orderIds.length > 0
      ? await supabase.from('orders').select('id, created_at, total_amount, payment_method, customer_name, staff_id, status').in('id', orderIds).order('created_at', { ascending: true })
      : { data: [] }
    const ords = (oData || []) as OrderInfo[]
    setOrders(ords)

    let cash_sales = 0, card_sales = 0, mobile_sales = 0, credit_sales = 0
    let refunds = 0, expenses = 0, cash_in = 0, cash_out = 0

    for (const order of ords) {
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
      if (m.type === 'refund') refunds += m.amount
      else if (m.type === 'expense') expenses += m.amount
      else if (m.type === 'cash_in') cash_in += m.amount
      else if (m.type === 'cash_out') cash_out += m.amount
    }

    if (sData) cash_in -= (sData as TillSession).opening_cash

    const expected = sData ? (sData as TillSession).opening_cash + cash_sales - refunds - expenses + cash_in - cash_out : 0

    setTotals({ cash_sales, card_sales, mobile_sales, credit_sales, refunds, expenses, cash_in, cash_out, expected_cash: expected })
  }

  const selectedShift = shifts.find(s => s.id === selectedShiftId)
  const totalSales = totals ? totals.cash_sales + totals.card_sales + totals.mobile_sales + totals.credit_sales : 0

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div ref={printRef}>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <div className="relative">
          <button
            onClick={() => setShowSelector(!showSelector)}
            className="flex items-center gap-2 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm hover:border-amber-500/50 transition-colors"
          >
            <Wallet size={15} className="text-amber-400" />
            <span>{selectedShift ? `Shift — ${new Date(selectedShift.opened_at).toLocaleDateString()}` : 'Select Shift'}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          {showSelector && (
            <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden max-h-60 overflow-y-auto z-50 shadow-xl w-72">
              {shifts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedShiftId(s.id); setShowSelector(false) }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-700 transition-colors flex items-center justify-between ${s.id === selectedShiftId ? 'bg-amber-500/10 text-amber-400' : 'text-white'}`}
                >
                  <div>
                    <p className="font-medium">{new Date(s.opened_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    <p className="text-gray-500 text-xs">{s.status === 'closed' ? 'Closed' : 'Open'} · {formatPrice(s.opening_cash)} float</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.status === 'closed' ? 'bg-gray-700 text-gray-400' : 'bg-green-500/20 text-green-400'}`}>
                    {s.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          <Printer size={15} />
          Print Report
        </button>
      </div>

      {!shift ? (
        <div className="text-center py-16 text-gray-500">No shifts found</div>
      ) : (
        <div className="max-w-2xl">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-4">
            <div className="text-center mb-6">
              <h2 className="text-white text-lg font-bold">Z-Report / End of Shift</h2>
              <p className="text-gray-400 text-xs">{new Date(shift.opened_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-gray-500 text-xs mb-1">Opened At</p>
                <p className="text-white text-sm font-medium">{new Date(shift.opened_at).toLocaleString('en-GB')}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-gray-500 text-xs mb-1">Closed At</p>
                <p className="text-white text-sm font-medium">{shift.closed_at ? new Date(shift.closed_at).toLocaleString('en-GB') : '—'}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-gray-500 text-xs mb-1">Opened By</p>
                <p className="text-white text-sm font-medium">{shift.opened_by ? shift.opened_by.slice(0, 8) : '—'}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-gray-500 text-xs mb-1">Closed By</p>
                <p className="text-white text-sm font-medium">{shift.closed_by ? shift.closed_by.slice(0, 8) : '—'}</p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 mb-6">
              <h3 className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-3">Cash Reconciliation</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Opening Float</span>
                  <span className="text-white font-medium">{formatPrice(shift.opening_cash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cash Sales</span>
                  <span className="text-white font-medium">{formatPrice(totals?.cash_sales || 0)}</span>
                </div>
                {totals && totals.cash_in > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Additional Cash In</span>
                    <span>{formatPrice(totals.cash_in)}</span>
                  </div>
                )}
                {totals && totals.refunds > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Refunds (paid out)</span>
                    <span>-{formatPrice(totals.refunds)}</span>
                  </div>
                )}
                {totals && totals.expenses > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Expenses</span>
                    <span>-{formatPrice(totals.expenses)}</span>
                  </div>
                )}
                {totals && totals.cash_out > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Cash Out</span>
                    <span>-{formatPrice(totals.cash_out)}</span>
                  </div>
                )}
                <div className="border-t border-gray-700 pt-2 flex justify-between font-bold">
                  <span className="text-white">Expected Cash in Drawer</span>
                  <span className="text-amber-400">{formatPrice(shift.expected_cash ?? totals?.expected_cash ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Actual Cash Counted</span>
                  <span className="text-white font-medium">{formatPrice(shift.closing_cash ?? 0)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-700 pt-2">
                  <span className="text-white font-bold">Variance</span>
                  <span className={`font-bold ${(shift.cash_variance ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(shift.cash_variance ?? 0) >= 0 ? '+' : ''}{formatPrice(shift.cash_variance ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 mb-6">
              <h3 className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-3">Sales by Payment Method</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Cash</span>
                  <span className="text-white">{formatPrice(totals?.cash_sales ?? shift.card_total ? 0 : 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Card (POS)</span>
                  <span className="text-white">{formatPrice(shift.card_total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Transfer / Mobile</span>
                  <span className="text-white">{formatPrice(shift.mobile_total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Credit</span>
                  <span className="text-white">{formatPrice(shift.credit_total)}</span>
                </div>
                <div className="border-t border-gray-700 pt-2 flex justify-between font-bold">
                  <span className="text-white">Total Sales</span>
                  <span className="text-amber-400">{formatPrice(shift.total_sales)}</span>
                </div>
              </div>
            </div>

            {movements.filter(m => m.type !== 'sale').length > 0 && (
              <div className="bg-gray-800 rounded-xl p-4 mb-6">
                <h3 className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-3">Cash Movement Log</h3>
                <div className="space-y-2">
                  {movements.filter(m => m.type !== 'sale').map((m) => (
                    <div key={m.id} className="flex items-center justify-between bg-gray-900 rounded-lg p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium capitalize">{m.type.replace('_', ' ')}</p>
                        <p className="text-gray-500 text-xs truncate">{m.description || ''}</p>
                      </div>
                      <span className={`text-sm font-bold ml-3 ${m.type === 'refund' || m.type === 'expense' || m.type === 'cash_out' ? 'text-red-400' : 'text-green-400'}`}>
                        {m.type === 'refund' || m.type === 'expense' || m.type === 'cash_out' ? '-' : '+'}{formatPrice(m.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {shift.notes && (
              <div className="bg-gray-800 rounded-xl p-4 mb-6">
                <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-2">Notes</p>
                <p className="text-white text-sm">{shift.notes}</p>
              </div>
            )}

            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-3">Transactions</h3>
              {orders.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">No transactions during this shift</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-700">
                        <th className="text-left py-2 pr-3">Ref</th>
                        <th className="text-left py-2 pr-3">Time</th>
                        <th className="text-left py-2 pr-3">Method</th>
                        <th className="text-left py-2 pr-3">Customer</th>
                        <th className="text-right py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => {
                        const pmLabel = o.payment_method?.startsWith('cash+card') ? 'Cash+Card'
                          : o.payment_method?.startsWith('cash+transfer') ? 'Cash+Transfer'
                          : o.payment_method?.startsWith('transfer') ? 'Transfer'
                          : o.payment_method === 'card' || o.payment_method === 'bank_pos' ? 'Card'
                          : o.payment_method?.charAt(0).toUpperCase() + o.payment_method?.slice(1) || '—'
                        return (
                          <tr key={o.id} className="border-b border-gray-800/50">
                            <td className="py-2 pr-3 text-white font-mono text-xs">#{o.id.slice(0, 8).toUpperCase()}</td>
                            <td className="py-2 pr-3 text-gray-400 text-xs">{new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="py-2 pr-3 text-gray-400 text-xs">{pmLabel}</td>
                            <td className="py-2 pr-3 text-gray-400 text-xs">{o.customer_name || '—'}</td>
                            <td className="py-2 text-right text-white font-medium">{formatPrice(o.total_amount)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold">
                        <td colSpan={4} className="py-2 text-right text-white">Total</td>
                        <td className="py-2 text-right text-amber-400">{formatPrice(orders.reduce((s, o) => s + o.total_amount, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body { background: #030712 !important; color: white !important; }
          .print\\:hidden { display: none !important; }
          @page { margin: 10mm; }
        }
      `}</style>
    </div>
  )
}
