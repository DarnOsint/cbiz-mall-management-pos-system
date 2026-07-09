import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard,
  ShoppingBag,
  AlertTriangle,
  Wine,
  ChefHat,
  Snowflake,
  Shield,
  RotateCcw,
  Package,
  Trophy,
  ThumbsUp,
  Printer,
  Wrench,
} from 'lucide-react'
import WaiterCalls from './WaiterCalls'
import ReturnedDrinksTab from './mgmt/ReturnedDrinksTab'
import ChillerTab from './mgmt/ChillerTab'
import StationSalesTab from './mgmt/StationSalesTab'
import { useLateOrders } from '../../hooks/useLateOrders'
import { HelpTooltip } from '../../components/HelpTooltip'

import OverviewTab from './mgmt/OverviewTab'
import OpenOrdersTab from './mgmt/OpenOrdersTab'
import ActivityLogTab from './mgmt/ActivityLogTab'
import VoidsTab from './mgmt/VoidsTab'
import ServiceRatingsTab from './mgmt/ServiceRatingsTab'
import PrintQueueTab from './mgmt/PrintQueueTab'
import PrinterSettingsTab from './mgmt/PrinterSettingsTab'
import PrintSetupTab from './mgmt/PrintSetupTab'

const sessionWindow = () => {
  const now = new Date()
  const lagosNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))
  const start = new Date(lagosNow)
  start.setHours(23, 0, 0, 0)
  if (lagosNow.getHours() < 23) start.setDate(start.getDate() - 1)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

const activityWindow = (dateStr: string) => {
  const lagosNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))
  const base = new Date(`${dateStr}T23:00:00+01:00`) // WAT no DST
  const todayStr = lagosNow.toISOString().slice(0, 10)
  if (dateStr === todayStr && lagosNow.getHours() < 23) {
    base.setDate(base.getDate() - 1)
  }
  const start = base
  const end = new Date(base)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'barsales', label: 'Bar Sales', icon: Wine },
  { id: 'kitchen', label: 'Kitchen Sales', icon: ChefHat },
  { id: 'chiller', label: 'Chiller', icon: Snowflake },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'voids', label: 'Voids', icon: AlertTriangle },
  { id: 'activity', label: 'Activity Log', icon: Shield },
  { id: 'printsetup', label: 'Print Setup', icon: Wrench },
  { id: 'printqueue', label: 'Print Queue', icon: Printer },
  { id: 'printers', label: 'Printers', icon: Printer },
] as const

type TabId = (typeof TABS)[number]['id']

interface Stats {
  openOrders: number
  occupiedTables: number
  todayRevenue: number
}
export default function Management() {
  useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const { lateOrders, threshold, markDelivered } = useLateOrders()

  const [activityDate, setActivityDate] = useState(() => new Date().toISOString().slice(0, 10))
  const activityRange = useMemo(() => {
    const { start, end } = activityWindow(activityDate)
    return { start: start.toISOString(), end: end.toISOString() }
  }, [activityDate])
  const [stats, setStats] = useState<Stats>({
    openOrders: 0,
    occupiedTables: 0,
    todayRevenue: 0,
  })

  const statsRefreshTimer = useRef<number | null>(null)
  const statsRefreshInFlight = useRef(false)
  const lastStatsFetchAt = useRef(0)
  const isVisible = () => document.visibilityState === 'visible'

  const fetchStats = useCallback(async () => {
    void supabase.rpc('free_orphaned_tables')
    const { start, end } = sessionWindow()
    const [ordersRes, tablesRes, revenueRes] = await Promise.all([
      supabase.from('orders').select('id').eq('status', 'open'),
      supabase.from('tables').select('id').eq('status', 'occupied'),
      supabase
        .from('orders')
        .select('total_amount, order_items(total_price, return_requested, return_accepted, status)')
        .eq('status', 'paid')
        .gte('closed_at', start.toISOString())
        .lt('closed_at', end.toISOString()),
    ])
    setStats({
      openOrders: ordersRes.data?.length || 0,
      occupiedTables: tablesRes.data?.length || 0,
      todayRevenue: (revenueRes.data || []).reduce((s: number, o: any) => {
        const net = (o.order_items || [])
          .filter(
            (i: any) =>
              !i.return_requested &&
              !i.return_accepted &&
              (i.status || '').toLowerCase() !== 'cancelled'
          )
          .reduce((ss: number, i: any) => ss + (i.total_price || 0), 0)
        return s + net
      }, 0),
    })
  }, [])

  const scheduleFetchStats = useCallback(
    (maxFrequencyMs = 8000) => {
      if (!isVisible()) return
      if (statsRefreshTimer.current) return
      const now = Date.now()
      const earliest = lastStatsFetchAt.current + maxFrequencyMs
      const delay = Math.max(0, earliest - now)
      statsRefreshTimer.current = window.setTimeout(async () => {
        statsRefreshTimer.current = null
        if (!isVisible()) return
        if (statsRefreshInFlight.current) return
        statsRefreshInFlight.current = true
        try {
          await fetchStats()
          lastStatsFetchAt.current = Date.now()
        } finally {
          statsRefreshInFlight.current = false
        }
      }, delay)
    },
    [fetchStats]
  )

  useEffect(() => {
    const _ms = document.getElementById('main-scroll')
    if (_ms) _ms.scrollTop = 0
  }, [activeTab])

  useEffect(() => {
    scheduleFetchStats(0)
    const iv = setInterval(() => scheduleFetchStats(15000), 60000)
    const ch = supabase
      .channel('management-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () =>
        scheduleFetchStats(10000)
      )
      .subscribe()
    return () => {
      clearInterval(iv)
      if (statsRefreshTimer.current) window.clearTimeout(statsRefreshTimer.current)
      supabase.removeChannel(ch)
    }
  }, [scheduleFetchStats])

  const helpTips = [
    {
      id: 'mgmt-overview',
      title: 'Overview',
      description:
        "Live dashboard: open orders, occupied tables, and today's revenue — all updating in real time. The late orders banner turns red when any order exceeds the alert threshold.",
    },
    {
      id: 'mgmt-orders',
      title: 'Orders Tab',
      description:
        'Live view of all open orders — table, waitron, items, and total. Use Force Close on any order that is stuck as open after payment has already been collected. Force Close marks all items as delivered so the KDS clears, frees the table, and closes the order cleanly.',
    },
    {
      id: 'mgmt-barsales',
      title: 'Bar Sales Tab',
      description:
        'Breakdown of bar revenue, items sold by category (drinks, wine, spirits), and per-waitron bar sales for the current session.',
    },
    {
      id: 'mgmt-kitchen',
      title: 'Kitchen Sales Tab',
      description:
        'Food revenue and items sold by category for the current session. Helps track kitchen throughput and popular dishes.',
    },
    {
      id: 'mgmt-chiller',
      title: 'Chiller Tab',
      description:
        'Daily bar stock register — opening stock, received, sold, voided, and calculated closing. Live POS sales auto-populate the sold column. Add new items directly from this tab.',
    },
    {
      id: 'mgmt-activity',
      title: 'Activity Log Tab',
      description:
        'Complete audit trail of everything that has happened: logins, orders placed and paid, voids, and settings changes. Filter by date, search by staff name or action. Exportable to CSV.',
    },

  ]

  return (
    <div className="min-h-full bg-gray-950">
      <WaiterCalls />

      {/* Late Orders Banner */}
      {lateOrders.length > 0 && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-400 animate-pulse" />
            <span className="text-red-400 font-bold text-sm">
              {lateOrders.length} overdue table{lateOrders.length > 1 ? 's' : ''} — pending over{' '}
              {threshold} mins
            </span>
          </div>
          <div className="space-y-2">
            {lateOrders.map((order) => {
              const pendingItems = (order.order_items || []).filter(
                (i: Record<string, unknown>) => i.status === 'pending'
              )
              const destinations = [
                ...new Set(
                  pendingItems
                    .map((i: Record<string, unknown>) => (i.destination as string)?.toUpperCase())
                    .filter(Boolean)
                ),
              ]
              const mins = Math.floor(
                (new Date().getTime() - new Date(order.created_at).getTime()) / 60000
              )
              return (
                <div
                  key={order.id}
                  className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-white text-sm font-bold">
                        {order.order_type === 'takeaway'
                          ? `Takeaway — ${order.customer_name || 'Guest'}`
                          : order.tables?.name || 'Table ?'}
                      </p>
                      <p className="text-red-300 text-xs mt-0.5">
                        {pendingItems.length} pending item{pendingItems.length > 1 ? 's' : ''} ·{' '}
                        {(destinations as string[]).join(', ')} · {mins} mins ago
                      </p>
                    </div>
                    <button
                      onClick={() => markDelivered(order.id)}
                      className="shrink-0 bg-green-500 hover:bg-green-400 text-black text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
                    >
                      Delivered
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-800 bg-gray-900 px-4 overflow-x-auto items-center">
        <div className="ml-auto pl-2 py-1 shrink-0">
          <HelpTooltip tips={helpTips} />
        </div>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.id
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === 'overview' && (
          <OverviewTab stats={stats} onTabChange={(id) => setActiveTab(id as TabId)} />
        )}
        {activeTab === 'orders' && <OpenOrdersTab />}
        {activeTab === 'barsales' && <StationSalesTab destination="bar" label="Bar" />}
        {activeTab === 'kitchen' && <StationSalesTab destination="kitchen" label="Kitchen" />}
        {activeTab === 'chiller' && <ChillerTab />}
        {activeTab === 'returns' && <ReturnedDrinksTab />}
        {activeTab === 'voids' && <VoidsTab />}
        {activeTab === 'activity' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <input
                type="date"
                value={activityDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setActivityDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => setActivityDate(new Date().toISOString().slice(0, 10))}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  activityDate === new Date().toISOString().slice(0, 10)
                    ? 'bg-amber-500 text-black'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => {
                  const d = new Date(activityDate)
                  d.setDate(d.getDate() - 1)
                  setActivityDate(d.toISOString().slice(0, 10))
                }}
                className="px-3 py-2 rounded-xl text-xs bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                Previous Day
              </button>
            </div>
            <ActivityLogTab dateRange={activityRange} />
          </div>
        )}
        {activeTab === 'settings' && (
          <SettingsTab threshold={threshold} setThreshold={setThreshold} />
        )}
        {activeTab === 'printsetup' && <PrintSetupTab />}
        {activeTab === 'printqueue' && <PrintQueueTab />}
        {activeTab === 'printers' && <PrinterSettingsTab />}
      </div>
    </div>
  )
}
