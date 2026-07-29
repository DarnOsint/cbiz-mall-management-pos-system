import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { audit } from '../../lib/audit'
import { formatPrice } from '../../lib/currency'
import { useAuth } from '../../context/AuthContext'
import {
  X,
  Banknote,
  CreditCard,
  CheckCircle,
  Printer,
  Search,
  User,
  Star,
  Coins,
  Tag,
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
  const [tipAmount, setTipAmount] = useState('')
  const [amountReceived, setAmountReceived] = useState('')
  const [discountCode, setDiscountCode] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountError, setDiscountError] = useState('')
  const [applyingDiscount, setApplyingDiscount] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [redeemPoints, setRedeemPoints] = useState(false)
  const [redeemAmount, setRedeemAmount] = useState('')

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

  const change = paymentMethod === 'cash' && cashTendered ? parseFloat(cashTendered) - finalTotal : 0

  useEffect(() => {
    if (paymentMethod === 'cash' && finalTotal > 0) {
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

      const { error: orderErr } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          total_amount: finalTotal,
          payment_method: paymentMethod,
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

      setPaidSale({ ...sale, payment_method: paymentMethod, total_amount: finalTotal, customer_name: selectedCustomer?.name || sale.customer_name || null } as typeof sale)
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

  const paymentMethods = [
    { id: 'cash', label: 'Cash', icon: Banknote, color: 'text-green-400' },
    { id: 'card', label: 'Bank POS', icon: CreditCard, color: 'text-blue-400' },
  ]

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
            Paid via {paymentMethod === 'cash' ? 'Cash' : 'Bank POS'}
          </p>
          {paymentMethod === 'cash' && change > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mt-4">
              <p className="text-amber-400 text-xs mb-1">Change to return</p>
              <p className="text-white text-xl font-bold break-all">
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
            <div className="grid grid-cols-2 gap-2">
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
            {paymentMethod === 'card' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
                <CreditCard size={28} className="text-blue-400 mx-auto mb-2" />
                <p className="text-blue-400 font-medium">Bank POS</p>
                <p className="text-gray-400 text-sm mt-1">
                  Process {formatPrice(finalTotal)} on the POS terminal, then confirm below.
                </p>
              </div>
            )}

            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-green-400 text-sm font-semibold">Tip Recording</p>
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

            <button
              onClick={processPayment}
              disabled={!canProcess()}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-gray-800 disabled:text-gray-600 text-black font-bold rounded-xl py-4 text-lg transition-colors"
            >
              {processing
                ? 'Processing...'
                : `Confirm ${formatPrice(total)} Payment`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
