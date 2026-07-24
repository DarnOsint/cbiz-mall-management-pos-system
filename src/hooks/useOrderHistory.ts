import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface MenuItemSummary {
  name: string
}

interface SaleItemSummary {
  id: string
  item_id: string
  quantity: number
  total_price: number
  status: string
  return_requested: boolean
  return_accepted: boolean
  destination: string
  modifier_notes: string | null
  extra_charge: number | null
  created_at: string
  item: MenuItemSummary | null
}

export interface HistoryOrder {
  id: string
  closed_at: string
  payment_method: string
  order_type: string
  status: string
  customer_name: string | null
  tables: { name: string } | null
  order_items: SaleItemSummary[]
}

export function useSaleHistory(profileId?: string) {
  const [sales, setSales] = useState<HistoryOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)

  const fetchHistory = useCallback(
    async (loadMore = false) => {
      if (!profileId) return
      setLoading(true)
      try {
        const { data: attendanceOpen } = await supabase
          .from('attendance')
          .select('clock_in')
          .eq('staff_id', profileId)
          .or('clock_out.is.null')
          .order('clock_in', { ascending: false })
          .limit(1)

        const windowStart = attendanceOpen?.[0]?.clock_in
          ? new Date(attendanceOpen[0].clock_in)
          : (() => {
              const t = new Date()
              t.setHours(8, 0, 0, 0)
              if (new Date().getHours() < 8) t.setDate(t.getDate() - 1)
              return t
            })()

        const from = loadMore ? (page + 1) * 60 : 0
        const to = from + 60 - 1

        const { data } = await supabase
          .from('orders')
          .select(
            `id, closed_at, payment_method, order_type, status, customer_name,
          order_items(id, item_id, quantity, total_price, status, return_requested, return_accepted, destination, modifier_notes, extra_charge, created_at,
            item(name))`
          )
          .eq('status', 'paid')
          .eq('staff_id', profileId)
          .gte('closed_at', windowStart.toISOString())
          .order('closed_at', { ascending: false })
          .range(from, to)

        const newOrders = (data || []) as unknown as HistoryOrder[]
        if (loadMore) {
          setSales((prev) => [...prev, ...newOrders])
        } else {
          setSales(newOrders)
        }
        setHasMore(newOrders.length === 60)
        setPage(loadMore ? page + 1 : 0)
      } catch (err) {
        console.error('fetchHistory error:', err)
      }
      setLoading(false)
    },
    [profileId, page]
  )

  return { sales, loading, hasMore, fetchHistory }
}
