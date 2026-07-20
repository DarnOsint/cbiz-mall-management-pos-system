import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { HelpTooltip } from '../../components/HelpTooltip'
import { useAuth } from '../../context/AuthContext'
import {
  ShoppingBag,
  DollarSign,
  BarChart2,
  BookOpen,
  Shield,
  TrendingUp,
} from 'lucide-react'

import OverviewTab from './OverviewTab'
import OrdersTab from './OrdersTab'
import TrendsTab from './TrendsTab'
import LedgerTab from './LedgerTab'
import AuditTab from './AuditTab'
import { getNetOrderAmount } from './orderAmounts'

import type {
  AccountingSummary,
  TrendPoint,
  PayoutRow,
  AuditEntry,
} from './types'
import type { Order } from '../../types'

const DATE_RANGES = ['Today', 'Prev Day', 'Date', 'This Week', 'This Month', 'Custom'] as const
type DateRange = (typeof DATE_RANGES)[number]

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart2 },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'ledger', label: 'Ledger', icon: BookOpen },
  { id: 'audit', label: 'Audit', icon: Shield },
] as const

export default function Accounting() {
  useAuth()

  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange, setDateRange] = useState<DateRange>('Today')
  const [pickedDate, setPickedDate] = useState(() => {
    const wat = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))
    if (wat.getHours() < 8) wat.setDate(wat.getDate() - 1)
    return wat.toLocaleDateString('en-CA')
  })
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [orderFilter, setOrderFilter] = useState({ status: 'all', type: 'all' })

  const [summary, setSummary] = useState<AccountingSummary>({
    total: 0,
    byMethod: {},
    orders: 0,
    avgOrder: 0,
  })
  const [orders, setOrders] = useState<Order[]>([])
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [payouts, setPayouts] = useState<PayoutRow[]>([])

  const getDateBounds = useCallback(() => {
    const now = new Date()
    let start: Date, end: Date

    const sessionStart = () => {
      const lagosNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))
      const s = new Date(lagosNow)
      s.setHours(23, 0, 0, 0)
      if (lagosNow.getHours() < 23) s.setDate(s.getDate() - 1)
      return s
    }

    if (dateRange === 'Today') {
      start = sessionStart()
      end = new Date(start)
      end.setDate(end.getDate() + 1)
    } else if (dateRange === 'Prev Day') {
      start = sessionStart()
      start.setDate(start.getDate() - 1)
      end = new Date(start)
      end.setDate(end.getDate() + 1)
    } else if (dateRange === 'Date' && pickedDate) {
      start = new Date(pickedDate)
      start.setHours(23, 0, 0, 0)
      end = new Date(start)
      end.setDate(end.getDate() + 1)
    } else if (dateRange === 'This Week') {
      start = sessionStart()
      start.setDate(start.getDate() - start.getDay())
      end = new Date(start)
      end.setDate(end.getDate() + 7)
    } else if (dateRange === 'This Month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      start.setHours(23, 0, 0, 0)
      end = sessionStart()
    } else if (dateRange === 'Custom' && customStart && customEnd) {
      start = new Date(customStart)
      start.setHours(23, 0, 0, 0)
      end = new Date(customEnd)
      end.setHours(23, 0, 0, 0)
      end.setDate(end.getDate() + 1)
    } else {
      start = sessionStart()
      end = new Date(start)
      end.setDate(end.getDate() + 1)
    }
    return { start: start.toISOString(), end: end.toISOString() }
  }, [dateRange, customStart, customEnd, pickedDate])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { start, end } = getDateBounds()

    const [ordersRes, payoutsRes, trendRes, auditRes] = await Promise.all([
      supabase
        .from('orders')
        .select(
          'id, status, total_amount, payment_method, order_type, created_at, closed_at, staff_id, customer_name, profiles(full_name), order_items(id, quantity, total_price, status, modifier_notes, return_requested, return_accepted, items(name))'
        )
        .or(
          `and(status.eq.paid,closed_at.gte.${start},closed_at.lt.${end}),and(status.neq.paid,created_at.gte.${start},created_at.lt.${end})`
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('payouts')
        .select('id, amount, reason, category, paid_to, created_at')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select(
          'created_at, order_items(total_price, status, return_requested, return_accepted)'
        )
        .eq('status', 'paid')
        .gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString())
        .order('created_at', { ascending: true }),
      supabase
        .from('audit_log')
        .select(
          'id, action, entity, entity_name, performed_by_name, performed_by_role, new_value, created_at'
        )
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false })
        .limit(200),
    ])

    const allOrders = (ordersRes.data || []) as unknown as Order[]
    const paidOrders = allOrders.filter((o) => o.status === 'paid')

    const total = paidOrders.reduce((s, o) => s + getNetOrderAmount(o), 0)
    const byMethod: Record<string, number> = {}
    paidOrders.forEach((o) => {
      const pm = (o.payment_method || '').toLowerCase()
      let key = 'Transfer'
      if (pm === 'cash') key = 'Cash'
      else if (pm === 'card' || pm === 'bank_pos') key = 'Bank POS'
      else if (pm.startsWith('transfer') || !pm) key = 'Transfer'
      else if (pm === 'credit') key = 'Credit'
      else if (pm === 'split') key = 'Split'
      else if (pm.startsWith('cash+transfer')) key = 'Cash + Transfer'
      else if (pm.startsWith('cash+card')) key = 'Cash + POS'
      else if (pm === 'complimentary') key = 'Complimentary'
      byMethod[key] = (byMethod[key] || 0) + getNetOrderAmount(o)
    })

    setSummary({
      total,
      byMethod,
      orders: paidOrders.length,
      avgOrder: paidOrders.length ? Math.round(total / paidOrders.length) : 0,
    })
    setOrders(allOrders)

    const dayMap: Record<string, TrendPoint> = {}
    ;(
      trendRes.data as unknown as
        | Array<{
            created_at: string
            order_items?: Order['order_items']
          }>
        | null
        | undefined
    )?.forEach((o) => {
      const day = new Date(o.created_at).toLocaleDateString('en-NG', {
        month: 'short',
        day: 'numeric',
      })
      if (!dayMap[day]) dayMap[day] = { day, revenue: 0, orders: 0 }
      dayMap[day].revenue += getNetOrderAmount(o)
      dayMap[day].orders++
    })
    setTrendData(Object.values(dayMap))

    setAuditLog((auditRes.data || []) as AuditEntry[])
    setPayouts((payoutsRes.data || []) as PayoutRow[])

    setLoading(false)
  }, [getDateBounds])

  useEffect(() => {
    const _ms = document.getElementById('main-scroll')
    if (_ms) _ms.scrollTop = 0
  }, [activeTab])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll()
  }, [fetchAll])

  const dateLabel =
    dateRange === 'Date' && pickedDate
      ? pickedDate
      : dateRange === 'Custom'
        ? `${customStart}–${customEnd}`
        : dateRange

  const totalPayouts = payouts.reduce((s, p) => s + (p.amount || 0), 0)
  const netRevenue = summary.total - totalPayouts
  const paidCount = orders.filter((o) => o.status === 'paid').length
  const bounds = getDateBounds()
  const sessionDate = bounds.start.slice(0, 10)
  const sessionEndDateInclusive = (() => {
    try {
      const end = new Date(bounds.end)
      end.setDate(end.getDate() - 1)
      return end.toISOString().slice(0, 10)
    } catch {
      return bounds.end.slice(0, 10)
    }
  })()

  return (
    <div className="min-h-full bg-gray-950">
      {/* Date Range Picker */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {DATE_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${dateRange === r ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
            >
              {r}
            </button>
          ))}
        </div>
        {dateRange === 'Date' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        )}
        {dateRange === 'Custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
            />
            <span className="text-gray-500 text-xs">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-gray-600 text-xs">
            {loading ? 'Loading...' : `${paidCount} paid orders`}
          </span>
          <HelpTooltip
            storageKey="accounting"
            tips={[
              {
                id: 'acc-daterange',
                title: 'Date Range Filter',
                description:
                  'All tabs respect the date range at the top — Today, This Week, This Month, or Custom. Set the range before reading any figures.',
              },
              {
                id: 'acc-overview',
                title: 'Overview Tab',
                description:
                  'Gross revenue, net revenue (after payouts), breakdown by payment method, order count, and average order value.',
              },
              {
                id: 'acc-orders',
                title: 'Orders Tab',
                description:
                  'Full order list for the period. Filter by status and type. Expand any order to see every item, the staff, payment method, and exact timestamp.',
              },
              {
                id: 'acc-trends',
                title: 'Trends Tab',
                description:
                  'Revenue and order count charts over the selected period. Identifies peak days and slow periods.',
              },
              {
                id: 'acc-ledger',
                title: 'Ledger Tab',
                description:
                  'Double-entry general ledger — every sale, payout, and debtor payment recorded as credit or debit with a running balance. Exportable to PDF.',
              },
              {
                id: 'acc-audit',
                title: 'Audit Log Tab',
                description:
                  'Tamper-evident log of every system action — logins, order changes, voids, menu edits, staff changes, and settings updates.',
              },
            ]}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 bg-gray-900 px-4 overflow-x-auto items-center">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-amber-500 text-amber-500' : 'border-transparent text-gray-400 hover:text-white'}`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4 md:p-6">
        {activeTab === 'overview' && (
          <OverviewTab
            summary={summary}
            trendData={trendData}
            totalPayouts={totalPayouts}
            netRevenue={netRevenue}
            dateLabel={dateLabel}
            sessionDate={sessionDate}
            sessionEndDate={sessionEndDateInclusive}
            dateRangeType={dateRange}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersTab orders={orders} orderFilter={orderFilter} onFilterChange={setOrderFilter} />
        )}
        {activeTab === 'trends' && <TrendsTab trendData={trendData} />}
        {activeTab === 'ledger' && <LedgerTab dateRange={dateRange} />}
        {activeTab === 'audit' && <AuditTab auditLog={auditLog} dateRange={dateRange} />}
      </div>
    </div>
  )
}
