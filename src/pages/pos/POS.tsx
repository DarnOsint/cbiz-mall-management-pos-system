import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/currency'
import PriceDisplay from '../../components/PriceDisplay'
import { audit } from '../../lib/audit'
import { useAuth } from '../../context/AuthContext'
import {
  LogOut,
  ShoppingCart,
  RefreshCw,
  ShoppingBag,
  Search,
  X,
} from 'lucide-react'
import OrderPanel from './OrderPanel'
import ReceiptModal from './ReceiptModal'
import PaymentModal from './PaymentModal'
import CashSaleModal from './CashSaleModal'
import type { Item, ItemCategory, Order, OrderItem, Profile } from '../../types'
import { useToast } from '../../context/ToastContext'

interface CartEntry {
  item: Item
  quantity: number
}

interface ActiveOrderWithItems extends Order {
  order_items?: (OrderItem & {
    items?: Pick<Item, 'name' | 'price'> | null
  })[]
}

export default function POS() {
  const { profile, signOut } = useAuth()
  const toast = useToast()

  const [items, setItems] = useState<Item[]>([])
  const [menuError, setMenuError] = useState<string | null>(null)
  const [categories, setCategories] = useState<ItemCategory[]>([])
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')

  const [showPayment, setShowPayment] = useState(false)
  const [activeOrder, setActiveOrder] = useState<ActiveOrderWithItems | null>(null)
  const [showCashSale, setShowCashSale] = useState(false)
  const [reprintOrder, setReprintOrder] = useState<Order | null>(null)
  const [mobileView, setMobileView] = useState<'items' | 'cart'>('items')

  const placingOrderRef = useRef(false)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    setLoading(true)
    setMenuError(null)
    const { data, error } = await supabase
      .from('items')
      .select('*, item_categories(name, id, sort_order, is_active)')
      .eq('is_active', true)
      .order('sort_order', { nullsFirst: false })
      .order('name')
    if (error) {
      setMenuError(error.message)
      setLoading(false)
      return
    }
    if (data) {
      setItems(data as Item[])
      const catMap = new Map<string, ItemCategory>()
      for (const item of data) {
        const cat = (item as any).item_categories as ItemCategory | undefined
        if (cat && cat.id && !catMap.has(cat.id)) {
          catMap.set(cat.id, cat)
        }
      }
      setCategories(Array.from(catMap.values()).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
    }
    setLoading(false)
  }

  const filteredItems = items.filter((item) => {
    const cat = (item as any).item_categories as ItemCategory | undefined
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || (item.sku && item.sku.toLowerCase().includes(search.toLowerCase()))
    const matchCat = activeCategory === 'All' || cat?.name === activeCategory
    return matchSearch && matchCat && item.is_available
  })

  const addToCart = (item: Item) => {
    setCart((prev) => {
      const existing = prev.find((e) => e.item.id === item.id)
      if (existing) {
        return prev.map((e) =>
          e.item.id === item.id ? { ...e, quantity: e.quantity + 1 } : e
        )
      }
      return [...prev, { item, quantity: 1 }]
    })
    setMobileView('cart')
  }

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((e) => e.item.id === itemId)
      if (!existing) return prev
      const newQty = existing.quantity + delta
      if (newQty <= 0) return prev.filter((e) => e.item.id !== itemId)
      return prev.map((e) =>
        e.item.id === itemId ? { ...e, quantity: newQty } : e
      )
    })
  }

  const removeItem = (itemId: string) => {
    setCart((prev) => prev.filter((e) => e.item.id !== itemId))
  }

  const cartTotal = cart.reduce((sum, e) => sum + e.item.price * e.quantity, 0)
  const cartItemCount = cart.reduce((sum, e) => sum + e.quantity, 0)

  const handlePlaceOrder = async () => {
    if (placingOrderRef.current || cart.length === 0 || !profile) return
    placingOrderRef.current = true
    try {
      const orderId = crypto.randomUUID()
      const orderRecord = {
        id: orderId,
        staff_id: profile.id,
        order_type: 'sale' as const,
        status: 'open' as const,
        total_amount: cartTotal,
        notes: notes || null,
        created_at: new Date().toISOString(),
      }
      const { error: orderError } = await supabase.from('orders').insert(orderRecord)
      if (orderError) {
        toast.error('Error', 'Failed to create order: ' + orderError.message)
        return
      }
      const orderItemRows = cart.map((entry) => ({
        id: crypto.randomUUID(),
        order_id: orderId,
        item_id: entry.item.id,
        name: entry.item.name,
        quantity: entry.quantity,
        unit_price: entry.item.price,
        total_price: entry.item.price * entry.quantity,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
      }))
      for (const row of orderItemRows) {
        const { error } = await supabase.from('order_items').insert(row)
        if (error) {
          toast.error('Error', 'Failed to add item: ' + error.message)
          return
        }
      }
      await audit({
        action: 'ORDER_CREATED',
        entity: 'order',
        entityId: orderId,
        entityName: 'Sale',
        newValue: { total: cartTotal, items: cart.length },
        performer: profile as Profile,
      })
      const { data: freshOrder } = await supabase
        .from('orders')
        .select('*, order_items(*, items(name, price))')
        .eq('id', orderId)
        .single()
      if (freshOrder) {
        setActiveOrder(freshOrder as ActiveOrderWithItems)
        setShowPayment(true)
      }
    } catch (err) {
      toast.error('Error', 'Order failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      placingOrderRef.current = false
    }
  }

  const handlePaymentSuccess = () => {
    setShowPayment(false)
    setActiveOrder(null)
    setCart([])
    setNotes('')
    setMobileView('items')
  }

  const openCashSale = () => {
    setShowCashSale(true)
  }

  if (loading) {
    return (
      <div className="min-h-full bg-gray-950 flex items-center justify-center">
        <div className="text-amber-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col">
      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3 shrink-0 z-40">
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
              onClick={() => openCashSale()}
              className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-2.5 py-2 rounded-xl transition-colors"
            >
              <ShoppingBag size={13} />
              <span className="hidden sm:inline">Cash Sale</span>
            </button>
            <button
              onClick={fetchItems}
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

      <div className="flex-1 flex overflow-hidden">
        <div className="hidden md:flex flex-1 flex-col overflow-hidden">
          <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto border-b border-gray-800 shrink-0 bg-gray-900/50">
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
          <div className="flex px-4 py-2 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2 flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 focus-within:border-amber-500 transition-colors">
              <Search size={16} className="text-gray-500 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
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
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-4">
                  <ShoppingBag size={24} className="text-gray-600" />
                </div>
                <p className="text-gray-400 font-semibold mb-1">No items found</p>
                {menuError ? (
                  <div className="text-red-400 text-xs max-w-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {menuError}
                  </div>
                ) : (
                  <p className="text-gray-600 text-xs max-w-xs">
                    {items.length === 0
                      ? 'Add items in the Back Office to get started.'
                      : 'Try a different search or category.'}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {filteredItems.map((item) => {
                  const cartEntry = cart.find((e) => e.item.id === item.id)
                  return (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className="rounded-xl overflow-hidden text-left transition-all border active:scale-[0.97] bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-amber-500/50 relative"
                    >
                      <div className="p-3">
                        <p className="text-white text-sm font-medium leading-tight truncate">
                          {item.name}
                        </p>
                        <p className="text-amber-400 text-sm font-bold mt-1">
                          {formatPrice(item.price)}
                        </p>
                        {item.stock_quantity <= item.low_stock_threshold && item.stock_quantity > 0 && (
                          <p className="text-orange-400 text-[10px] mt-0.5">Low stock</p>
                        )}
                        {item.stock_quantity === 0 && (
                          <p className="text-red-400 text-[10px] mt-0.5">Out of stock</p>
                        )}
                      </div>
                      {cartEntry && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
                          {cartEntry.quantity}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="hidden md:flex w-[340px] min-w-[280px] border-l border-gray-800 flex-col overflow-hidden">
          <OrderPanel
            cart={cart}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            notes={notes}
            onNotesChange={setNotes}
            onPlaceOrder={handlePlaceOrder}
            profile={profile}
          />
        </div>

        <div className="md:hidden flex-1 flex flex-col overflow-hidden">
          {mobileView === 'items' ? (
            <>
              <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-gray-800 shrink-0 bg-gray-900/50">
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
              <div className="flex px-3 py-2 border-b border-gray-800 shrink-0">
                <div className="flex items-center gap-2 flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 focus-within:border-amber-500 transition-colors">
                  <Search size={16} className="text-gray-500 shrink-0" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search items..."
                    className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="text-gray-500 hover:text-white">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <ShoppingBag size={24} className="text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm">No items found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredItems.map((item) => {
                      const cartEntry = cart.find((e) => e.item.id === item.id)
                      return (
                        <button
                          key={item.id}
                          onClick={() => addToCart(item)}
                          className="rounded-xl overflow-hidden text-left transition-all border active:scale-[0.97] bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-amber-500/50 relative"
                        >
                          <div className="p-3">
                            <p className="text-white text-sm font-medium leading-tight truncate">
                              {item.name}
                            </p>
                            <p className="text-amber-400 text-sm font-bold mt-1">
                              {formatPrice(item.price)}
                            </p>
                          </div>
                          {cartEntry && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
                              {cartEntry.quantity}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              {cart.length > 0 && (
                <div className="shrink-0 border-t border-gray-800 bg-gray-900 p-3">
                  <button
                    onClick={() => setMobileView('cart')}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition-colors"
                  >
                    <ShoppingCart size={16} />
                    View Cart ({cartItemCount}) — {formatPrice(cartTotal)}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 shrink-0">
                <button
                  onClick={() => setMobileView('items')}
                  className="text-amber-500 text-sm font-medium"
                >
                  ← Items
                </button>
                <span className="text-white font-bold text-sm">Cart ({cartItemCount})</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <OrderPanel
                  cart={cart}
                  onUpdateQuantity={updateQuantity}
                  onRemoveItem={removeItem}
                  notes={notes}
                  onNotesChange={setNotes}
                  onPlaceOrder={handlePlaceOrder}
                  profile={profile}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {showPayment && activeOrder && (
        <PaymentModal
          order={activeOrder as any}
          onSuccess={handlePaymentSuccess}
          onClose={() => {
            setShowPayment(false)
            setActiveOrder(null)
          }}
        />
      )}

      {showCashSale && (
        <CashSaleModal
          staffId={profile!.id}
          onSuccess={() => setShowCashSale(false)}
          onClose={() => setShowCashSale(false)}
        />
      )}

      {reprintOrder && (
        <ReceiptModal
          order={reprintOrder}
          items={(reprintOrder.order_items || []) as OrderItem[]}
          staffName={profile?.full_name || ''}
          autoPrint={false}
          onClose={() => setReprintOrder(null)}
        />
      )}
    </div>
  )
}
