import { Plus, Minus, Trash2, Send } from 'lucide-react'
import type { Item, Profile } from '../../types'
import { formatPrice } from '../../lib/currency'
import PriceDisplay from '../../components/PriceDisplay'
import { useMemo } from 'react'

interface CartEntry {
  item: Item
  quantity: number
}

interface Props {
  cart: CartEntry[]
  onUpdateQuantity: (itemId: string, delta: number) => void
  onRemoveItem: (itemId: string) => void
  notes: string
  onNotesChange: (notes: string) => void
  onPlaceOrder: () => void
  profile: Profile | null
}

export default function SalePanel({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  notes,
  onNotesChange,
  onPlaceOrder,
  profile,
}: Props) {
  const { grandTotal } = useMemo(() => {
    let gt = 0
    for (const entry of cart) {
      gt += entry.item.price * entry.quantity
    }
    return { grandTotal: gt }
  }, [cart])

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 shrink-0">
        <h2 className="text-white font-bold text-sm">Current Sale</h2>
        <span className="text-gray-500 text-xs">
          {cart.reduce((s, e) => s + e.quantity, 0)} item{cart.reduce((s, e) => s + e.quantity, 0) !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-16">
            <div className="w-14 h-14 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-3">
              <ShoppingBagIcon />
            </div>
            <p className="text-gray-400 text-sm font-medium mb-1">Cart is empty</p>
            <p className="text-gray-600 text-xs">Tap items on the left to add them</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {cart.map((entry) => (
              <div
                key={entry.item.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onUpdateQuantity(entry.item.id, -1)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-white text-sm w-6 text-center font-medium">
                    {entry.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateQuantity(entry.item.id, 1)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{entry.item.name}</p>
                  <p className="text-gray-500 text-xs">{formatPrice(entry.item.price)} each</p>
                </div>
                <span className="text-amber-400 text-sm font-bold shrink-0">
                  {formatPrice(entry.item.price * entry.quantity)}
                </span>
                <button
                  onClick={() => onRemoveItem(entry.item.id)}
                  className="text-red-400 hover:text-red-300 shrink-0 ml-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-800 px-4 py-3 shrink-0">
        <input
          type="text"
          placeholder="Sale notes..."
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 mb-3"
        />
        <div className="flex justify-between items-center mb-3">
          <span className="text-gray-400 text-sm font-bold">Total</span>
          <PriceDisplay
            amount={grandTotal}
            className="text-white font-bold text-lg"
            sspClassName="text-[10px] text-gray-400"
          />
        </div>
        <button
          onClick={onPlaceOrder}
          disabled={cart.length === 0}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition-colors"
        >
          <Send size={16} /> Place Sale
        </button>
      </div>
    </div>
  )
}

function ShoppingBagIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <line x1="3" x2="21" y1="6" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}
