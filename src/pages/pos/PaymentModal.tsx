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
  Search,
  User,
  Star,
  Coins,
  Tag,
  Split,
  Plus,
  Trash2,
} from 'lucide-react'
import ReceiptModal from './ReceiptModal'
import { queuePrintJob } from '../../lib/printService'
import type { Profile, Discount, Customer } from '../../types'
import { useToast } from '../../context/ToastContext'

interface SaleItemExtended {
  id: string
  order_id?: string
  item_id?: string
  quantity: number
  unit_price?: number
  total_price: number
  status?: string
  modifier_notes?: string | null
  created_at?: string
  items?: { name: string; price: number; tax_rate_id?: string | null; tax_inclusive?: boolean; tax_rates?: { id: string; name: string; rate: number } | null } | null
}
interface SaleExtended {
  id: string
  total_amount: number
  payment_method?: string | null
  status: string
  order_type: string
  created_at: string
  closed_at?: string | null
  notes?: string | null
  order_items?: SaleItemExtended[]
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
  sale: SaleExtended
  onSuccess: () => void
  onClose: () => void
  shiftId?: string | null
}

export default function PaymentModal({ sale: saleProp, onSuccess, onClose, shiftId }: Props) {
  const [sale, setSale] = useState(saleProp)
  useEffect(() => {
    setSale(saleProp)
  }, [saleProp])
  const { profile } = useAuth()
  const toast = useToast()

  const refreshSale = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, items(name, price, tax_rate_id, tax_inclusive, tax_rates(id, name, rate)))')
      .eq('id', sale.id)
      .single()
    if (data) {
      setSale(data as unknown as SaleExtended)
    }
  }

  useEffect(() => {
    if (!sale.id) return

    const channel = supabase
      .channel(`payment-modal-sale-${sale.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items', filter: `order_id=eq.${sale.id}` },
        () => {
          void refreshSale()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'returns_log', filter: `order_id=eq.${sale.id}` },
        () => {
          void refreshSale()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${sale.id}` },
        () => {
          void refreshSale()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sale.id])
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [cashTendered, setCashTendered] = useState('')
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [paidSale, setPaidSale] = useState<SaleExtended | null>(null)
  const [debtorName, setDebtorName] = useState(sale?.customer_name || '')
  const [debtorPhone, setDebtorPhone] = useState(sale?.customer_phone || '')
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
  const [discountCode, setDiscountCode] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountError, setDiscountError] = useState('')
  const [applyingDiscount, setApplyingDiscount] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [mobilePhone, setMobilePhone] = useState('')
  const [redeemPoints, setRedeemPoints] = useState(false)
  const [redeemAmount, setRedeemAmount] = useState('')
  const [splitPaymentEnabled, setSplitPaymentEnabled] = useState(false)
  const [splitEntries, setSplitEntries] = useState<{ method: string; amount: string }[]>([
    { method: 'cash', amount: '' },
  ])
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

  useEffect(() => {
    if (!showCustomerSearch || !customerSearch.trim()) {
      setCustomerResults([])
      return
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`)
        .limit(10)
      setCustomerResults(data || [])
    }, 300)
    return () => clearTimeout(timeout)
  }, [customerSearch, showCustomerSearch])

  const billableItems = (sale?.order_items || [])
  const activeItemsTotal = billableItems.reduce((sum, i) => sum + (i.total_price || 0), 0)
  const computedTax = billableItems.reduce((sum, i) => {
    const tr = (i as any).items?.tax_rates
    if (!tr?.rate) return sum
    const inclusive = (i as any).items?.tax_inclusive !== false
    const tp = i.total_price || 0
    if (inclusive) {
      return sum + tp * (tr.rate / (100 + tr.rate))
    }
    const up = (i as any).unit_price || (i as any).items?.price || 0
    return sum + up * i.quantity * (tr.rate / 100)
  }, 0)
  const subtotal = activeItemsTotal
  const total = Math.max(0, subtotal - discountAmount)

  const pointsToEarn = Math.floor(total / 100)
  const maxRedeemable = selectedCustomer ? Math.min(
    selectedCustomer.loyalty_points || 0,
    Math.floor(total)
  ) : 0
  const redeemDiscount = redeemPoints && selectedCustomer && redeemAmount
    ? Math.min(parseInt(redeemAmount) || 0, maxRedeemable) / 100
    : 0
  const finalTotal = Math.max(0, total - redeemDiscount)

  const isMobileMethod = ['mtn_momo', 'zain_cash', 'airtel_money'].includes(paymentMethod)
  const change = paymentMethod === 'cash' && cashTendered ? parseFloat(cashTendered) - finalTotal : 0
  const splitSum = splitEntries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)

  useEffect(() => {
    if (paymentMethod === 'cash' && finalTotal > 0 && !cashTendered) {
      setCashTendered(String(finalTotal))
    }
  }, [paymentMethod, finalTotal])

  const applyDiscountCode = async () => {
    if (!discountCode.trim()) return
    setApplyingDiscount(true)
    setDiscountError('')
    try {
      const { data: disc, error } = await supabase
        .from('discounts')
        .select('*')
        .ilike('code', discountCode.trim())
        .eq('is_active', true)
        .single()
      if (error || !disc) {
        setDiscountError('Invalid promo code')
        setApplyingDiscount(false)
        return
      }
      const discount = disc as Discount
      if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
        setDiscountError('This promo code has expired')
        setApplyingDiscount(false)
        return
      }
      if (discount.starts_at && new Date(discount.starts_at) > new Date()) {
        setDiscountError('This promo code is not active yet')
        setApplyingDiscount(false)
        return
      }
      if (discount.usage_limit != null && discount.usage_count >= discount.usage_limit) {
        setDiscountError('This promo code has reached its usage limit')
        setApplyingDiscount(false)
        return
      }
      if (discount.min_order_amount != null && subtotal < discount.min_order_amount) {
        setDiscountError(`Minimum order amount is ${formatPrice(discount.min_order_amount)}`)
        setApplyingDiscount(false)
        return
      }
      let amount = 0
      if (discount.type === 'percentage') {
        amount = (subtotal * discount.value) / 100
        if (discount.max_discount_amount != null) {
          amount = Math.min(amount, discount.max_discount_amount)
        }
      } else {
        amount = Math.min(discount.value, subtotal)
      }
      amount = Math.round(amount * 100) / 100
      setAppliedDiscount(discount)
      setDiscountAmount(amount)
      setDiscountError('')
    } catch {
      setDiscountError('Failed to apply discount')
    } finally {
      setApplyingDiscount(false)
    }
  }

  const removeDiscount = () => {
    setAppliedDiscount(null)
    setDiscountAmount(0)
    setDiscountCode('')
    setDiscountError('')
  }

  const canProcess = () => {
    if (processing) return false
    if (paymentMethod === 'cash') return parseFloat(cashTendered) >= finalTotal
    if (paymentMethod === 'cash+transfer' || paymentMethod === 'cash+card') {
      const c = parseFloat(cashSplit || '0')
      const s = parseFloat(secondarySplit || '0')
      return c + s >= finalTotal && c >= 0 && s >= 0
    }
    if (paymentMethod === 'credit') return debtorName.trim().length > 0
    if (isMobileMethod) return mobilePhone.trim().length >= 8
    if (splitPaymentEnabled) return splitSum === finalTotal && splitEntries.length >= 2 && splitEntries.every(e => e.method && parseFloat(e.amount) > 0)
    return true
  }

  const printPreReceipt = async () => {
    const orderRef = `BSP-${String(sale.id).slice(0, 8).toUpperCase()}`

    const result = await queuePrintJob(
      sale as unknown as import('../../types').Sale,
      'customer',
      billableItems as unknown as import('../../types').SaleItem[],
      profile?.full_name || 'Staff'
    )

    if (result.success) {
      toast.success('Printed', 'Pre-payment receipt sent to printer')
    } else {
      toast.warning('Print Failed', result.error || 'Could not reach print service. Try again.')
    }
  }

  const saleItems = billableItems
  const getPersonItems = (idx: number) =>
    saleItems.filter((item) => itemAssignments[item.id] === idx)
  const getPersonTotal = (idx: number) =>
    getPersonItems(idx).reduce((s, i) => s + (i.total_price || 0), 0)
  const unassignedItems = saleItems.filter((item) => itemAssignments[item.id] === undefined)
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
            (sale.notes || '') +
            ' [Split: ' +
            updatedPayments.map((p) => 'P' + p.person + '=' + p.method).join(', ') +
            ']',
        })
        .eq('id', sale.id)
      if (shiftId) {
        await supabase.from('cash_movements').insert({
          id: crypto.randomUUID(),
          shift_id: shiftId,
          type: 'sale',
          amount: total,
          description: `Split payment — #${sale.id.slice(0, 8).toUpperCase()}`,
          reference_id: sale.id,
          performed_by: profile?.id || '',
          performed_by_name: profile?.full_name || 'Staff',
          created_at: new Date().toISOString(),
        })
      }
      await audit({
        action: 'ORDER_PAID',
        entity: 'order',
        entityId: sale.id,
        entityName: 'Sale #' + (sale.id || '').slice(0, 8),
        newValue: {
          total: sale.total_amount,
          payment_method: 'split',
          splits: updatedPayments.length,
        },
        performer: profile as Profile,
      })
      setPaidSale({ ...sale, payment_method: 'split', customer_name: selectedCustomer?.name || sale.customer_name || null })
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
      const { data: serverItems } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', sale.id)
      if (serverItems && serverItems.length > 0) {
        const serverTotal = serverItems
          .reduce((s: number, i: { total_price: number }) => s + (i.total_price || 0), 0)
        if (Math.abs(serverTotal - subtotal) > 1) {
          await supabase.from('orders').update({ total_amount: serverTotal }).eq('id', sale.id)
          setSale({ ...sale, total_amount: serverTotal })
        }
      }

      if (appliedDiscount && discountAmount > 0) {
        await supabase.from('order_discounts').insert({
          id: crypto.randomUUID(),
          order_id: sale.id,
          discount_id: appliedDiscount.id,
          discount_name: appliedDiscount.name,
          discount_type: appliedDiscount.type,
          discount_value: appliedDiscount.value,
          applied_amount: discountAmount,
          created_at: new Date().toISOString(),
        })
        await supabase
          .from('discounts')
          .update({ usage_count: appliedDiscount.usage_count + 1 })
          .eq('id', appliedDiscount.id)
      }

      if (paymentMethod === 'credit') {
        const { error: creditOrderErr } = await supabase
          .from('orders')
          .update({
            status: 'paid',
            payment_method: 'credit',
            total_amount: finalTotal,
            customer_name: debtorName,
            customer_phone: debtorPhone,
            closed_at: new Date().toISOString(),
          })
          .eq('id', sale.id)
        if (creditOrderErr) throw creditOrderErr
        await supabase
          .from('order_items')
          .update({ status: 'completed' })
          .eq('order_id', sale.id)
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
        await supabase.from('debtors').insert({
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          name: debtorName,
          phone: debtorPhone,
          debt_type: 'credit_order',
          order_id: sale.id,
          credit_limit: finalTotal,
          current_balance: finalTotal,
          amount_paid: 0,
          status: 'outstanding',
          is_active: true,
          due_date: dueDate || null,
          notes: `Credit order — Counter — by ${profile?.full_name || 'Staff'}`,
          recorded_by: profile?.id,
          recorded_by_name: profile?.full_name,
        })
        if (shiftId) {
          await supabase.from('cash_movements').insert({
            id: crypto.randomUUID(),
            shift_id: shiftId,
            type: 'sale',
            amount: finalTotal,
            description: `Credit: ${debtorName} — #${sale.id.slice(0, 8).toUpperCase()}`,
            reference_id: sale.id,
            performed_by: profile?.id || '',
            performed_by_name: profile?.full_name || 'Staff',
            created_at: new Date().toISOString(),
          })
        }
        await audit({
          action: 'ORDER_PAID',
          entity: 'order',
          entityId: sale.id,
          entityName: 'Sale #' + (sale.id || '').slice(0, 8),
          newValue: { total: sale.total_amount, payment_method: paymentMethod },
          performer: profile as Profile,
        })
        setPaidSale({ ...sale, payment_method: 'credit', customer_name: debtorName || sale.customer_name || null } as typeof sale)
        setSuccess(true)
        setShowReceipt(true)
        setProcessing(false)
        return
      }
      if (splitPaymentEnabled) {
        const splits = splitEntries.map(e => ({ method: e.method, amount: parseFloat(e.amount) }))
        await supabase
          .from('orders')
          .update({
            status: 'paid',
            payment_method: 'split',
            total_amount: finalTotal,
            closed_at: new Date().toISOString(),
            notes: JSON.stringify(splits),
            ...(selectedCustomer ? { customer_name: selectedCustomer.name, customer_phone: selectedCustomer.phone || null } : {}),
          })
          .eq('id', sale.id)
        if (shiftId) {
          const movements = splits.map(split => ({
            id: crypto.randomUUID(),
            shift_id: shiftId,
            type: 'sale',
            amount: split.amount,
            description: `Split: ${split.method} — #${sale.id.slice(0, 8).toUpperCase()}`,
            reference_id: sale.id,
            performed_by: profile?.id || '',
            performed_by_name: profile?.full_name || 'Staff',
            created_at: new Date().toISOString(),
          }))
          await supabase.from('cash_movements').insert(movements)
        }
        await audit({
          action: 'ORDER_PAID',
          entity: 'order',
          entityId: sale.id,
          entityName: 'Sale #' + (sale.id || '').slice(0, 8),
          newValue: { total: finalTotal, payment_method: 'split', splits },
          performer: profile as Profile,
        })
        if (selectedCustomer) {
          const earned = Math.floor(finalTotal / 100)
          const redeemed = redeemPoints && redeemAmount
            ? Math.min(parseInt(redeemAmount) || 0, selectedCustomer.loyalty_points || 0)
            : 0
          const netPoints = earned - redeemed
          await supabase.from('customer_purchases').insert({
            id: crypto.randomUUID(),
            customer_id: selectedCustomer.id,
            order_id: sale.id,
            amount_spent: finalTotal,
            points_earned: earned,
            points_redeemed: redeemed,
            created_at: new Date().toISOString(),
          })
          await supabase
            .from('customers')
            .update({
              total_spent: (selectedCustomer.total_spent || 0) + finalTotal,
              visit_count: (selectedCustomer.visit_count || 0) + 1,
              loyalty_points: (selectedCustomer.loyalty_points || 0) + netPoints,
            })
            .eq('id', selectedCustomer.id)
        }
        setPaidSale({ ...sale, payment_method: 'split', total_amount: finalTotal, customer_name: selectedCustomer?.name || sale.customer_name || null } as typeof sale)
        setSuccess(true)
        setShowReceipt(true)
        setProcessing(false)
        return
      }
      const { error: orderErr } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          total_amount: finalTotal,
          payment_method:
            paymentMethod === 'transfer'
              ? `transfer:${bankAccounts.find((b) => b.id === selectedBankId)?.bank_name || 'Bank Transfer'}`
              : paymentMethod === 'cash+transfer'
                ? `cash+transfer:${parseFloat(cashSplit || '0')}+${parseFloat(secondarySplit || '0')}`
                : paymentMethod === 'cash+card'
                  ? `cash+card:${parseFloat(cashSplit || '0')}+${parseFloat(secondarySplit || '0')}`
                  : isMobileMethod
                    ? `${paymentMethod}:${mobilePhone}`
                    : paymentMethod,
          closed_at: new Date().toISOString(),
          ...(selectedCustomer ? { customer_name: selectedCustomer.name, customer_phone: selectedCustomer.phone || null } : {}),
        })
        .eq('id', sale.id)
      if (orderErr) throw orderErr
      await audit({
        action: 'ORDER_PAID',
        entity: 'order',
        entityId: sale.id,
        entityName: 'Sale #' + (sale.id || '').slice(0, 8),
        newValue: { total: finalTotal, payment_method: paymentMethod },
        performer: profile as Profile,
      })

      if (shiftId) {
        await supabase.from('cash_movements').insert({
          id: crypto.randomUUID(),
          shift_id: shiftId,
          type: 'sale',
          amount: finalTotal,
          description: `Order #${sale.id.slice(0, 8).toUpperCase()}`,
          reference_id: sale.id,
          performed_by: profile?.id || '',
          performed_by_name: profile?.full_name || 'Staff',
          created_at: new Date().toISOString(),
        })
      }

      if (selectedCustomer) {
        const earned = Math.floor(finalTotal / 100)
        const redeemed = redeemPoints && redeemAmount
          ? Math.min(parseInt(redeemAmount) || 0, selectedCustomer.loyalty_points || 0)
          : 0
        const netPoints = earned - redeemed

        await supabase.from('customer_purchases').insert({
          id: crypto.randomUUID(),
          customer_id: selectedCustomer.id,
          order_id: sale.id,
          amount_spent: finalTotal,
          points_earned: earned,
          points_redeemed: redeemed,
          created_at: new Date().toISOString(),
        })

        await supabase
          .from('customers')
          .update({
            total_spent: (selectedCustomer.total_spent || 0) + finalTotal,
            visit_count: (selectedCustomer.visit_count || 0) + 1,
            loyalty_points: (selectedCustomer.loyalty_points || 0) + netPoints,
          })
          .eq('id', selectedCustomer.id)
      }

      void tipAmount
      setPaidSale({ ...sale, payment_method: isMobileMethod ? `${paymentMethod}:${mobilePhone}` : paymentMethod, total_amount: finalTotal, customer_name: selectedCustomer?.name || sale.customer_name || null } as typeof sale)
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
    { id: 'mtn_momo', label: 'MTN MoMo', icon: Smartphone, color: 'text-yellow-400' },
    { id: 'zain_cash', label: 'Zain Cash', icon: Smartphone, color: 'text-orange-400' },
    { id: 'airtel_money', label: 'Airtel Money', icon: Smartphone, color: 'text-blue-400' },
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
              {saleItems.map((item) => (
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
                    .filter((m) => ['cash', 'card', 'transfer'].includes(m.id))
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
          <p className="text-gray-400 text-sm mb-1">Sale complete</p>
          <p className="text-gray-500 text-xs capitalize">
              {paymentMethod === 'credit'
                ? 'Recorded as debt'
                : splitPaymentEnabled
                  ? 'Paid via split payment'
                  : `Paid via $({
                    cash: 'Cash',
                    card: 'Bank POS',
                    transfer: 'Bank Transfer',
                    mtn_momo: 'MTN MoMo',
                    zain_cash: 'Zain Cash',
                    airtel_money: 'Airtel Money',
                  } as Record<string, string>)[paymentMethod] || paymentMethod}`}
          </p>
          {splitPaymentEnabled && (
            <div className="space-y-1 mt-2">
              {splitEntries.map((e, i) => (
                <p key={i} className="text-gray-500 text-xs">
                  {({
                    cash: 'Cash',
                    card: 'Bank POS',
                    transfer: 'Bank Transfer',
                    mtn_momo: 'MTN MoMo',
                    zain_cash: 'Zain Cash',
                    airtel_money: 'Airtel Money',
                  } as Record<string, string>)[e.method] || e.method}: {formatPrice(parseFloat(e.amount))}
                </p>
              ))}
            </div>
          )}
          {!splitPaymentEnabled && isMobileMethod && mobilePhone && (
            <p className="text-gray-500 text-xs mt-1">{mobilePhone}</p>
          )}
          {paymentMethod === 'cash' && change > 0 && !splitPaymentEnabled && (
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

  if (showReceipt && paidSale)
    return (
      <ReceiptModal
        order={paidSale as unknown as import('../../types').Sale}
        items={billableItems as import('../../types').SaleItem[]}
        staffName={profile?.full_name || 'Staff'}
        tipAmount={parseFloat(tipAmount) || 0}
        amountReceived={parseFloat(amountReceived) || 0}
        discountName={appliedDiscount?.name || null}
        discountType={appliedDiscount?.type || null}
        discountValue={appliedDiscount?.value || null}
        discountAmount={discountAmount || 0}
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
            <p className="text-gray-400 text-sm">Sale #{(sale.id || '').slice(0, 8).toUpperCase()}</p>
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
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">Customer (Optional)</p>
            {selectedCustomer ? (
              <div className="bg-gray-800 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{selectedCustomer.name}</p>
                    <p className="text-gray-500 text-xs truncate">
                      {selectedCustomer.phone || selectedCustomer.email || 'No contact'} · {selectedCustomer.loyalty_points || 0} pts
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedCustomer(null)
                    setRedeemPoints(false)
                    setRedeemAmount('')
                  }}
                  className="text-gray-500 hover:text-white p-1"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value)
                    setShowCustomerSearch(true)
                  }}
                  onFocus={() => setShowCustomerSearch(true)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
                {showCustomerSearch && customerResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto shadow-xl">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c)
                          setCustomerSearch('')
                          setShowCustomerSearch(false)
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-gray-700 flex items-center gap-3 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                          <User size={12} className="text-amber-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-medium truncate">{c.name}</p>
                          <p className="text-gray-500 text-xs truncate">{c.phone || 'No phone'}</p>
                        </div>
                        <span className="text-amber-400 text-xs font-bold flex-shrink-0">
                          {c.loyalty_points || 0} pts
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedCustomer && (selectedCustomer.loyalty_points || 0) > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star size={14} className="text-amber-400" />
                  <p className="text-amber-400 text-sm font-medium">Redeem Points</p>
                </div>
                <span className="text-amber-400 text-xs font-bold">
                  {selectedCustomer.loyalty_points} available
                </span>
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={redeemPoints}
                    onChange={(e) => {
                      setRedeemPoints(e.target.checked)
                      setRedeemAmount('')
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
                <span className="text-gray-400 text-sm">Use points for discount</span>
              </div>
              {redeemPoints && (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    placeholder="Points to redeem"
                    max={maxRedeemable}
                    className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex gap-1">
                    {[100, 500].filter((n) => n <= maxRedeemable).map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setRedeemAmount(String(amt))}
                        className="px-2.5 py-2 bg-gray-800 border border-gray-700 text-gray-400 text-xs rounded-lg hover:bg-gray-700"
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {redeemPoints && parseInt(redeemAmount) > 0 && (
                <div className="flex items-center gap-2 text-green-400 text-xs">
                  <Coins size={12} />
                  <span>
                    Discount: SSP {(Math.min(parseInt(redeemAmount) || 0, maxRedeemable) / 100).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {selectedCustomer && (redeemDiscount > 0 || pointsToEarn > 0) && (
            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-3 flex items-center justify-between">
              <div className="text-xs space-y-1">
                {redeemDiscount > 0 && (
                  <p className="text-green-400">Points discount: -SSP {redeemDiscount.toFixed(2)}</p>
                )}
                {pointsToEarn > 0 && (
                  <p className="text-amber-400">Points to earn: +{pointsToEarn}</p>
                )}
              </div>
              <p className="text-white font-bold text-sm">
                {formatPrice(finalTotal)}
              </p>
            </div>
          )}

          <div className="bg-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-3 uppercase tracking-wide">Sale Summary</p>
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
            {!appliedDiscount && (
              <div className="border-t border-gray-700 pt-3 mb-3">
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 focus-within:border-amber-500 transition-colors">
                    <Tag size={14} className="text-gray-500 shrink-0" />
                    <input
                      value={discountCode}
                      onChange={(e) => {
                        setDiscountCode(e.target.value.toUpperCase())
                        setDiscountError('')
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && applyDiscountCode()}
                      placeholder="Discount code"
                      className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none font-mono uppercase"
                    />
                  </div>
                  <button
                    onClick={applyDiscountCode}
                    disabled={applyingDiscount || !discountCode.trim()}
                    className="bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-xl px-4 py-2 text-xs transition-colors shrink-0"
                  >
                    {applyingDiscount ? '...' : 'Apply'}
                  </button>
                </div>
                {discountError && (
                  <p className="text-red-400 text-xs mt-1.5">{discountError}</p>
                )}
              </div>
            )}
            {appliedDiscount && (
              <div className="border-t border-gray-700 pt-3 mb-3">
                <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Tag size={14} className="text-green-400" />
                    <span className="text-green-400 text-sm font-medium">
                      {appliedDiscount.name}
                      {appliedDiscount.type === 'percentage'
                        ? ` (${appliedDiscount.value}%)`
                        : ` (${formatPrice(appliedDiscount.value)})`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 font-bold text-sm">
                      -{formatPrice(discountAmount)}
                    </span>
                    <button
                      onClick={removeDiscount}
                      className="text-gray-400 hover:text-red-400 transition-colors ml-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="border-t border-gray-700 pt-3 space-y-2">
              {(computedTax > 0 || appliedDiscount) && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-gray-400">{formatPrice(subtotal)}</span>
                </div>
              )}
              {computedTax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-orange-400">Tax</span>
                  <span className="text-orange-400">{formatPrice(computedTax)}</span>
                </div>
              )}
              {appliedDiscount && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">Discount</span>
                  <span className="text-green-400">-{formatPrice(discountAmount)}</span>
                </div>
              )}
              {redeemDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">Points Discount</span>
                  <span className="text-green-400">-{formatPrice(redeemDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-white font-bold">Total</span>
                <span className="text-amber-400 font-bold text-xl break-all">
                  {formatPrice(finalTotal)}
                </span>
              </div>
            </div>
          </div>

            <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
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

            {!splitPaymentEnabled ? (
              <button
                onClick={() => setSplitPaymentEnabled(true)}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white rounded-xl py-3 text-sm font-medium transition-colors mt-3"
              >
                <Split size={16} /> Split Payment
              </button>
            ) : (
              <div className="mt-3 space-y-3 bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Split Payment</p>
                  <button
                    onClick={() => {
                      setSplitPaymentEnabled(false)
                      setSplitEntries([{ method: 'cash', amount: '' }])
                    }}
                    className="text-gray-500 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>

                {splitEntries.map((entry, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <select
                      value={entry.method}
                      onChange={(e) => {
                        const updated = [...splitEntries]
                        updated[idx] = { ...updated[idx], method: e.target.value }
                        setSplitEntries(updated)
                      }}
                      className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Bank POS</option>
                      <option value="transfer">Bank Transfer</option>
                      <option value="mtn_momo">MTN MoMo</option>
                      <option value="zain_cash">Zain Cash</option>
                      <option value="airtel_money">Airtel Money</option>
                    </select>
                    <input
                      type="number"
                      value={entry.amount}
                      onChange={(e) => {
                        const updated = [...splitEntries]
                        updated[idx] = { ...updated[idx], amount: e.target.value }
                        setSplitEntries(updated)
                      }}
                      placeholder="Amount"
                      className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                    />
                    {splitEntries.length > 1 && (
                      <button
                        onClick={() => setSplitEntries(splitEntries.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-300 p-2"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={() => setSplitEntries([...splitEntries, { method: 'cash', amount: '' }])}
                  className="w-full flex items-center justify-center gap-1 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 text-gray-400 hover:text-white rounded-xl py-2 text-xs transition-colors"
                >
                  <Plus size={14} /> Add Payment Method
                </button>

                <div className="bg-gray-800 rounded-xl p-3 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Total</span>
                    <span className="text-white font-bold">{formatPrice(finalTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Allocated</span>
                    <span className={splitSum === finalTotal ? 'text-green-400 font-bold' : 'text-amber-400 font-bold'}>
                      {formatPrice(splitSum)}
                    </span>
                  </div>
                  {splitSum > 0 && splitSum < finalTotal && (
                    <p className="text-amber-400 text-xs">Remaining: {formatPrice(finalTotal - splitSum)}</p>
                  )}
                  {splitSum > finalTotal && (
                    <p className="text-red-400 text-xs">Over-allocated by {formatPrice(splitSum - finalTotal)}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {!splitPaymentEnabled && isMobileMethod && (
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                  Mobile Money Phone Number
                </label>
                <input
                  type="text"
                  value={mobilePhone}
                  onChange={(e) => setMobilePhone(e.target.value)}
                  placeholder="0912 345 678"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-amber-500"
                />
                <p className="text-gray-500 text-xs mt-1.5">
                  Enter the phone number used for the {paymentMethods.find((m) => m.id === paymentMethod)?.label || 'mobile money'} transaction
                </p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                <Smartphone size={28} className="text-amber-400 mx-auto mb-2" />
                <p className="text-amber-400 font-medium">{paymentMethods.find((m) => m.id === paymentMethod)?.label || 'Mobile Money'}</p>
                <p className="text-gray-400 text-sm mt-1">
                  Request {formatPrice(finalTotal)} via {paymentMethods.find((m) => m.id === paymentMethod)?.label || 'Mobile Money'}, then confirm below.
                </p>
              </div>
            </div>
          )}
          {!splitPaymentEnabled && paymentMethod === 'cash' && (
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
              {cashTendered && parseFloat(cashTendered) >= finalTotal && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                  <p className="text-green-400 text-xs">Change to return</p>
                  <p className="text-white text-xl font-bold break-all">{formatPrice(change)}</p>
                </div>
              )}
              {cashTendered && parseFloat(cashTendered) < finalTotal && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-red-400 text-xs">Short by</p>
                  <p className="text-white text-xl font-bold break-all">
                    {formatPrice(finalTotal - parseFloat(cashTendered))}
                  </p>
                </div>
              )}
            </div>
          )}
          {!splitPaymentEnabled && (paymentMethod === 'cash+transfer' || paymentMethod === 'cash+card') && (
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
                  <span className="text-white font-bold">{formatPrice(finalTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Entered</span>
                  <span className="text-amber-400 font-bold">
                    {formatPrice(parseFloat(cashSplit || '0') + parseFloat(secondarySplit || '0'))}
                  </span>
                </div>
                {parseFloat(cashSplit || '0') + parseFloat(secondarySplit || '0') < finalTotal && (
                  <p className="text-red-400 text-xs mt-2">
                    Short — enter full amount before confirming.
                  </p>
                )}
              </div>
            </div>
          )}
          {!splitPaymentEnabled && paymentMethod === 'card' && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
              <CreditCard size={28} className="text-blue-400 mx-auto mb-2" />
              <p className="text-blue-400 font-medium">Bank POS</p>
              <p className="text-gray-400 text-sm mt-1">
                Process {formatPrice(finalTotal)} on the POS terminal, then confirm below.
              </p>
            </div>
          )}
          {!splitPaymentEnabled && paymentMethod === 'transfer' &&
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
                      <p className="text-gray-400 text-xs">Transfer {formatPrice(finalTotal)} to:</p>
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
          {!splitPaymentEnabled && paymentMethod === 'credit' && (
            <div className="space-y-3">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                <Clock size={28} className="text-red-400 mx-auto mb-2" />
                <p className="text-red-400 font-medium">Pay Later</p>
                <p className="text-gray-400 text-sm mt-1">
                  Sale will be recorded as a debt. Enter customer details below.
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
                    placeholder={finalTotal.toFixed(0)}
                    value={amountReceived}
                    onChange={(e) => {
                      setAmountReceived(e.target.value)
                      const received = parseFloat(e.target.value)
                      if (!isNaN(received) && received > finalTotal) {
                        setTipAmount((received - finalTotal).toFixed(0))
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
