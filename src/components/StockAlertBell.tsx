import { useState, useEffect, useRef } from 'react'
import { Bell, AlertTriangle, Check, Package } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Alert {
  id: string
  item_id: string
  item_name: string
  current_stock: number
  threshold: number
  type: 'low_stock' | 'out_of_stock'
  is_read: boolean
  created_at: string
}

export default function StockAlertBell() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchAlerts = async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { data: dbAlerts } = await supabase
      .from('stock_alerts')
      .select('*')
      .eq('is_read', false)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })

    const { data: items } = await supabase
      .from('item')
      .select('id, name, stock_quantity, min_stock_level')
      .gt('min_stock_level', 0)

    const computed: Alert[] = []
    if (items) {
      for (const item of items) {
        if (item.stock_quantity <= item.min_stock_level) {
          computed.push({
            id: `item-${item.id}`,
            item_id: item.id,
            item_name: item.name,
            current_stock: item.stock_quantity,
            threshold: item.min_stock_level,
            type: item.stock_quantity === 0 ? 'out_of_stock' : 'low_stock',
            is_read: false,
            created_at: new Date().toISOString(),
          })
        }
      }
    }

    const seen = new Set<string>()
    const merged: Alert[] = []
    for (const a of [...(dbAlerts || []), ...computed]) {
      const key = a.item_id || a.item_name
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(a)
      }
    }
    setAlerts(merged)
  }

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const markRead = async (alert: Alert) => {
    if (alert.id.startsWith('item-')) {
      await supabase.from('stock_alerts').insert({
        item_id: alert.item_id,
        item_name: alert.item_name,
        current_stock: alert.current_stock,
        threshold: alert.threshold,
        type: alert.type,
        is_read: true,
      })
    } else {
      await supabase.from('stock_alerts').update({ is_read: true }).eq('id', alert.id)
    }
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id))
  }

  const unreadCount = alerts.length

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        title="Stock Alerts"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <span className="text-white font-semibold text-sm">Stock Alerts</span>
            {unreadCount > 0 && (
              <span className="text-xs text-gray-400">{unreadCount} unread</span>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              <Package size={24} className="mx-auto mb-2 text-gray-600" />
              All stock levels are healthy
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {alerts.map((alert) => (
                <div key={alert.id} className="px-4 py-3 hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      alert.type === 'out_of_stock' ? 'bg-red-500/10' : 'bg-amber-500/10'
                    }`}>
                      <AlertTriangle size={14} className={
                        alert.type === 'out_of_stock' ? 'text-red-400' : 'text-amber-400'
                      } />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{alert.item_name}</p>
                      <p className="text-gray-400 text-xs mt-0.5">
                        Stock: <span className={
                          alert.type === 'out_of_stock' ? 'text-red-400' : 'text-amber-400'
                        }>{alert.current_stock}</span> / {alert.threshold}
                      </p>
                      <span className={`inline-block mt-1 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                        alert.type === 'out_of_stock'
                          ? 'text-red-400 bg-red-500/10'
                          : 'text-amber-400 bg-amber-500/10'
                      }`}>
                        {alert.type === 'out_of_stock' ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    </div>
                    <button
                      onClick={() => markRead(alert)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 transition-colors shrink-0"
                      title="Mark read"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
