import { useAuth } from '../../context/AuthContext'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { HelpTooltip } from '../../components/HelpTooltip'
import { RefreshCw } from 'lucide-react'
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval'

import StatCards from './exec/StatCards'
import RevenueChart from './exec/RevenueChart'
import QuickActions from './exec/QuickActions'
import RecentOrders from './exec/RecentOrders'

import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'

interface Stats {
  revenue: number
  openOrders: number
  occupiedTables: number
  totalTables: number
  staffOnDuty: number
  lowStock: number
  foodItems: number
  drinkItems: number
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

// Accounting session: 08:00 WAT previous day → 08:00 WAT current day
function getSessionWindow() {
  const now = new Date()
  const lagosNow = new Date(
    now.toLocaleString('en-US', {
      timeZone: 'Africa/Lagos',
    })
  )
  const sessionStart = new Date(lagosNow)
  sessionStart.setHours(8, 0, 0, 0)
  if (lagosNow.getHours() < 8) {
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
      "Five real-time metrics: today's revenue, open orders, occupied tables, staff on duty, and low stock count. All cards refresh every 30 seconds and instantly on any database change. Staff on duty is deduplicated — one person always counts as one even if clocked in multiple times.",
  },
  {
    id: 'exec-bank',
    title: 'Bank Transfer Details',
    description:
      'Set the venue bank name, account number, and account name. These details appear on the POS payment screen whenever a customer selects Bank Transfer — your waitron can show it to the customer for instant transfer.',
  },
  {
    id: 'exec-lowstock',
    title: 'Low Stock Alert',
    description:
      'A red button appears when any inventory item is at or below its minimum threshold. Tap it to jump to Inventory in Back Office to restock. The count updates in real time.',
  },
  {
    id: 'exec-recentorders',
    title: "Today's Orders Feed",
    description:
      "Shows today's orders — table name, assigned waitron, time, amount, and status badge (open = amber, paid = green). Paid orders from previous days no longer appear here. Tap Full Report to go to detailed Reports.",
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
      'Shows the hour of the day that generated the most revenue over the last 7 days. Use this to plan staffing — ensure your best waitrons are on during peak.',
  },
]

export default function Executive() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState<Stats>({
    revenue: 0,
    openOrders: 0,
    occupiedTables: 0,
    totalTables: 0,
    staffOnDuty: 0,
    lowStock: 0,
    foodItems: 0,
    drinkItems: 0,
  })
  const [recentOrders, setRecentOrders] = useState<Record<string, unknown>[]>([])
  const [trendData, setTrendData] = useState<TrendDay[]>([])
  const [loading, setLoading] = useState(true)
  const [cvData, setCvData] = useState({
    occupancy: 0,
    todayAlerts: [] as Record<string, unknown>[],
    zoneHeatmaps: [] as Record<string, unknown>[],
    tillEvents: [] as Record<string, unknown>[],
    shelfAlerts: [] as Record<string, unknown>[],
  })

  const statsRefreshTimer = useRef<number | null>(null)
  const statsRefreshInFlight = useRef(false)
  const lastStatsFetchAt = useRef(0)

  const isVisible = () => document.visibilityState === 'visible'

  const fetchStats = useCallback(async () => {
    void supabase.rpc('free_orphaned_tables')
    const { sessionStart, sessionEnd, sessionStartIso } = getSessionWindow()
    const [ordersRes, tablesRes, shiftsRes, stockRes, recentRes, revenueRes, trendRes, itemsRes] =
      await Promise.all([
        supabase.from('orders').select('id').eq('status', 'open'),
        supabase.from('tables').select('status'),
        supabase.from('attendance').select('staff_id').or('clock_out.is.null'),
        supabase.from('inventory').select('id, current_stock, minimum_stock').eq('is_active', true),
        supabase
          .from('orders')
          .select(
            'id, total_amount, status, order_type, created_at, tables(name), profiles(full_name)'
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
          .from('order_items')
          .select('quantity, destination, status, return_requested, return_accepted')
          .gte('created_at', sessionStartIso)
          .lt('created_at', sessionEnd.toISOString()),
      ])
    const activeItems = (itemsRes.data || []).filter(
      (i: any) =>
        !i.return_requested &&
        !i.return_accepted &&
        (i.status || '').toLowerCase() !== 'cancelled'
    )
    const foodItems = activeItems
      .filter((i: any) => (i.destination || '').toLowerCase() === 'kitchen')
      .reduce((s: number, i: any) => s + (i.quantity || 0), 0)
    const drinkItems = activeItems
      .filter(
        (i: any) =>
          (i.destination || '').toLowerCase() === 'bar' ||
          (i.destination || '').toLowerCase() === 'mixologist'
      )
      .reduce((s: number, i: any) => s + (i.quantity || 0), 0)
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
      occupiedTables: tablesRes.data?.filter((t) => t.status === 'occupied').length || 0,
      totalTables: tablesRes.data?.length || 0,
      staffOnDuty: new Set((shiftsRes.data || []).map((r: { staff_id: string }) => r.staff_id))
        .size,
      lowStock: stockRes.data?.filter((i) => i.current_stock <= i.minimum_stock).length || 0,
      foodItems,
      drinkItems,
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

  const fetchCvData = useCallback(async () => {
    const { sessionStartIso } = getSessionWindow()
    const [occupancyRes, alertsRes, heatmapRes, tillRes, shelfRes] = await Promise.all([
      supabase
        .from('cv_people_counts')
        .select('occupancy')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('cv_alerts')
        .select('id, camera_id, alert_type, description, severity, created_at')
        .eq('resolved', false)
        .gte('created_at', sessionStartIso)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('cv_zone_heatmaps')
        .select('zone_label, person_count, avg_dwell_seconds')
        .gte('created_at', sessionStartIso)
        .order('person_count', { ascending: false })
        .limit(10),
      supabase
        .from('cv_till_events')
        .select('id, alert_type, created_at')
        .neq('alert_type', 'normal')
        .gte('created_at', sessionStartIso)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('cv_shelf_events')
        .select('id, drink_name, alert_level, created_at')
        .neq('alert_level', 'normal')
        .gte('created_at', sessionStartIso)
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    setCvData({
      occupancy: occupancyRes.data?.[0]?.occupancy || 0,
      todayAlerts: (alertsRes.data || []) as Record<string, unknown>[],
      zoneHeatmaps: (heatmapRes.data || []) as Record<string, unknown>[],
      tillEvents: (tillRes.data || []) as Record<string, unknown>[],
      shelfAlerts: (shelfRes.data || []) as Record<string, unknown>[],
    })
  }, [])

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () =>
        scheduleFetchStats(8000)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () =>
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

  const resolveAlert = async (id: string) => {
    await supabase.from('cv_alerts').update({ resolved: true }).eq('id', id)
    setCvData((prev) => ({
      ...prev,
      todayAlerts: prev.todayAlerts.filter((a) => (a as Record<string, string>).id !== id),
    }))
  }

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
        <RevenueChart trendData={trendData} />
        <QuickActions />
        <RecentOrders
          orders={recentOrders as unknown as Parameters<typeof RecentOrders>[0]['orders']}
        />
      </div>
    </div>
  )
}
