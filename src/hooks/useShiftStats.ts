import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface ShiftOrder {
  id: string
  total_amount: number
  closed_at: string
  tables: { name: string } | null
  order_items: Array<{
    quantity: number
    total_price: number
    status: string
    return_requested: boolean
    return_accepted: boolean
    menu_items: { name: string } | null
  }>
}

export interface ShiftStats {
  clockIn: string
  salesCount: number
  totalSales: number
  totalItems: number
  uniqueAreas: number
  recentOrders: ShiftOrder[]
}

export function useShiftStats(profileId?: string) {
  const [stats, setStats] = useState<ShiftStats | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchStats = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    try {
      const now = new Date()
      now.setHours(8, 0, 0, 0)
      if (new Date().getHours() < 8) now.setDate(now.getDate() - 1)
      const windowStartIso = now.toISOString()

      const [attendanceRes, ordersRes] = await Promise.all([
        supabase
          .from('attendance')
          .select('clock_in')
          .eq('staff_id', profileId)
          .or('clock_out.is.null')
          .order('clock_in', { ascending: false })
          .limit(1),
        supabase
          .from('orders')
          .select(
            `id, total_amount, closed_at, tables(name),
            order_items(
              quantity, total_price, status,
              return_requested, return_accepted,
              menu_items(name)
            )`
          )
          .eq('staff_id', profileId)
          .eq('status', 'paid')
          .gte('closed_at', windowStartIso),
      ])

      const attendance = attendanceRes.data?.[0] as { clock_in: string } | undefined
      const orders = (ordersRes.data || []) as unknown as ShiftOrder[]

      const filteredOrders = orders.map((o) => {
        const items = o.order_items.filter(
          (i) =>
            !i.return_requested &&
            !i.return_accepted &&
            (i.status || '').toLowerCase() !== 'cancelled'
        )
        const netTotal = items.reduce((s, i) => s + (i.total_price ?? 0), 0)
        return { ...o, order_items: items, netTotal }
      })

      const totalSales = filteredOrders.reduce((s, o) => s + (o.netTotal || 0), 0)
      const totalItems = filteredOrders.reduce(
        (s, o) => s + o.order_items.reduce((ss, i) => ss + (i.quantity || 0), 0),
        0
      )
      const uniqueAreas = new Set(orders.map((o) => o.tables?.name).filter(Boolean)).size

      setStats({
        clockIn: attendance?.clock_in ?? '',
        salesCount: orders.length,
        totalSales,
        totalItems,
        uniqueAreas,
        recentOrders: filteredOrders.slice(0, 5),
      })
    } catch (err) {
      console.error('fetchShiftStats error:', err)
    }
    setLoading(false)
  }, [profileId])

  return { stats, loading, fetchStats }
}
