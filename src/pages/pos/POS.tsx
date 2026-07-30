import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/currency'
import PriceDisplay from '../../components/PriceDisplay'
import { useAuth } from '../../context/AuthContext'
import {
  LogOut,
  RefreshCw,
  ShoppingBag,
  History,
  TrendingUp,
  Clock,
  Search,
  X,
  Plus,
  Minus,
  Trash2,
  Send,
} from 'lucide-react'
import ReceiptModal from './ReceiptModal'
import PaymentModal from './PaymentModal'
import type { MenuItem, Order, OrderItem, Profile, Sale } from '../../types'
import { useToast } from '../../context/ToastContext'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  total: number
  menu_categories?: { name?: string; destination?: string } | null
}

function DesktopMenuBrowser({
  menuItems,
  onAddItem,
  menuError,
}: {
  menuItems: (MenuItem & { current_stock?: number | null })[]
  onAddItem: (item: MenuItem) => void
  menuError?: string | null
}) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const categories = [
    'All',
    ...new Set(
      menuItems
        .map((i) => (i as unknown as { menu_categories?: { name?: string } }).menu_categories?.name)
        .filter(Boolean) as string[]
    ),
  ]
  const filtered = menuItems.filter((item) => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
    const matchCat =
      activeCategory === 'All' ||
      (item as unknown as { menu_categories?: { name?: string } }).menu_categories?.name ===
        activeCategory
    return matchSearch && matchCat
  })
  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto border-b border-gray-800 shrink-0 bg-gray-900/50">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="flex px-4 py-2 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2 flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 focus-within:border-amber-500 transition-colors">
          <Search size={16} className="text-gray-500 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-500 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-4">
              <ShoppingBag size={24} className="text-gray-500" />
            </div>
            <p className="text-gray-400 font-semibold mb-1">No items found</p>
            {menuError ? (
              <div className="text-red-400 text-xs max-w-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {menuError}
              </div>
            ) : (
              <p className="text-gray-600 text-xs max-w-xs">
                {menuItems.length === 0
                  ? 'No items available. Add them in Back Office.'
                  : 'Try a different search or category.'}
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => onAddItem(item)}
                className="rounded-xl overflow-hidden text-left transition-all border active:scale-[0.97] bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-amber-500/50"
              >
                <div className="p-3">
                  <p className="text-white text-sm font-medium leading-tight truncate">
                    {item.name}
                  </p>
                  <p className="text-amber-400 text-sm font-bold mt-1">
                    {formatPrice(item.price)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function POS() {
  const { profile, signOut } = useAuth()
  const toast = useToast()

  const [menuItems, setMenuItems] = useState<(MenuItem & { current_stock?: number | null })[]>([])
  const [menuError, setMenuError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [notes, setNotes] = useState('')
  const [posTab, setPosTab] = useState<'pos' | 'history' | 'shift'>('pos')
  const [orderHistory, setOrderHistory] = useState<HistoryOrder[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [shiftStats, setShiftStats] = useState<ShiftStats | null>(null)
  const [shiftLoading, setShiftLoading] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [paidOrder, setPaidOrder] = useState<Order | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  useEffect(() => {
    fetchMenu()
  }, [])

  const fetchMenu = async () => {
    const [menuRes, invRes] = await Promise.all([
      supabase
        .from('menu_items')
        .select('id, name, price, description, image_url, is_available, category_id, menu_categories(name, destination)')
        .order('name'),
      supabase
        .from('inventory')
        .select('menu_item_id, current_stock')
        .eq('is_active', true),
    ])
    if (menuRes.error) {
      setMenuError(String(menuRes.error.message || JSON.stringify(menuRes.error)))
      return
    }
    const invMap: Record<string, number> = {}
    if (invRes.data)
      invRes.data.forEach((i: { menu_item_id: string | null; current_stock: number }) => {
        if (i.menu_item_id) invMap[i.menu_item_id] = i.current_stock
      })
    setMenuItems(
      (menuRes.data || []).map((item: any) => ({
        ...item,
        current_stock: invMap[item.id] ?? null,
      }))
    )
    setLoading(false)
  }

  const addToCart = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (existing)
        return prev.map((i) =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price }
            : i
        )
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          total: item.price,
          menu_categories: (
            item as unknown as { menu_categories?: { name?: string; destination?: string } | null }
          ).menu_categories,
        },
      ]
    })
  }, [])

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === itemId)
      if (!existing) return prev
      if (existing.quantity === 1) return prev.filter((i) => i.id !== itemId)
      return prev.map((i) =>
        i.id === itemId ? { ...i, quantity: i.quantity - 1, total: (i.quantity - 1) * i.price } : i
      )
    })
  }

  const deleteFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId))
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.total, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)

  const placingRef = useRef(false)
  const pendingOrderRef = useRef<Order | null>(null)

  const handlePay = async () => {
    if (cart.length === 0) return
    if (placingRef.current) return
    placingRef.current = true
    try {
      const orderId = crypto.randomUUID()
      const orderRecord = {
        id: orderId,
        staff_id: profile!.id,
        order_type: 'cash_sale' as const,
        status: 'open' as const,
        total_amount: cartTotal,
        notes: notes || null,
        customer_name: null,
        customer_phone: null,
        created_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('orders').insert(orderRecord)
      if (error) {
        toast.error('Error', 'Failed to create order: ' + error.message)
        return
      }

      const itemRows = cart.map((item) => ({
        id: crypto.randomUUID(),
        order_id: orderId,
        menu_item_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.total,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
      }))
      for (const row of itemRows) {
        const { error: itemErr } = await supabase.from('order_items').insert(row)
        if (itemErr) {
          toast.error('Error', 'Failed to add items: ' + itemErr.message)
          return
        }
      }

      const { data: freshOrder } = await supabase
        .from('orders')
        .select(
          `id, created_at, status, staff_id, order_type, payment_method, customer_name, notes, total_amount,
           order_items(id, order_id, menu_item_id, quantity, status, unit_price, total_price, created_at,
             menu_items(name, price))`
        )
        .eq('id', orderId)
        .single()

      if (freshOrder) {
        pendingOrderRef.current = freshOrder as unknown as Order
        setShowPayment(true)
      }
    } catch (err) {
      toast.error(
        'Error',
        'Failed to create order: ' + (err instanceof Error ? err.message : String(err))
      )
    } finally {
      placingRef.current = false
    }
  }

  const handlePaymentSuccess = async () => {
    setPaidOrder(pendingOrderRef.current)
    setCart([])
    setNotes('')
    setShowPayment(false)
    setShowReceipt(true)
    pendingOrderRef.current = null
    void fetchMenu()
  }

  const handlePaymentClose = async () => {
    const order = pendingOrderRef.current
    if (order?.id) {
      await supabase.from('orders').update({ status: 'voided' }).eq('id', order.id)
      await supabase.from('order_items').delete().eq('order_id', order.id)
    }
    pendingOrderRef.current = null
    setShowPayment(false)
  }

  const fetchHistory = async () => {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('orders')
      .select(
        `id, closed_at, total_amount, payment_method, order_type, status, customer_name, created_at,
         order_items(id, menu_item_id, quantity, total_price, status, return_requested, return_accepted,
           menu_items(name))`
      )
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setOrderHistory(data as unknown as HistoryOrder[])
    setHistoryLoading(false)
  }

  const fetchShiftStats = async () => {
    setShiftLoading(true)
    const today = new Date(Date.now() + 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: attendanceOpen } = await supabase
      .from('attendance')
      .select('clock_in, date')
      .eq('staff_id', profile?.id)
      .or('clock_out.is.null')
      .order('clock_in', { ascending: false })
      .limit(1)
    const activeClockIn = attendanceOpen?.[0]?.clock_in
    const windowStartIso = activeClockIn
      ? new Date(activeClockIn).toISOString()
      : new Date(today).toISOString()
    const [attendanceRes, ordersRes] = await Promise.all([
      supabase
        .from('attendance')
        .select('clock_in, date')
        .eq('staff_id', profile?.id)
        .or('clock_out.is.null')
        .order('clock_in', { ascending: false })
        .limit(1),
      supabase
        .from('orders')
        .select(
          `id, total_amount, closed_at,
           order_items(quantity, total_price, status, return_requested, return_accepted, menu_items(name))`
        )
        .eq('staff_id', profile?.id)
        .eq('status', 'paid')
        .gte('closed_at', windowStartIso),
    ])
    const attendance = attendanceRes.data?.[0] as { clock_in: string } | undefined
    const orders = (ordersRes.data || []) as unknown as ShiftOrder[]
    const filteredOrders = orders.map((o) => {
      const items = o.order_items.filter(
        (i) =>
          !i.return_requested &&
          !i.return_accepted &&
          (i.status || '').toLowerCase() !== 'cancelled'
      )
      const netTotal = items.reduce((s, i) => s + (i.total_price ?? 0), 0)
      return { ...o, order_items: items, netTotal }
    })
    const totalSales = filteredOrders.reduce((s, o) => s + (o.netTotal || 0), 0)
    const totalItems = filteredOrders.reduce(
      (s, o) => s + o.order_items.reduce((ss, i) => ss + (i.quantity || 0), 0),
      0
    )
    setShiftStats({
      clockIn: attendance?.clock_in,
      ordersCount: orders.length,
      totalSales,
      totalItems,
      recentOrders: filteredOrders.slice(0, 5),
    })
    setShiftLoading(false)
  }

  if (loading)
    return (
      <div className="min-h-full bg-gray-950 flex items-center justify-center">
        <div className="text-amber-500">Loading...</div>
      </div>
    )

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col">
      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <ShoppingBag size={15} className="text-black" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-white font-bold text-sm">C.Biz POS</h1>
              <p className="text-gray-400 text-xs">Point of Sale</p>
            </div>
            <span className="sm:hidden text-white font-bold text-sm">C.Biz POS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchMenu}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white active:rotate-180 transition-transform duration-300"
            >
              <RefreshCw size={15} />
            </button>
            <div className="hidden sm:block text-right">
              <p className="text-white text-xs">{profile?.full_name}</p>
              <p className="text-amber-500 text-xs capitalize">{profile?.role}</p>
            </div>
            <button
              onClick={signOut}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      <div className="flex border-b border-gray-800 bg-gray-900 px-4">
        {(
          [
            ['pos', ShoppingBag, 'POS'],
            ['history', History, 'My Orders'],
            ['shift', TrendingUp, 'My Shift'],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            onClick={() => {
              setPosTab(id as 'pos' | 'history' | 'shift')
              if (id === 'history') fetchHistory()
              if (id === 'shift') fetchShiftStats()
            }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${posTab === id ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-500 hover:text-white'}`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {posTab === 'pos' && (
          <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              <DesktopMenuBrowser
                menuItems={menuItems}
                onAddItem={addToCart}
                menuError={menuError}
              />
            </div>

            <div className="hidden md:flex w-80 border-l border-gray-800 flex-col overflow-hidden bg-gray-900">
              <CartPanel
                cart={cart}
                cartTotal={cartTotal}
                cartCount={cartCount}
                notes={notes}
                setNotes={setNotes}
                onAdd={addToCart}
                onRemove={removeFromCart}
                onDelete={deleteFromCart}
                onPay={handlePay}
              />
            </div>
          </div>
        )}

        {posTab === 'history' && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-lg mx-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-white text-lg font-bold">My Orders</h2>
                  <p className="text-gray-500 text-xs">
                    Recent orders — {orderHistory.length} total
                  </p>
                </div>
                <button onClick={fetchHistory} className="text-gray-500 hover:text-white p-2">
                  <RefreshCw size={14} />
                </button>
              </div>
              {historyLoading ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw size={20} className="animate-spin text-amber-500" />
                </div>
              ) : orderHistory.length === 0 ? (
                <div className="text-center py-16">
                  <History size={32} className="text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No orders yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orderHistory.map((order) => {
                    const pmRaw = (order.payment_method || '').toLowerCase()
                    const pmLabel =
                      pmRaw === 'cash'
                        ? 'Cash'
                        : pmRaw === 'card' || pmRaw === 'bank_pos'
                          ? 'Bank POS'
                          : pmRaw === 'credit'
                            ? 'Credit'
                            : pmRaw.startsWith('transfer')
                              ? 'Transfer'
                              : pmRaw === 'split'
                                ? 'Split'
                                : pmRaw || '—'
                    const activeItems = (order.order_items || []).filter(
                      (i) =>
                        !(i as unknown as { return_requested?: boolean }).return_requested &&
                        !(i as unknown as { return_accepted?: boolean }).return_accepted
                    )
                    const itemCount = activeItems.reduce((s, i) => s + (i.quantity || 0), 0)
                    const displayTotal = activeItems.reduce((s, i) => s + (i.total_price || 0), 0)
                    return (
                      <div
                        key={order.id}
                        className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
                      >
                        <div className="px-4 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-white font-semibold text-sm">
                              {order.customer_name || 'POS Sale'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-gray-500 text-xs">
                                {new Date(order.closed_at || order.created_at).toLocaleTimeString(
                                  'en-NG',
                                  { hour: '2-digit', minute: '2-digit', hour12: true }
                                )}
                              </span>
                              <span className="text-gray-700 text-xs">|</span>
                              <span className="text-gray-400 text-xs">{pmLabel}</span>
                              <span className="text-gray-700 text-xs">|</span>
                              <span className="text-gray-500 text-xs">
                                {itemCount} item{itemCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <PriceDisplay
                            amount={displayTotal}
                            className="text-amber-400 font-bold"
                            sspClassName="text-[10px] text-amber-400/50"
                          />
                        </div>
                        {activeItems.length > 0 && (
                          <div className="px-4 py-2.5 bg-gray-950 border-t border-gray-800">
                            <table className="w-full text-xs">
                              <tbody>
                                {activeItems.map((item) => (
                                  <tr key={item.id}>
                                    <td className="text-gray-500 py-0.5 pr-2 w-8 text-right">
                                      {item.quantity}x
                                    </td>
                                    <td className="text-gray-300 py-0.5">
                                      {(item as unknown as { menu_items?: { name: string } })
                                        .menu_items?.name || 'Item'}
                                    </td>
                                    <td className="text-gray-400 py-0.5 text-right pl-2">
                                      {formatPrice(item.total_price || 0)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {posTab === 'shift' && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-lg mx-auto p-4">
              {shiftLoading ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw size={20} className="animate-spin text-amber-500" />
                </div>
              ) : !shiftStats ? (
                <div className="text-center py-16">
                  <Clock size={32} className="text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No shift data available</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-white text-lg font-bold">My Shift Summary</h2>
                      <p className="text-gray-500 text-xs">
                        {profile?.full_name} —{' '}
                        {new Date().toLocaleDateString('en-NG', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <button onClick={fetchShiftStats} className="text-gray-500 hover:text-white p-2">
                      <RefreshCw size={14} />
                    </button>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                          <Clock size={18} className="text-green-400" />
                        </div>
                        <div>
                          <p className="text-gray-500 text-[10px] uppercase tracking-wider">
                            Clocked In
                          </p>
                          <p className="text-white font-bold text-lg">
                            {shiftStats.clockIn
                              ? new Date(shiftStats.clockIn).toLocaleTimeString('en-NG', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true,
                                })
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/30 rounded-2xl p-5 mb-4 text-center">
                    <p className="text-amber-400/70 text-[10px] uppercase tracking-widest mb-1">
                      Total Sales
                    </p>
                    <PriceDisplay
                      amount={shiftStats.totalSales}
                      className="text-amber-400 text-4xl font-bold tracking-tight"
                      sspClassName="text-[12px] text-amber-400/50"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 text-center">
                      <p className="text-2xl font-bold text-blue-400">{shiftStats.ordersCount}</p>
                      <p className="text-gray-500 text-[10px] uppercase tracking-wider mt-0.5">
                        Orders
                      </p>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-3 text-center">
                      <p className="text-2xl font-bold text-purple-400">{shiftStats.totalItems}</p>
                      <p className="text-gray-500 text-[10px] uppercase tracking-wider mt-0.5">
                        Items
                      </p>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3 text-center">
                      <p className="text-2xl font-bold text-green-400">{shiftStats.ordersCount}</p>
                      <p className="text-gray-500 text-[10px] uppercase tracking-wider mt-0.5">
                        Orders
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile cart bottom bar */}
      {posTab === 'pos' && cartCount > 0 && (
        <div className="md:hidden bg-gray-900 border-t border-gray-800 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-white font-bold">
              {cartCount} item{cartCount !== 1 ? 's' : ''}
            </p>
            <PriceDisplay
              amount={cartTotal}
              className="text-amber-400 font-bold"
              sspClassName="text-[10px] text-amber-400/50"
            />
          </div>
          <button
            onClick={handlePay}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-2.5 rounded-xl text-sm transition-colors"
          >
            Pay — {formatPrice(cartTotal)}
          </button>
        </div>
      )}

      {showPayment && pendingOrderRef.current && (
        <PaymentModal
          sale={pendingOrderRef.current as any}
          onSuccess={handlePaymentSuccess}
          onClose={handlePaymentClose}
        />
      )}

      {showReceipt && paidOrder && (
        <ReceiptModal
          order={paidOrder as any}
          items={[]}
          staffName={profile?.full_name || ''}
          autoPrint={false}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  )
}

interface HistoryOrder {
  id: string
  total_amount: number
  payment_method?: string | null
  status: string
  order_type: string
  created_at: string
  closed_at?: string | null
  customer_name?: string | null
  notes?: string | null
  order_items?: (OrderItem & { menu_items?: { name: string } | null })[]
}

interface ShiftOrder {
  id: string
  total_amount?: number
  closed_at: string
  order_items: {
    quantity: number
    total_price?: number | null
    status?: string | null
    return_requested?: boolean | null
    return_accepted?: boolean | null
    menu_items?: { name: string } | null
  }[]
  netTotal?: number
}

interface ShiftStats {
  clockIn?: string
  ordersCount: number
  totalSales: number
  totalItems: number
  recentOrders: ShiftOrder[]
}

function CartPanel({
  cart,
  cartTotal,
  cartCount,
  notes,
  setNotes,
  onAdd,
  onRemove,
  onDelete,
  onPay,
}: {
  cart: CartItem[]
  cartTotal: number
  cartCount: number
  notes: string
  setNotes: (v: string) => void
  onAdd: (item: any) => void
  onRemove: (id: string) => void
  onDelete: (id: string) => void
  onPay: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 shrink-0">
        <h2 className="text-white font-bold">Cart</h2>
        <span className="text-gray-400 text-xs">
          {cartCount} item{cartCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 ? (
          <div className="text-center py-16 text-gray-600 text-sm">
            Tap items from the menu to add them here
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.id} className="bg-gray-800 rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white text-sm font-medium flex-1 mr-2 truncate">
                  {item.name}
                </span>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-red-400 hover:text-red-300 shrink-0 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onRemove(item.id)}
                    className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white active:scale-95 transition-transform"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-white text-base font-bold w-6 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => onAdd(item)}
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

      {cart.length > 0 && (
        <div className="border-t border-gray-800 p-3 space-y-3 shrink-0">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Order notes..."
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Total</span>
            <PriceDisplay
              amount={cartTotal}
              className="text-amber-400 font-bold text-xl"
              sspClassName="text-[10px] text-amber-400/60"
            />
          </div>
          <button
            onClick={onPay}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition-colors"
          >
            <Send size={16} /> Pay — {formatPrice(cartTotal)}
          </button>
        </div>
      )}
    </div>
  )
}
