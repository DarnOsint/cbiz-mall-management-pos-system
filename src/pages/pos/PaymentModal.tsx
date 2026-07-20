import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { audit } from '../../lib/audit'
import { formatPrice } from '../../lib/currency'
import { useAuth } from '../../context/AuthContext'
import {
  X,
  Banknote,
  CreditCard,
  Smartphone,
  CheckCircle,
  Clock,
  Printer,
} from 'lucide-react'
import ReceiptModal from './ReceiptModal'
import { queuePrintJob } from '../../lib/printService'
import type { Profile } from '../../types'
import { useToast } from '../../context/ToastContext'

interface OrderItemExtended {
  id: string
  order_id?: string
  item_id?: string
  quantity: number
  unit_price?: number
  total_price: number
  status?: string
  modifier_notes?: string | null
  created_at?: string
  items?: { name: string; price: number } | null
}
interface OrderExtended {
  id: string
  total_amount: number
  payment_method?: string | null
  status: string
  order_type: string
  created_at: string
  closed_at?: string | null
  notes?: string | null
  order_items?: OrderItemExtended[]
  customer_name?: string
  customer_phone?: string
  profiles?: { full_name: string } | null
}
interface SplitPayment {
  person: number
  total: number
  method: string
  items: string[]
  change: number
}
interface Props {
  order: OrderExtended
  onSuccess: () => void
  onClose: () => void
}

export default function PaymentModal({ order: orderProp, onSuccess, onClose }: Props) {
  const [order, setOrder] = useState(orderProp)
  // Sync when parent refreshes the order (realtime DB update)
  useEffect(() => {
    setOrder(orderProp)
  }, [orderProp])
  const { profile } = useAuth()
  const toast = useToast()

  const refreshOrder = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, items(name, price))')
      .eq('id', order.id)
      .single()
    if (data) {
      setOrder(data as unknown as OrderExtended)
    }
  }

  useEffect(() => {
    if (!order.id) return

    const channel = supabase
      .channel(`payment-modal-order-${order.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items', filter: `order_id=eq.${order.id}` },
        () => {
          void refreshOrder()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'returns_log', filter: `order_id=eq.${order.id}` },
        () => {
          void refreshOrder()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        () => {
          void refreshOrder()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [order.id])
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [cashTendered, setCashTendered] = useState('')
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [paidOrder, setPaidOrder] = useState<OrderExtended | null>(null)
  const [debtorName, setDebtorName] = useState(order?.customer_name || '')
  const [debtorPhone, setDebtorPhone] = useState(order?.customer_phone || '')
  const [dueDate, setDueDate] = useState('')
  const [splitMode, setSplitMode] = useState(false)
  const [numPeople, setNumPeople] = useState(2)
  const [itemAssignments, setItemAssignments] = useState<Record<string, number>>({})
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([])
  const [currentSplitPerson, setCurrentSplitPerson] = useState(0)

  const [splitPayMethod, setSplitPayMethod] = useState('cash')
  const [splitCash, setSplitCash] = useState('')
  const [bankAccounts, setBankAccounts] = useState<
    { id: string; bank_name: string; account_number: string; account_name: string }[]
  >([])
  const [selectedBankId, setSelectedBankId] = useState<string>('')
  const [tipAmount, setTipAmount] = useState('')
  const [amountReceived, setAmountReceived] = useState('')
  const [cashSplit, setCashSplit] = useState('')
  const [secondarySplit, setSecondarySplit] = useState('')
  useState(() => {
    supabase
      .from('bank_accounts')
      .select('id, bank_name, account_number, account_name')
      .eq('is_active', true)
      .order('created_at')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setBankAccounts(data)
          setSelectedBankId(data[0].id)
        }
      })
  })

  const billableItems = (order?.order_items || [])
  const activeItemsTotal = billableItems.reduce((sum, i) => sum + (i.total_price || 0), 0)
  const subtotal = activeItemsTotal
  const total = subtotal
  const change = paymentMethod === 'cash' && cashTendered ? parseFloat(cashTendered) - total : 0

  useEffect(() => {
    if (paymentMethod === 'cash' && total > 0 && !cashTendered) {
      setCashTendered(String(total))
    }
  }, [paymentMethod, total])

  const canProcess = () => {
    if (processing) return false
    if (paymentMethod === 'cash') return parseFloat(cashTendered) >= total
    if (paymentMethod === 'cash+transfer' || paymentMethod === 'cash+card') {
      const c = parseFloat(cashSplit || '0')
      const s = parseFloat(secondarySplit || '0')
      return c + s >= total && c >= 0 && s >= 0
    }
    if (paymentMethod === 'credit') return debtorName.trim().length > 0
    return true
  }

  const printPreReceipt = async () => {
    const orderRef = `BSP-${String(order.id).slice(0, 8).toUpperCase()}`

    const result = await queuePrintJob(
      order as unknown as import('../../types').Order,
      'customer',
      billableItems as unknown as import('../../types').OrderItem[],
      profile?.full_name || 'Staff'
    )

    if (result.success) {
      toast.success('Printed', 'Pre-payment receipt sent to printer')
    } else {
      toast.warning('Print Failed', result.error || 'Could not reach print service. Try again.')
    }
  }

  const orderItems = billableItems
  const getPersonItems = (idx: number) =>
    orderItems.filter((item) => itemAssignments[item.id] === idx)
  const getPersonTotal = (idx: number) =>
    getPersonItems(idx).reduce((s, i) => s + (i.total_price || 0), 0)
  const unassignedItems = orderItems.filter((item) => itemAssignments[item.id] === undefined)
  const allAssigned = unassignedItems.length === 0

  const processSplitPayment = async () => {
    const personTotal = getPersonTotal(currentSplitPerson)
    if (personTotal === 0) {
      toast.warning('No Items', 'No items assigned to this person')
      return
    }
    if (splitPayMethod === 'cash' && parseFloat(splitCash) < personTotal) {
      toast.warning('Insufficient Cash', 'Cash tendered is less than amount due')
      return
    }
    const newPayment: SplitPayment = {
      person: currentSplitPerson + 1,
      total: personTotal,
      method: splitPayMethod,
      items: getPersonItems(currentSplitPerson).map((i) => i.items?.name || i.modifier_notes || 'Item'),
      change: splitPayMethod === 'cash' ? parseFloat(splitCash) - personTotal : 0,
    }
    const updatedPayments = [...splitPayments, newPayment]
    setSplitPayments(updatedPayments)
    setSplitCash('')
    const paidPeople = updatedPayments.map((p) => p.person)
    const allPeople = Array.from({ length: numPeople }, (_, i) => i + 1)
    if (allPeople.every((p) => paidPeople.includes(p))) {
      const primaryMethod = updatedPayments[0].method
      await supabase
        .from('orders')
        .update({
          status: 'paid',
          payment_method: primaryMethod,
          closed_at: new Date().toISOString(),
          total_amount: total,
          notes:
            (order.notes || '') +
            ' [Split: ' +
            updatedPayments.map((p) => 'P' + p.person + '=' + p.method).join(', ') +
            ']',
        })
        .eq('id', order.id)
      await audit({
        action: 'ORDER_PAID',
        entity: 'order',
        entityId: order.id,
        entityName: 'Order #' + (order.id || '').slice(0, 8),
        newValue: {
          total: order.total_amount,
          payment_method: 'split',
          splits: updatedPayments.length,
        },
        performer: profile as Profile,
      })
      setPaidOrder({ ...order, payment_method: 'split' })
      setSuccess(true)
      setShowReceipt(true)
    } else {
      const nextPerson = allPeople.find((p) => !paidPeople.includes(p))!
      setCurrentSplitPerson(nextPerson - 1)
      setSplitPayMethod('cash')
    }
  }

  const processPayment = async () => {
    setProcessing(true)
    try {
      // Verify total against server-side order_items sum before processing
      const { data: serverItems } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', order.id)
      if (serverItems && serverItems.length > 0) {
        const serverTotal = serverItems
          .reduce((s: number, i: { total_price: number }) => s + (i.total_price || 0), 0)
        if (Math.abs(serverTotal - total) > 1) {
          await supabase.from('orders').update({ total_amount: serverTotal }).eq('id', order.id)
          setOrder({ ...order, total_amount: serverTotal })
        }
      }

      if (paymentMethod === 'credit') {
        const { error: creditOrderErr } = await supabase
          .from('orders')
          .update({
            status: 'paid',
            payment_method: 'credit',
            customer_name: debtorName,
            customer_phone: debtorPhone,
            closed_at: new Date().toISOString(),
          })
          .eq('id', order.id)
        if (creditOrderErr) throw creditOrderErr
        await supabase
          .from('order_items')
          .update({ status: 'completed' })
          .eq('order_id', order.id)
        // Deduplicate debtors — match by phone first, then name
        const { data: existingDebtors } = await (debtorPhone
          ? supabase
              .from('debtors')
              .select('id, current_balance')
              .eq('phone', debtorPhone)
              .eq('is_active', true)
              .limit(1)
          : supabase
              .from('debtors')
              .select('id, current_balance')
              .ilike('name', debtorName)
              .eq('is_active', true)
              .limit(1))
        // Always create a separate entry for each credit order — never lump
        await supabase.from('debtors').insert({
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          name: debtorName,
          phone: debtorPhone,
          debt_type: 'credit_order',
          order_id: order.id,
          credit_limit: total,
          current_balance: total,
          amount_paid: 0,
          status: 'outstanding',
          is_active: true,
          due_date: dueDate || null,
          notes: `Credit order — Counter — by ${profile?.full_name || 'Staff'}`,
          recorded_by: profile?.id,
          recorded_by_name: profile?.full_name,
        })
        await audit({
          action: 'ORDER_PAID',
          entity: 'order',
          entityId: order.id,
          entityName: 'Order #' + (order.id || '').slice(0, 8),
          newValue: { total: order.total_amount, payment_method: paymentMethod },
          performer: profile as Profile,
        })
        setPaidOrder({ ...order, payment_method: 'credit' })
        setSuccess(true)
        setShowReceipt(true)
        setProcessing(false)
        return
      }
      // Use direct Supabase calls for payment — offlineUpdate's .single() can silently
      // fail (PGRST116) causing realtime events to not fire on Management/Executive
      const { error: orderErr } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          payment_method:
            paymentMethod === 'transfer'
              ? `transfer:${bankAccounts.find((b) => b.id === selectedBankId)?.bank_name || 'Bank Transfer'}`
              : paymentMethod === 'cash+transfer'
                ? `cash+transfer:${parseFloat(cashSplit || '0')}+${parseFloat(secondarySplit || '0')}`
                : paymentMethod === 'cash+card'
                  ? `cash+card:${parseFloat(cashSplit || '0')}+${parseFloat(secondarySplit || '0')}`
                  : paymentMethod,
          closed_at: new Date().toISOString(),
        })
        .eq('id', order.id)
      if (orderErr) throw orderErr
      await audit({
        action: 'ORDER_PAID',
        entity: 'order',
        entityId: order.id,
        entityName: 'Order #' + (order.id || '').slice(0, 8),
        newValue: { total: order.total_amount, payment_method: paymentMethod },
        performer: profile as Profile,
      })
      // Record tip if entered
      const tipVal = parseFloat(tipAmount)
      if (tipVal > 0 && profile?.id) {
        await supabase.from('tips').insert({
          order_id: order.id,
          waitron_id: profile.id,
          waitron_name: profile.full_name,
          order_total: total,
          amount_received: parseFloat(amountReceived) || total + tipVal,
          tip_amount: tipVal,
          payment_method:
            paymentMethod === 'transfer'
              ? `transfer:${bankAccounts.find((b) => b.id === selectedBankId)?.bank_name || 'Bank Transfer'}`
              : paymentMethod === 'cash+transfer'
                ? `cash+transfer:${parseFloat(cashSplit || '0')}+${parseFloat(secondarySplit || '0')}`
                : paymentMethod === 'cash+card'
                  ? `cash+card:${parseFloat(cashSplit || '0')}+${parseFloat(secondarySplit || '0')}`
                  : paymentMethod,
          shift_date: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10), // WAT = UTC+1
          status: 'pending',
        })
      }
      setPaidOrder({ ...order, payment_method: paymentMethod } as typeof order)
      setSuccess(true)
      setShowReceipt(true)
    } catch (err) {
      const msg = (err as { message?: string })?.message || String(err)
      toast.error('Payment Failed', msg || 'Please try again.')
      console.error('Payment error:', err)
    } finally {
      setProcessing(false)
    }
  }

  const splitColors = [
    'bg-blue-500/20 border-blue-500/30 text-blue-300',
    'bg-purple-500/20 border-purple-500/30 text-purple-300',
    'bg-green-500/20 border-green-500/30 text-green-300',
    'bg-pink-500/20 border-pink-500/30 text-pink-300',
    'bg-amber-500/20 border-amber-500/30 text-amber-300',
  ]
  const paymentMethods = [
    { id: 'cash', label: 'Cash', icon: Banknote, color: 'text-green-400' },
    { id: 'credit', label: 'Pay Later (Debt)', icon: Clock, color: 'text-red-400' },
  ]

  if (splitMode && !success)
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-2">
        <div className="bg-gray-950 rounded-2xl w-full max-w-lg border border-gray-800 flex flex-col max-h-[95vh]">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div>
              <h3 className="text-white font-bold">Split Bill</h3>
              <p className="text-gray-400 text-xs">Total: {formatPrice(total)}</p>
            </div>
            <button onClick={() => setSplitMode(false)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <div className="p-4 border-b border-gray-800">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Number of people</p>
            <div className="flex gap-2">
              {[2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setNumPeople(n)
                    setItemAssignments({})
                    setSplitPayments([])
                    setCurrentSplitPerson(0)
                  }}
                  className={`w-10 h-10 rounded-xl font-bold text-sm transition-colors ${numPeople === n ? 'bg-amber-500 text-black' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">
              Assign items to each person
            </p>
            {unassignedItems.length > 0 && (
              <p className="text-amber-400 text-xs mb-3">
                {unassignedItems.length} unassigned item(s)
              </p>
            )}
            <div className="space-y-2">
              {orderItems.map((item) => (
                <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-white text-sm font-medium">
                        {item.items?.name ||
                          item.modifier_notes ||
                          'Item'}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {formatPrice(item.total_price || 0)}
                      </p>
                    </div>
                    {itemAssignments[item.id] !== undefined && (
                      <span
                        className={`text-xs px-2 py-1 rounded-lg border ${splitColors[itemAssignments[item.id] % splitColors.length]}`}
                      >
                        Person {itemAssignments[item.id] + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: numPeople }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setItemAssignments((prev) => ({ ...prev, [item.id]: i }))}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${itemAssignments[item.id] === i ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                      >
                        P{i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {allAssigned && (
              <div className="mt-4 space-y-2">
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Summary</p>
                {Array.from({ length: numPeople }, (_, i) => {
                  const paid = splitPayments.find((p) => p.person === i + 1)
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded-xl p-3 border ${paid ? 'bg-green-500/10 border-green-500/20' : currentSplitPerson === i ? 'bg-amber-500/10 border-amber-500/30' : 'bg-gray-900 border-gray-800'}`}
                    >
                      <span className="text-white text-sm font-medium">Person {i + 1}</span>
                      <div className="text-right">
                        <p className="text-white font-bold">{formatPrice(getPersonTotal(i))}</p>
                        {paid && <p className="text-green-400 text-xs">Paid · {paid.method}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {allAssigned && splitPayments.length < numPeople && (
              <div className="mt-4 bg-gray-900 border border-amber-500/30 rounded-xl p-4 space-y-3">
                <p className="text-amber-400 text-sm font-bold">
                  Collecting from Person {currentSplitPerson + 1} —{' '}
                  {formatPrice(getPersonTotal(currentSplitPerson))}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods
                    .filter((m) => m.id !== 'credit')
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSplitPayMethod(m.id)}
                        className={`py-2 rounded-xl text-sm font-medium border transition-colors ${splitPayMethod === m.id ? 'bg-amber-500 text-black border-amber-500' : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-amber-500/50'}`}
                      >
                        {m.label}
                      </button>
                    ))}
                </div>
                {splitPayMethod === 'cash' && (
                  <input
                    type="number"
                    value={splitCash}
                    onChange={(e) => setSplitCash(e.target.value)}
                    placeholder="Cash tendered"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                  />
                )}
                <button
                  onClick={processSplitPayment}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl py-3"
                >
                  Confirm Payment
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )

  if (success && !showReceipt)
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
        <div className="bg-gray-900 rounded-2xl p-8 text-center max-w-sm w-full border border-gray-800">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <h3 className="text-white text-xl font-bold mb-1">Payment Successful!</h3>
          <p className="text-gray-400 text-sm mb-1">Order complete</p>
          <p className="text-gray-500 text-xs capitalize">
            {paymentMethod === 'credit'
              ? 'Recorded as debt'
              : `Paid via ${paymentMethod === 'card' ? 'Bank POS' : paymentMethod === 'transfer' ? 'Bank Transfer' : 'Cash'}`}
          </p>
          {paymentMethod === 'cash' && change > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mt-4">
              <p className="text-amber-400 text-xs mb-1">Change to return</p>
              <p className="text-white text-xl font-bold break-all break-all">
                {formatPrice(change)}
              </p>
            </div>
          )}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowReceipt(true)}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl py-3 text-sm"
            >
              🧾 Print Receipt
            </button>
            <button
              onClick={onSuccess}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl py-3 text-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )

  if (showReceipt && paidOrder)
    return (
      <ReceiptModal
        order={paidOrder as unknown as import('../../types').Order}
        items={billableItems as import('../../types').OrderItem[]}
        staffName={profile?.full_name || 'Staff'}
        tipAmount={parseFloat(tipAmount) || 0}
        amountReceived={parseFloat(amountReceived) || 0}
        onClose={() => {
          setShowReceipt(false)
          onSuccess()
        }}
      />
    )

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-800 overflow-y-auto max-h-[90vh]">
        <div className="flex flex-col gap-3 p-5 border-b border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-white font-bold text-lg">Process Payment</h3>
            <p className="text-gray-400 text-sm">Order #{(order.id || '').slice(0, 8).toUpperCase()}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={printPreReceipt}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium px-3 py-2 rounded-xl border border-gray-700 transition-colors shrink-0"
              title="Print receipt for customer to review before payment"
            >
              <Printer size={13} /> Print
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white shrink-0">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-3 uppercase tracking-wide">Order Summary</p>
            <div className="space-y-2 mb-3">
              {billableItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-300">
                    {item.quantity}x {item.items?.name || item.modifier_notes || 'Item'}
                  </span>
                  <span className="text-gray-400">{formatPrice(item.total_price || 0)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
              <span className="text-white font-bold">Total</span>
              <span className="text-amber-400 font-bold text-xl break-all">
                {formatPrice(total)}
              </span>
            </div>
          </div>

          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">Payment Method</p>
            <div className="grid grid-cols-4 gap-2">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${paymentMethod === method.id ? 'bg-gray-800 border-amber-500' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
                >
                  <method.icon
                    size={22}
                    className={paymentMethod === method.id ? method.color : 'text-gray-500'}
                  />
                  <span
                    className={`text-xs font-medium text-center leading-tight ${paymentMethod === method.id ? 'text-white' : 'text-gray-500'}`}
                  >
                    {method.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === 'cash' && (
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                  Amount Tendered (SSP)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-2xl font-bold focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[2000, 5000, 10000, 20000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setCashTendered(amount.toString())}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs rounded-lg py-2 transition-colors"
                  >
                    {formatPrice(amount)}
                  </button>
                ))}
              </div>
              {cashTendered && parseFloat(cashTendered) >= total && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                  <p className="text-green-400 text-xs">Change to return</p>
                  <p className="text-white text-xl font-bold break-all">{formatPrice(change)}</p>
                </div>
              )}
              {cashTendered && parseFloat(cashTendered) < total && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-red-400 text-xs">Short by</p>
                  <p className="text-white text-xl font-bold break-all">
                    {formatPrice(total - parseFloat(cashTendered))}
                  </p>
                </div>
              )}
            </div>
          )}
          {(paymentMethod === 'cash+transfer' || paymentMethod === 'cash+card') && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                    Cash Received (SSP)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={cashSplit}
                    onChange={(e) => setCashSplit(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                    {paymentMethod === 'cash+transfer'
                      ? 'Transfer Received (SSP)'
                      : 'POS Received (SSP)'}
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={secondarySplit}
                    onChange={(e) => setSecondarySplit(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm text-gray-300">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="text-white font-bold">{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Entered</span>
                  <span className="text-amber-400 font-bold">
                    {formatPrice(parseFloat(cashSplit || '0') + parseFloat(secondarySplit || '0'))}
                  </span>
                </div>
                {parseFloat(cashSplit || '0') + parseFloat(secondarySplit || '0') < total && (
                  <p className="text-red-400 text-xs mt-2">
                    Short — enter full amount before confirming.
                  </p>
                )}
              </div>
            </div>
          )}
          {paymentMethod === 'card' && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
              <CreditCard size={28} className="text-blue-400 mx-auto mb-2" />
              <p className="text-blue-400 font-medium">Bank POS</p>
              <p className="text-gray-400 text-sm mt-1">
                Process {formatPrice(total)} on the POS terminal, then confirm below.
              </p>
            </div>
          )}
          {paymentMethod === 'transfer' &&
            (() => {
              const selectedBank = bankAccounts.find((b) => b.id === selectedBankId)
              return (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Smartphone size={20} className="text-amber-400" />
                    <p className="text-amber-400 font-medium">Bank Transfer</p>
                  </div>
                  {bankAccounts.length > 1 && (
                    <div className="mb-3">
                      <p className="text-gray-400 text-xs mb-2">Select bank account:</p>
                      <div className="space-y-2">
                        {bankAccounts.map((bank) => (
                          <button
                            key={bank.id}
                            onClick={() => setSelectedBankId(bank.id)}
                            className={`w-full text-left rounded-xl p-2.5 border transition-colors ${selectedBankId === bank.id ? 'bg-amber-500/20 border-amber-500/50' : 'bg-gray-800 border-gray-700 hover:border-amber-500/30'}`}
                          >
                            <p
                              className={`text-sm font-semibold ${selectedBankId === bank.id ? 'text-amber-400' : 'text-white'}`}
                            >
                              {bank.bank_name}
                            </p>
                            <p className="text-gray-400 text-xs">{bank.account_number}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedBank && (
                    <div className="bg-gray-800 rounded-xl p-3 space-y-1">
                      <p className="text-gray-400 text-xs">Transfer {formatPrice(total)} to:</p>
                      <p className="text-white font-bold text-sm">{selectedBank.bank_name}</p>
                      <p className="text-amber-400 font-mono font-bold">
                        {selectedBank.account_number}
                      </p>
                      <p className="text-gray-300 text-sm">{selectedBank.account_name}</p>
                      <p className="text-gray-500 text-xs pt-1">
                        Confirm transfer before proceeding.
                      </p>
                    </div>
                  )}
                  {bankAccounts.length === 0 && (
                    <p className="text-gray-400 text-sm text-center">
                      No bank accounts configured. Ask the owner to add bank accounts in the
                      Executive dashboard.
                    </p>
                  )}
                </div>
              )
            })()}
          {paymentMethod === 'credit' && (
            <div className="space-y-3">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                <Clock size={28} className="text-red-400 mx-auto mb-2" />
                <p className="text-red-400 font-medium">Pay Later</p>
                <p className="text-gray-400 text-sm mt-1">
                  Order will be recorded as a debt. Enter customer details below.
                </p>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                  Customer Name *
                </label>
                <input
                  value={debtorName}
                  onChange={(e) => setDebtorName(e.target.value)}
                  placeholder="Full name"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                  Phone
                </label>
                <input
                  value={debtorPhone}
                  onChange={(e) => setDebtorPhone(e.target.value)}
                  placeholder="08xxxxxxxxx"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                  Due Date (optional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          )}

          {/* Tip section — only for non-credit payments */}
          {paymentMethod !== 'credit' && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-green-400 text-sm font-semibold">💚 Tip Recording</p>
                <p className="text-gray-500 text-xs">Optional — enter if customer tipped</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Amount Received (SSP)</label>
                  <input
                    type="number"
                    placeholder={total.toFixed(0)}
                    value={amountReceived}
                    onChange={(e) => {
                      setAmountReceived(e.target.value)
                      const received = parseFloat(e.target.value)
                      if (!isNaN(received) && received > total) {
                        setTipAmount((received - total).toFixed(0))
                      } else {
                        setTipAmount('')
                      }
                    }}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Tip Amount (SSP)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    className="w-full bg-gray-800 border border-green-500/40 text-green-400 font-bold rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>
              {parseFloat(tipAmount) > 0 && (
                <div className="flex items-center justify-between bg-green-500/10 rounded-lg px-3 py-2">
                  <p className="text-green-400 text-xs">Tip will be recorded against your name</p>
                  <p className="text-green-400 font-bold">
                    {formatPrice(parseFloat(tipAmount) || 0)}
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={processPayment}
            disabled={!canProcess()}
            className={`w-full ${paymentMethod === 'credit' ? 'bg-red-500 hover:bg-red-400' : 'bg-amber-500 hover:bg-amber-400'} disabled:bg-gray-800 disabled:text-gray-600 text-black font-bold rounded-xl py-4 text-lg transition-colors`}
          >
            {processing
              ? 'Processing...'
              : paymentMethod === 'credit'
                  ? `Record ${formatPrice(total)} as Debt`
                  : `Confirm ${formatPrice(total)} Payment`}
          </button>
        </div>
      </div>
    </div>
  )
}
