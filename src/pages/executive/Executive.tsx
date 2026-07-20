import { useAuth } from '../../context/AuthContext'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { HelpTooltip } from '../../components/HelpTooltip'
import { RefreshCw, Building2 } from 'lucide-react'
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval'

import StatCards from './exec/StatCards'
import RevenueChart from './exec/RevenueChart'
import QuickActions from './exec/QuickActions'
import RecentOrders from './exec/RecentOrders'

import type { MallShop, MallRentPayment } from '../../types'

interface Stats {
  revenue: number
  openOrders: number
  lowStock: number
  staffOnDuty: number
}
interface TrendDay {
  day: string
  revenue: number
  orders: number
}

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'
}

function getSessionWindow() {
  const now = new Date()
  const lagosNow = new Date(
    now.toLocaleString('en-US', {
      timeZone: 'Africa/Lagos',
    })
  )
  const sessionStart = new Date(lagosNow)
  sessionStart.setHours(23, 0, 0, 0)
  if (lagosNow.getHours() < 23) {
    sessionStart.setDate(sessionStart.getDate() - 1)
  }
  const sessionEnd = new Date(sessionStart)
  sessionEnd.setDate(sessionEnd.getDate() + 1)
  return { sessionStart, sessionEnd, sessionStartIso: sessionStart.toISOString() }
}

const HELP_TIPS = [
  {
    id: 'exec-kpis',
    title: 'Live KPI Cards',
    description:
      "Real-time metrics: today's revenue, open orders, low stock count, and staff on duty. All cards refresh every 30 seconds and instantly on any database change.",
  },
  {
    id: 'exec-lowstock',
    title: 'Low Stock Alert',
    description:
      'A red button appears when any inventory item is at or below its minimum threshold. Tap it to jump to Inventory in Back Office to restock.',
  },
  {
    id: 'exec-recentorders',
    title: "Today's Orders Feed",
    description:
      "Shows today's orders — time, amount, and status badge (open = amber, paid = green). Tap Full Report to go to detailed Reports.",
  },
  {
    id: 'exec-quickactions',
    title: 'Quick Actions',
    description:
      'Shortcut tiles to Accounting, Reports, Back Office, and Management. Use these instead of navigating through the sidebar.',
  },
  {
    id: 'exec-peak',
    title: 'Peak Hour',
    description:
      'Shows the hour of the day that generated the most revenue over the last 7 days. Use this to plan staffing.',
  },
]

export default function Executive() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState<Stats>({
    revenue: 0,
    openOrders: 0,
    lowStock: 0,
    staffOnDuty: 0,
  })
  const [recentOrders, setRecentOrders] = useState<Record<string, unknown>[]>([])
  const [trendData, setTrendData] = useState<TrendDay[]>([])
  const [loading, setLoading] = useState(true)
  const [mallSummary, setMallSummary] = useState({
    totalShops: 0, occupiedShops: 0, vacantShops: 0,
    overdueCount: 0, paidCount: 0, totalRentDue: 0
  })

  const statsRefreshTimer = useRef<number | null>(null)
  const statsRefreshInFlight = useRef(false)
  const lastStatsFetchAt = useRef(0)

  const isVisible = () => document.visibilityState === 'visible'

  const fetchStats = useCallback(async () => {
    const { sessionStart, sessionEnd, sessionStartIso } = getSessionWindow()

    supabase.from('mall_shops').select('*, mall_rent_payments(*)').then(({ data }) => {
      if (!data) return
      const shops = data as unknown as (MallShop & { mall_rent_payments: MallRentPayment[] })[]
      const now = new Date()
      let overdue = 0, paid = 0
      for (const shop of shops) {
        if (!shop.is_occupied) continue
        const totalMonths = shop.mall_rent_payments.reduce((s, p) => s + p.months_paid, 0)
        if (totalMonths <= 0) { overdue++; continue }
        const lastPaid = new Date(shop.mall_rent_payments.reduce((latest, p) =>
          new Date(p.paid_at) > new Date(latest.paid_at) ? p : latest
        , shop.mall_rent_payments[0]).paid_at)
        const monthsPassed = (now.getFullYear() - lastPaid.getFullYear()) * 12 + (now.getMonth() - lastPaid.getMonth())
        const remaining = totalMonths - monthsPassed - 1
        const daysInto = now.getDate() - lastPaid.getDate()
        const daysLeft = remaining * 30 + (30 - daysInto)
        if (daysLeft >= 14) paid++
        else overdue++
      }
      setMallSummary({
        totalShops: shops.length, occupiedShops: shops.filter(s => s.is_occupied).length,
        vacantShops: shops.filter(s => !s.is_occupied).length,
        overdueCount: overdue, paidCount: paid,
        totalRentDue: shops.reduce((s, shop) => s + (shop.is_occupied ? shop.monthly_rent : 0), 0)
      })
    })

    const [ordersRes, stockRes, recentRes, revenueRes, trendRes, staffRes] =
      await Promise.all([
        supabase.from('orders').select('id').eq('status', 'open'),
        supabase.from('inventory').select('id, current_stock, minimum_stock').eq('is_active', true),
        supabase
          .from('orders')
          .select(
            'id, total_amount, status, order_type, created_at, profiles(full_name)'
          )
          .gte('created_at', sessionStartIso)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('orders')
          .select(
            'total_amount, order_items(total_price, return_requested, return_accepted, status)'
          )
          .eq('status', 'paid')
          .gte('closed_at', sessionStart.toISOString())
          .lt('closed_at', sessionEnd.toISOString()),
        supabase
          .from('orders')
          .select(
            'closed_at, total_amount, order_items(total_price, status, return_requested, return_accepted)'
          )
          .eq('status', 'paid')
          .gte('closed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('closed_at', { ascending: true }),
        supabase
          .from('staff_shifts')
          .select('id')
          .is('clock_out', null),
      ])
    setStats({
      revenue: (revenueRes.data || []).reduce((s: number, o: any) => {
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
      openOrders: ordersRes.data?.length || 0,
      lowStock: stockRes.data?.filter((i) => i.current_stock <= i.minimum_stock).length || 0,
      staffOnDuty: staffRes.data?.length || 0,
    })
    setRecentOrders((recentRes.data || []) as Record<string, unknown>[])
    const dayMap: Record<string, TrendDay> = {}
    ;(trendRes.data || []).forEach((o) => {
      const day = new Date(o.closed_at).toLocaleDateString('en-NG', {
        weekday: 'short',
        day: 'numeric',
      })
      if (!dayMap[day]) dayMap[day] = { day, revenue: 0, orders: 0 }
      const net = (o.order_items || [])
        .filter(
          (i: any) =>
            !i.return_requested &&
            !i.return_accepted &&
            (i.status || '').toLowerCase() !== 'cancelled'
        )
        .reduce((s: number, i: any) => s + (i.total_price || 0), 0)
      dayMap[day].revenue += net
      dayMap[day].orders++
    })
    setTrendData(Object.values(dayMap))
    setLoading(false)
  }, [])

  const scheduleFetchStats = useCallback(
    (maxFrequencyMs = 5000) => {
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
    scheduleFetchStats(0)
    supabase
      .from('settings')
      .select('id, value')
      .in('id', ['bank_name', 'bank_account_number', 'bank_account_name'])
      .then(({ data }) => {
        if (!data) return
        const map = Object.fromEntries(data.map((r) => [r.id, r.value]))
      })
    const ch = supabase
      .channel('executive-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () =>
        scheduleFetchStats(8000)
      )
      .subscribe()
    return () => {
      if (statsRefreshTimer.current) window.clearTimeout(statsRefreshTimer.current)
      supabase.removeChannel(ch)
    }
  }, [scheduleFetchStats])

  useVisibilityInterval(() => scheduleFetchStats(15000), 60_000, [scheduleFetchStats])

  const peakHour = (() => {
    const hourMap: Record<number, number> = {}
    recentOrders.forEach((o) => {
      const h = new Date(o.created_at as string).getHours()
      hourMap[h] = (hourMap[h] || 0) + 1
    })
    const peak = Object.entries(hourMap).sort((a, b) => Number(b[1]) - Number(a[1]))[0]
    if (!peak) return null
    const h = parseInt(peak[0])
    return `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`
  })()

  return (
    <div className="min-h-full bg-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 md:px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-sm md:text-base">Executive Dashboard</h1>
          <p className="text-gray-400 text-xs">
            Good {getGreeting()}, {profile?.full_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HelpTooltip storageKey="executive" tips={HELP_TIPS} />
          <button onClick={fetchStats} className="text-gray-400 hover:text-white">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6">
        <StatCards stats={stats} />

        {/* Mall Summary */}
        {mallSummary.totalShops > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={16} className="text-purple-400" />
              <h3 className="text-white font-semibold text-sm md:text-base">Mall Overview</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="bg-gray-900 rounded-2xl p-3 md:p-4 border border-gray-800">
                <p className="text-gray-500 text-xs">Total Shops</p>
                <p className="text-white text-lg font-bold mt-1">{mallSummary.totalShops}</p>
              </div>
              <div className="bg-gray-900 rounded-2xl p-3 md:p-4 border border-gray-800">
                <p className="text-gray-500 text-xs">Occupied</p>
                <p className="text-green-400 text-lg font-bold mt-1">{mallSummary.occupiedShops}</p>
              </div>
              <div className="bg-gray-900 rounded-2xl p-3 md:p-4 border border-gray-800">
                <p className="text-gray-500 text-xs">Vacant</p>
                <p className="text-gray-400 text-lg font-bold mt-1">{mallSummary.vacantShops}</p>
              </div>
              <div className="bg-gray-900 rounded-2xl p-3 md:p-4 border border-gray-800">
                <p className="text-gray-500 text-xs">Rent Paid</p>
                <p className="text-green-400 text-lg font-bold mt-1">{mallSummary.paidCount}</p>
              </div>
              <div className="bg-gray-900 rounded-2xl p-3 md:p-4 border border-gray-800">
                <p className="text-gray-500 text-xs">Overdue</p>
                <p className="text-red-400 text-lg font-bold mt-1">{mallSummary.overdueCount}</p>
              </div>
              <div className="bg-gray-900 rounded-2xl p-3 md:p-4 border border-gray-800">
                <p className="text-gray-500 text-xs">Total Rent/mo</p>
                <p className="text-amber-400 text-lg font-bold mt-1">₦{mallSummary.totalRentDue.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        <RevenueChart trendData={trendData} />
        <QuickActions />
        <RecentOrders
          orders={recentOrders as unknown as Parameters<typeof RecentOrders>[0]['orders']}
        />
      </div>
    </div>
  )
}
