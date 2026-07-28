import { useState, useEffect } from 'react'
import { ArrowLeft, Bell, AlertTriangle, Check, CheckCheck, Filter } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { audit } from '../../lib/audit'
import { useAuth } from '../../context/AuthContext'

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

interface Props {
  onBack: () => void
}

export default function StockAlerts({ onBack }: Props) {
  const { profile } = useAuth()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)

  const fetchAlerts = async () => {
    setLoading(true)
    const { data: dbAlerts } = await supabase
      .from('stock_alerts')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: items } = await supabase
      .from('item')
      .select('id, name, stock_quantity, min_stock_level')
      .gt('min_stock_level', 0)

    const dbMap = new Map<string, Alert>()
    if (dbAlerts) {
      for (const a of dbAlerts) {
        const key = a.item_id || a.item_name
        if (!dbMap.has(key)) dbMap.set(key, a)
      }
    }

    const computed: Alert[] = []
    if (items) {
      for (const item of items) {
        if (item.stock_quantity <= item.min_stock_level) {
          const existing = dbMap.get(item.id)
          if (existing) {
            computed.push(existing)
          } else {
            computed.push({
              id: `pending-${item.id}`,
              item_id: item.id,
              item_name: item.name,
              current_stock: item.stock_quantity,
              threshold: item.min_stock_level,
              type: item.stock_quantity === 0 ? 'out_of_stock' : 'low_stock',
              is_read: false,
              created_at: new Date().toISOString(),
            })
          }
          dbMap.delete(item.id)
        }
      }
    }

    for (const remaining of dbMap.values()) {
      if (remaining.is_read || showUnreadOnly) {
        if (showUnreadOnly && remaining.is_read) continue
      }
      computed.push(remaining)
    }

    setAlerts(computed)
    setLoading(false)
  }

  useEffect(() => {
    fetchAlerts()
  }, [showUnreadOnly])

  const syncAlerts = async () => {
    const { data: items } = await supabase
      .from('item')
      .select('id, name, stock_quantity, min_stock_level')
      .gt('min_stock_level', 0)

    if (!items) return

    for (const item of items) {
      if (item.stock_quantity <= item.min_stock_level) {
        const { data: existing } = await supabase
          .from('stock_alerts')
          .select('id')
          .eq('item_id', item.id)
          .eq('is_read', false)
          .maybeSingle()

        if (!existing) {
          await supabase.from('stock_alerts').insert({
            item_id: item.id,
            item_name: item.name,
            current_stock: item.stock_quantity,
            threshold: item.min_stock_level,
            type: item.stock_quantity === 0 ? 'out_of_stock' : 'low_stock',
            is_read: false,
          })
        }
      }
    }
    await audit({
      action: 'stock_alerts_sync',
      entity: 'stock_alerts',
      entityName: 'manual sync',
      performer: profile,
    })
    fetchAlerts()
  }

  const markAllRead = async () => {
    const unreadIds = alerts.filter((a) => !a.is_read && !a.id.startsWith('pending-')).map((a) => a.id)
    if (unreadIds.length > 0) {
      await supabase.from('stock_alerts').update({ is_read: true }).in('id', unreadIds)
    }
    for (const item of alerts.filter((a) => a.id.startsWith('pending-'))) {
      await supabase.from('stock_alerts').insert({
        item_id: item.item_id,
        item_name: item.item_name,
        current_stock: item.current_stock,
        threshold: item.threshold,
        type: item.type,
        is_read: true,
      })
    }
    await audit({
      action: 'stock_alerts_mark_all_read',
      entity: 'stock_alerts',
      entityName: 'mark all read',
      performer: profile,
    })
    fetchAlerts()
  }

  const markRead = async (alert: Alert) => {
    if (alert.id.startsWith('pending-')) {
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
    fetchAlerts()
  }

  const filtered = showUnreadOnly ? alerts.filter((a) => !a.is_read) : alerts

  return (
    <div className="min-h-full bg-gray-950">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Bell size={20} className="text-amber-400" />
                <h2 className="text-white text-xl font-bold">Stock Alerts</h2>
              </div>
              <p className="text-gray-400 text-sm mt-0.5">Monitor low stock and out-of-stock items</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showUnreadOnly
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600'
              }`}
            >
              <Filter size={14} />
              {showUnreadOnly ? 'Unread only' : 'All alerts'}
            </button>
            <button
              onClick={syncAlerts}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <AlertTriangle size={14} />
              Sync
            </button>
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <CheckCheck size={14} />
              Mark All Read
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Bell size={40} className="mx-auto mb-3 text-gray-700" />
            <p className="text-gray-500 text-sm">No stock alerts</p>
            <p className="text-gray-600 text-xs mt-1">All items are above their minimum stock levels</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Item</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Current Stock</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Threshold</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Created</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Read</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filtered.map((alert) => (
                    <tr key={alert.id} className={`hover:bg-gray-800/50 transition-colors ${!alert.is_read ? 'bg-amber-500/[0.02]' : ''}`}>
                      <td className="px-4 py-3 text-white font-medium">{alert.item_name}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${
                          alert.current_stock === 0 ? 'text-red-400' : 'text-amber-400'
                        }`}>
                          {alert.current_stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{alert.threshold}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                          alert.type === 'out_of_stock'
                            ? 'text-red-400 bg-red-500/10'
                            : 'text-amber-400 bg-amber-500/10'
                        }`}>
                          <AlertTriangle size={11} />
                          {alert.type === 'out_of_stock' ? 'OUT' : 'LOW'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(alert.created_at).toLocaleDateString('en-NG', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {alert.is_read ? (
                          <Check size={14} className="text-green-400" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!alert.is_read && (
                          <button
                            onClick={() => markRead(alert)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-colors"
                          >
                            <Check size={12} />
                            Mark Read
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
