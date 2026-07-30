import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatPrice } from '../lib/currency'
import type { Sale, SaleItem } from '../types'

interface ActiveSale extends Sale {
  order_items?: SaleItem[]
}

function getBusinessName(): string {
  try {
    const raw = localStorage.getItem('receiptSettings')
    if (raw) {
      const parsed = JSON.parse(raw)
      return parsed.shopName || 'C.Biz POS'
    }
  } catch {}
  return 'C.Biz POS'
}

export default function CustomerDisplay() {
  const [sale, setSale] = useState<ActiveSale | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      document.documentElement.requestFullscreen()
    } catch {}
  }, [])

  useEffect(() => {
    const fetchLatestSale = async () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('status', ['open', 'paid'])
        .gte('created_at', fiveMinAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setSale(data as ActiveSale | null)
      setLoading(false)
    }
    fetchLatestSale()
    const interval = setInterval(fetchLatestSale, 3000)
    return () => clearInterval(interval)
  }, [])

  const businessName = getBusinessName()

  const items = sale?.order_items ?? []
  const total = items.reduce(
    (sum, item) => sum + (item.total_price || item.unit_price * item.quantity),
    0
  )

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center h-full py-16">
        <div className="space-y-4 w-full max-w-md px-4">
          <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-800 rounded animate-pulse w-1/2" />
          <div className="h-10 bg-gray-800 rounded animate-pulse w-full" />
          <div className="h-10 bg-gray-800 rounded animate-pulse w-full" />
          <div className="h-4 bg-gray-800 rounded animate-pulse w-2/3" />
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center p-8 select-none">
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 text-center">
          {businessName}
        </h1>
        <p className="text-xl md:text-2xl text-gray-400">
          Waiting for your order...
        </p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col p-6 md:p-10 select-none">
      <div className="text-center mb-6 md:mb-10 shrink-0">
        <h1 className="text-3xl md:text-5xl font-bold text-white">
          {businessName}
        </h1>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-white">
            <thead>
              <tr className="text-gray-400 text-xl md:text-2xl border-b border-gray-800">
                <th className="text-left pb-4 font-medium">Item</th>
                <th className="text-center pb-4 font-medium w-20">Qty</th>
                <th className="text-right pb-4 font-medium w-36">Price</th>
                <th className="text-right pb-4 font-medium w-36">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-800/40"
                >
                  <td className="py-4 md:py-5 text-2xl md:text-3xl font-medium">
                    {(item as any).menu_items?.name || (item as any).item_name || 'Item'}
                  </td>
                  <td className="py-4 md:py-5 text-center text-2xl md:text-3xl">
                    {item.quantity}
                  </td>
                  <td className="py-4 md:py-5 text-right text-xl md:text-2xl text-gray-300">
                    {formatPrice(item.unit_price)}
                  </td>
                  <td className="py-4 md:py-5 text-right text-xl md:text-2xl text-amber-400 font-semibold">
                    {formatPrice(item.total_price || item.unit_price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-gray-700 mt-4 md:mt-6 pt-4 md:pt-6 shrink-0">
        <div className="flex justify-between items-center">
          <span className="text-3xl md:text-4xl font-bold text-white">
            Total
          </span>
          <span className="text-3xl md:text-4xl font-bold text-amber-400">
            {formatPrice(total)}
          </span>
        </div>
      </div>
    </div>
  )
}
