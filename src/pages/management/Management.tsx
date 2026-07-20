import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard,
  ShoppingBag,
  AlertTriangle,
  Shield,
  Printer,
  Wrench,
} from 'lucide-react'
import { HelpTooltip } from '../../components/HelpTooltip'

import OverviewTab from './mgmt/OverviewTab'
import OpenOrdersTab from './mgmt/OpenOrdersTab'
import ActivityLogTab from './mgmt/ActivityLogTab'
import VoidsTab from './mgmt/VoidsTab'
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
  const base = new Date(`${dateStr}T23:00:00+01:00`)
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
  { id: 'voids', label: 'Voids', icon: AlertTriangle },
  { id: 'activity', label: 'Activity Log', icon: Shield },
  { id: 'printsetup', label: 'Print Setup', icon: Wrench },
  { id: 'printqueue', label: 'Print Queue', icon: Printer },
  { id: 'printers', label: 'Printers', icon: Printer },
] as const

type TabId = (typeof TABS)[number]['id']

interface Stats {
  openOrders: number
  todayRevenue: number
}
export default function Management() {
  useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const [activityDate, setActivityDate] = useState(() => new Date().toISOString().slice(0, 10))
  const activityRange = useMemo(() => {
    const { start, end } = activityWindow(activityDate)
    return { start: start.toISOString(), end: end.toISOString() }
  }, [activityDate])
  const [stats, setStats] = useState<Stats>({
    openOrders: 0,
    todayRevenue: 0,
  })

  const statsRefreshTimer = useRef<number | null>(null)
  const statsRefreshInFlight = useRef(false)
  const lastStatsFetchAt = useRef(0)
  const isVisible = () => document.visibilityState === 'visible'

  const fetchStats = useCallback(async () => {
    const { start, end } = sessionWindow()
    const [ordersRes, revenueRes] = await Promise.all([
      supabase.from('orders').select('id').eq('status', 'open'),
      supabase
        .from('orders')
        .select('total_amount, order_items(total_price, return_requested, return_accepted, status)')
        .eq('status', 'paid')
        .gte('closed_at', start.toISOString())
        .lt('closed_at', end.toISOString()),
    ])
    setStats({
      openOrders: ordersRes.data?.length || 0,
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
        "Live dashboard: open orders and today's revenue — all updating in real time.",
    },
    {
      id: 'mgmt-orders',
      title: 'Orders Tab',
      description:
        'Live view of all open orders. Use Force Close on any order that is stuck as open after payment has already been collected.',
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
        {activeTab === 'printsetup' && <PrintSetupTab />}
        {activeTab === 'printqueue' && <PrintQueueTab />}
        {activeTab === 'printers' && <PrinterSettingsTab />}
      </div>
    </div>
  )
}
