import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  Users,
  LayoutDashboard,
  ShoppingBag,
  Clock,
  AlertTriangle,
  UtensilsCrossed,
  Shield,
  RotateCcw,
  Package,
  Trophy,
} from 'lucide-react'
import ShiftManager from './ShiftManager'
import TableAssignment from './TableAssignment'
import WaiterCalls from './WaiterCalls'
import ReturnedDrinksTab from './mgmt/ReturnedDrinksTab'
import ChillerTab from './mgmt/ChillerTab'
import StaffPerformanceTab from './mgmt/StaffPerformanceTab'
import StationSalesTab from './mgmt/StationSalesTab'
import { useLateOrders } from '../../hooks/useLateOrders'
import { HelpTooltip } from '../../components/HelpTooltip'

import OverviewTab from './mgmt/OverviewTab'
import OpenOrdersTab from './mgmt/OpenOrdersTab'
import ActivityLogTab from './mgmt/ActivityLogTab'
import ShiftReport from './mgmt/ShiftReport'
import ExpensesTab from './mgmt/ExpensesTab'
import SalesByCategory from './mgmt/SalesByCategory'

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
  { id: 'sales', label: 'Sales', icon: ShoppingBag },
  { id: 'activity', label: 'Activity Log', icon: Shield },
  { id: 'shift', label: 'Shift Report', icon: ReceiptText },
  { id: 'expenses', label: 'Expenses', icon: TrendingDown },
  { id: 'category', label: 'Sales by Category', icon: PieChart },
] as const

type TabId = (typeof TABS)[number]['id']

interface Stats {
  openSales: number
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
    openSales: 0,
    todayRevenue: 0,
  })

  const statsRefreshTimer = useRef<number | null>(null)
  const statsRefreshInFlight = useRef(false)
  const lastStatsFetchAt = useRef(0)
  const isVisible = () => document.visibilityState === 'visible'

  const fetchStats = useCallback(async () => {
    const { start, end } = sessionWindow()
    const [salesRes, revenueRes] = await Promise.all([
      supabase.from('orders').select('id').eq('status', 'open'),
      supabase
        .from('orders')
        .select('total_amount, order_items(total_price, return_requested, return_accepted, status)')
        .eq('status', 'paid')
        .gte('closed_at', start.toISOString())
        .lt('closed_at', end.toISOString()),
    ])
    setStats({
      openSales: salesRes.data?.length || 0,
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
        "Live dashboard: open sales and today's revenue — all updating in real time.",
    },
    {
      id: 'mgmt-sales',
      title: 'Sales',
      description: 'View and manage open sales.',
    },
    {
      id: 'mgmt-activity',
      title: 'Activity Log',
      description: 'Full audit trail of all actions, filterable by date.',
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
        {activeTab === 'sales' && <OpenOrdersTab />}
        {activeTab === 'shift' && <ShiftReport />}
        {activeTab === 'expenses' && <ExpensesTab />}
        {activeTab === 'category' && <SalesByCategory />}
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
        {!activeTab && (
          <div className="flex items-center justify-center h-full py-20 text-gray-600">
            <p>Select a tab to view</p>
          </div>
        )}
      </div>
    </div>
  )
}
