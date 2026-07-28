import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { audit } from '../../lib/audit'
import {
  X,
  Plus,
  Minus,
  Trash2,
  Search,
  CheckCircle,
  Banknote,
  CreditCard,
  Smartphone,
  ShoppingBag,
  Printer,
  Clock,
} from 'lucide-react'
import type { Item, ItemCategory } from '../../types'
import { useToast } from '../../context/ToastContext'
import { formatPrice } from '../../lib/currency'
import PriceDisplay from '../../components/PriceDisplay'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  total: number
}

interface CompletedOrder {
  order: { id: string }
  items: CartItem[]
  total: number
  change: number
  tendered: number
  customerName: string
  paymentMethod: string
}

interface Props {
  staffId: string
  onSuccess: () => void
  onClose: () => void
  shiftId?: string | null
}

export default function CashSaleModal({ staffId, onSuccess, onClose, shiftId }: Props) {
  const { profile } = useAuth()
  const toast = useToast()

  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<ItemCategory[]>([])
  const [loading, setLoading] = useState(true)

  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'credit' | 'mtn_momo' | 'zain_cash' | 'airtel_money'>('cash')
  const [cashTendered, setCashTendered] = useState('')
  const [mobilePhone, setMobilePhone] = useState('')
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null)

  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products')

  useEffect(() => {
    const load = async () => {
      const [itemsRes, catsRes] = await Promise.all([
        supabase
          .from('item')
          .select('*, item_categories(id, name)')
          .eq('is_active', true)
          .eq('is_available', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('item_categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ])
      if (itemsRes.data) setItems(itemsRes.data as Item[])
      if (catsRes.data) setCategories(catsRes.data as ItemCategory[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = items.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(search.toLowerCase()))
    const matchCategory =
      activeCategory === 'All' || item.item_categories?.name === activeCategory
    return matchSearch && matchCategory
  })

  const addItem = (item: Item) => {
    if (item.stock_quantity <= 0) return toast.warning('Out of Stock', `${item.name} has no stock`)
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id)
      if (existing) {
        if (existing.quantity >= item.stock_quantity) {
          toast.warning('Stock Limit', `Only ${item.stock_quantity} in stock`)
          return prev
        }
        return prev.map((c) =>
          c.id === item.id
            ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.price }
            : c
        )
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1, total: item.price }]
    })
  }

  const decrementItem = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === itemId)
      if (!existing) return prev
      if (existing.quantity === 1) return prev.filter((c) => c.id !== itemId)
      return prev.map((c) =>
        c.id === itemId
          ? { ...c, quantity: c.quantity - 1, total: (c.quantity - 1) * c.price }
          : c
      )
    })
  }

  const incrementItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    setCart((prev) => {
      const existing = prev.find((c) => c.id === itemId)
      if (!existing) return prev
      if (item && existing.quantity >= item.stock_quantity) {
        toast.warning('Stock Limit', `Only ${item.stock_quantity} in stock`)
        return prev
      }
      return prev.map((c) =>
        c.id === itemId
          ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.price }
          : c
      )
    })
  }

  const removeItem = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.id !== itemId))
  }

  const total = cart.reduce((sum, c) => sum + c.total, 0)
  const change = paymentMethod === 'cash' && cashTendered ? parseFloat(cashTendered) - total : 0

  const isMobileMethod = () => ['mtn_momo', 'zain_cash', 'airtel_money'].includes(paymentMethod)
  const canPay = () => {
    if (processing || cart.length === 0) return false
    if (paymentMethod === 'credit' && !customerName.trim()) return false
    if (paymentMethod === 'cash') {
      const tendered = parseFloat(cashTendered)
      return !isNaN(tendered) && tendered >= total
    }
    if (isMobileMethod()) return mobilePhone.trim().length >= 8
    return true
  }

  const processOrder = async () => {
    if (cart.length === 0) return toast.warning('Required', 'Add at least one item')
    if (paymentMethod === 'credit' && !customerName.trim())
      return toast.warning('Required', 'Customer name is required for credit')
    if (paymentMethod === 'cash' && (isNaN(parseFloat(cashTendered)) || parseFloat(cashTendered) < total))
      return toast.warning('Required', 'Cash tendered must be at least the total')

    setProcessing(true)
    try {
      const orderId = crypto.randomUUID()
      const { error: orderError } = await supabase.from('orders').insert({
        id: orderId,
        staff_id: staffId,
        order_type: 'sale',
        status: 'paid',
        payment_method: ['mtn_momo', 'zain_cash', 'airtel_money'].includes(paymentMethod)
          ? `${paymentMethod}:${mobilePhone}`
          : paymentMethod,
        total_amount: total,
        customer_name: customerName.trim() || null,
        notes: notes.trim() || null,
        closed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      if (orderError) throw orderError

      const itemRows = cart.map((item) => ({
        id: crypto.randomUUID(),
        order_id: orderId,
        item_id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.total,
        status: 'completed' as const,
        created_at: new Date().toISOString(),
      }))
      const { error: itemsError } = await supabase.from('order_items').insert(itemRows)
      if (itemsError) throw itemsError

      // Update stock quantities
      for (const item of cart) {
        const product = items.find((i) => i.id === item.id)
        if (product) {
          await supabase
            .from('item')
            .update({ stock_quantity: product.stock_quantity - item.quantity })
            .eq('id', item.id)
        }
      }

      await audit({
        action: 'ORDER_CREATED',
        entity: 'order',
        entityId: orderId,
        entityName: `Cash Sale — ${customerName.trim() || 'Walk-in'}`,
        newValue: { total, items: cart.length, paymentMethod },
        performer: profile,
      })

      if (shiftId) {
        await supabase.from('cash_movements').insert({
          id: crypto.randomUUID(),
          shift_id: shiftId,
          type: 'sale',
          amount: total,
          description: `Cash Sale — ${customerName.trim() || 'Walk-in'}`,
          reference_id: orderId,
          performed_by: staffId,
          performed_by_name: profile?.full_name || 'Staff',
          created_at: new Date().toISOString(),
        })
      }

      const formattedPm = ['mtn_momo', 'zain_cash', 'airtel_money'].includes(paymentMethod)
        ? `${paymentMethod}:${mobilePhone}`
        : paymentMethod
      setCompletedOrder({
        order: { id: orderId },
        items: cart,
        total,
        change,
        tendered: paymentMethod === 'cash' ? parseFloat(cashTendered) : total,
        customerName: customerName.trim(),
        paymentMethod: formattedPm,
      })
      setSuccess(true)
    } catch (err) {
      toast.error('Error', 'Error processing order: ' + (err as Error).message)
    } finally {
      setProcessing(false)
    }
  }

  const printReceipt = () => {
    if (!completedOrder) return
    const o = completedOrder
    const W = 40
    const fmtRow = (left: string, right: string) => {
      const l = left.substring(0, W - right.length - 1)
      const spaces = W - l.length - right.length
      return l + ' '.repeat(Math.max(1, spaces)) + right
    }
    const divider = '-'.repeat(W)
    const solidDivider = '='.repeat(W)
    const centre = (str: string) => {
      const pad = Math.max(0, Math.floor((W - str.length) / 2))
      return ' '.repeat(pad) + str
    }
    const fmtDate = new Date().toLocaleDateString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    const fmtTime = new Date().toLocaleTimeString('en-NG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    const pmLabel =
      o.paymentMethod === 'cash'
        ? 'CASH'
        : o.paymentMethod === 'card'
          ? 'BANK POS'
          : o.paymentMethod === 'transfer'
            ? 'TRANSFER'
            : o.paymentMethod.startsWith('mtn_momo')
              ? 'MTN MOMO'
              : o.paymentMethod.startsWith('zain_cash')
                ? 'ZAIN CASH'
                : o.paymentMethod.startsWith('airtel_money')
                  ? 'AIRTEL MONEY'
                  : o.paymentMethod.toUpperCase()
    const orderRef = `CS-${o.order.id.slice(0, 8).toUpperCase()}`

    const grouped = new Map<string, { qty: number; total: number }>()
    o.items.forEach((i) => {
      const existing = grouped.get(i.name)
      if (existing) {
        existing.qty += i.quantity
        existing.total += i.total
      } else grouped.set(i.name, { qty: i.quantity, total: i.total })
    })
    const itemLines = Array.from(grouped.entries())
      .map(([name, { qty, total: t }]) => fmtRow(`${qty}x ${name}`, `N${t.toLocaleString()}`))
      .join('\n')

    const fmtTotal = `N${o.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    const lines = [
      '',
      centre('C.Biz Mall POS'),
      divider,
      fmtRow('Ref:', orderRef),
      fmtRow('Customer:', (o.customerName || 'Walk-in').substring(0, 25)),
      fmtRow('Date:', fmtDate),
      fmtRow('Time:', fmtTime),
      fmtRow('Served by:', (profile?.full_name || 'Staff').substring(0, 22)),
      fmtRow('Payment:', pmLabel),
      divider,
      fmtRow('ITEM', 'AMOUNT'),
      divider,
      itemLines,
      solidDivider,
      fmtRow('TOTAL:', fmtTotal),
      ...(o.paymentMethod === 'cash'
        ? [
            fmtRow(
              'Tendered:',
              `N${o.tendered.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ),
            fmtRow(
              'Change:',
              `N${o.change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ),
          ]
        : []),
      solidDivider,
      '',
      centre('** PAYMENT CONFIRMED **'),
      '',
      centre('Thank you for shopping with us!'),
      '',
    ].join('\n')

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Receipt - ${orderRef}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #000; background: #fff; width: 80mm; padding: 4mm; white-space: pre; }
@media print { body { width: 80mm; } @page { margin: 0; size: 80mm auto; } }
</style></head><body>${lines}</body></html>`

    const win = window.open('', '_blank', 'width=500,height=700,toolbar=no,menubar=no,scrollbars=no')
    if (!win) return
    win.document.open('text/html', 'replace')
    win.document.write(html)
    win.document.close()
    win.onafterprint = () => win.close()
    win.onload = () => {
      setTimeout(() => {
        try { win.print() } catch { /* already closed */ }
      }, 200)
    }
    setTimeout(() => {
      try { if (!win.closed) win.close() } catch { /* already closed */ }
    }, 300000)
  }

  if (success)
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-2xl p-6 text-center max-w-sm w-full border border-gray-800 space-y-4">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <div>
            <h3 className="text-white text-xl font-bold mb-1">Sale Complete!</h3>
            <p className="text-gray-400 text-sm">
              {customerName ? `Sale for ${customerName}` : 'Cash sale processed'}
            </p>
            <p className="text-gray-500 text-xs mt-1 capitalize">
              Paid via {({
                cash: 'Cash',
                card: 'Bank POS',
                transfer: 'Bank Transfer',
                mtn_momo: 'MTN MoMo',
                zain_cash: 'Zain Cash',
                airtel_money: 'Airtel Money',
              } as Record<string, string>)[paymentMethod] || paymentMethod}
            </p>
            {['mtn_momo', 'zain_cash', 'airtel_money'].includes(paymentMethod) && mobilePhone && (
              <p className="text-gray-500 text-xs">{mobilePhone}</p>
            )}
          </div>
          {paymentMethod === 'cash' && change > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <p className="text-amber-400 text-xs mb-1">Change to return</p>
              <PriceDisplay
                amount={change}
                className="text-white text-2xl font-bold"
                sspClassName="text-xs text-gray-400"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={printReceipt}
              className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2.5 rounded-xl text-sm"
            >
              <Printer size={15} /> Print Receipt
            </button>
            <button
              onClick={onSuccess}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-2xl border border-gray-800 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-600">
              <ShoppingBag size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold">Cash Sale</h3>
              <p className="text-gray-400 text-xs">Counter sale — pay immediately</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Mobile tab switcher */}
        <div className="flex md:hidden border-b border-gray-800 bg-gray-900 shrink-0">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${activeTab === 'products' ? 'text-white border-b-2 border-amber-500' : 'text-gray-500'}`}
          >
            Products
          </button>
          <button
            onClick={() => setActiveTab('cart')}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${activeTab === 'cart' ? 'text-white border-b-2 border-amber-500' : 'text-gray-500'}`}
          >
            Cart {cart.length > 0 && `(${cart.length})`}
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — item grid */}
          <div
            className={`${activeTab === 'products' ? 'flex' : 'hidden'} md:flex flex-1 flex-col overflow-hidden border-r border-gray-800`}
          >
            {/* Search */}
            <div className="p-3 border-b border-gray-800 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search items..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 px-3 py-2 overflow-x-auto border-b border-gray-800 shrink-0">
              <button
                onClick={() => setActiveCategory('All')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeCategory === 'All' ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeCategory === cat.name ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Mobile view-order button */}
            {cart.length > 0 && (
              <div className="md:hidden shrink-0 p-2 border-t border-gray-800 bg-gray-900">
                <button
                  onClick={() => setActiveTab('cart')}
                  className="w-full bg-amber-500 text-black font-bold rounded-xl py-2.5 text-sm"
                >
                  View Cart ({cart.length} items) — {formatPrice(total)} →
                </button>
              </div>
            )}

            {/* Item grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-600 text-sm">No items found</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filtered.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addItem(item)}
                      className="bg-gray-800 hover:bg-gray-700 rounded-xl p-3 text-left border border-gray-700 hover:border-amber-500/50 transition-colors"
                    >
                      <p className="text-white text-sm font-medium leading-tight">{item.name}</p>
                      <p className="text-amber-400 text-sm font-bold mt-1">{formatPrice(item.price)}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {item.item_categories?.name || 'Uncategorized'}
                      </p>
                      {item.stock_quantity <= (item.low_stock_threshold || 0) && item.stock_quantity > 0 && (
                        <p className="text-orange-400 text-[10px] mt-0.5">Low stock: {item.stock_quantity}</p>
                      )}
                      {item.stock_quantity <= 0 && (
                        <p className="text-red-400 text-[10px] mt-0.5">Out of stock</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right panel — cart + payment */}
          <div
            className={`${activeTab === 'cart' ? 'flex' : 'hidden'} md:flex w-full md:w-80 flex-col overflow-hidden shrink-0`}
          >
            <div className="flex-1 overflow-y-auto">
              {/* Customer name */}
              <div className="p-3 border-b border-gray-800">
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name (optional)"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Cart items */}
              <div className="p-3 space-y-2.5">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm">Tap items to add</div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="bg-gray-800 rounded-xl px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-white text-sm font-medium flex-1 mr-2">{item.name}</span>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-red-400 hover:text-red-300 shrink-0 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => decrementItem(item.id)}
                            className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white active:scale-95 transition-transform"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-white text-base font-bold w-6 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => incrementItem(item.id)}
                            className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white active:scale-95 transition-transform"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <span className="text-amber-400 text-sm font-bold">{formatPrice(item.total)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Notes */}
              <div className="px-3 pb-2">
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Payment footer */}
            {cart.length > 0 && (
              <div className="p-3 border-t border-gray-800 space-y-3 shrink-0">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Total</span>
                  <PriceDisplay
                    amount={total}
                    className="text-amber-400 font-bold text-xl"
                    sspClassName="text-[10px] text-amber-400/60"
                  />
                </div>

                {/* Payment method buttons */}
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      ['cash', 'Cash', Banknote],
                      ['mtn_momo', 'MTN MoMo', Smartphone],
                      ['zain_cash', 'Zain Cash', Smartphone],
                      ['airtel_money', 'Airtel Money', Smartphone],
                      ['card', 'POS', CreditCard],
                      ['transfer', 'Transfer', Smartphone],
                      ['credit', 'Credit', Clock],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      onClick={() => setPaymentMethod(id)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl border-2 transition-all text-xs font-medium ${paymentMethod === id ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-gray-700 bg-gray-800 text-gray-500'}`}
                    >
                      <Icon size={14} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Cash tendered input */}
                {paymentMethod === 'cash' && (
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder="Amount tendered"
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-amber-500"
                    />
                    <div className="grid grid-cols-4 gap-1">
                      {[2000, 5000, 10000, 20000].map((a) => (
                        <button
                          key={a}
                          onClick={() => setCashTendered(a.toString())}
                          className="bg-gray-800 border border-gray-700 text-gray-400 text-xs rounded-lg py-1.5 hover:text-white transition-colors"
                        >
                          {formatPrice(a)}
                        </button>
                      ))}
                    </div>
                    {cashTendered && parseFloat(cashTendered) >= total && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2 text-center">
                        <p className="text-green-400 text-xs">Change</p>
                        <PriceDisplay
                          amount={change}
                          className="text-white font-bold"
                          sspClassName="text-[10px] text-gray-400"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Credit info */}
                {paymentMethod === 'credit' && (
                  <>
                    {!customerName.trim() && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2">
                        <p className="text-red-400 text-xs text-center">
                          Customer name is required for credit sales
                        </p>
                      </div>
                    )}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2">
                      <p className="text-amber-400 text-xs text-center">
                        {customerName.trim()
                          ? `${formatPrice(total)} will be added to ${customerName}'s tab`
                          : 'Enter a customer name to proceed'}
                      </p>
                    </div>
                  </>
                )}

                {/* Mobile money phone input */}
                {['mtn_momo', 'zain_cash', 'airtel_money'].includes(paymentMethod) && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={mobilePhone}
                      onChange={(e) => setMobilePhone(e.target.value)}
                      placeholder="Mobile money phone number (0912 345 678)"
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-amber-500"
                    />
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 text-center">
                      <p className="text-amber-400 text-xs">
                        Request {formatPrice(total)} via {
                          ({ mtn_momo: 'MTN MoMo', zain_cash: 'Zain Cash', airtel_money: 'Airtel Money' } as Record<string, string>)[paymentMethod]
                        } on this number
                      </p>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={printReceipt}
                    className="flex items-center justify-center gap-1 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 font-medium rounded-xl py-3 px-3 text-sm transition-colors shrink-0"
                  >
                    <Printer size={14} />
                  </button>
                  <button
                    onClick={processOrder}
                    disabled={!canPay()}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-xl py-3 text-sm transition-colors"
                  >
                    {processing ? 'Processing...' : `Confirm ${formatPrice(total)}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
