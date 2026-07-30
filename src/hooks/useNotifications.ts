import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export type ToastColor = 'green' | 'amber' | 'blue' | 'red'

export interface Toast {
  id: string
  type: 'ready' | 'stock' | 'call'
  title: string
  message: string
  color: 'green' | 'amber' | 'blue'
}

export function useNotifications(profile: Profile | null) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = String(Date.now() + Math.random())
    setToasts((prev) => [...prev, { ...toast, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 6_000)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    if (!profile) return
    const channels: ReturnType<typeof supabase.channel>[] = []

    if (['owner', 'manager'].includes(profile.role)) {
      const invCh = supabase
        .channel('notify-low-stock')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'inventory',
          },
          (payload) => {
            const item = payload.new as {
              item_name: string
              current_stock: number
              minimum_stock: number
              unit: string
            }
            if (item.current_stock <= item.minimum_stock) {
              addToast({
                type: 'stock',
                title: 'Low Stock Alert',
                message: `${item.item_name} is running low (${item.current_stock} ${item.unit} left)`,
                color: 'amber',
              })
            }
          }
        )
        .subscribe()
      channels.push(invCh)
    }

    return () => channels.forEach((ch) => supabase.removeChannel(ch))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role, addToast])

  return { toasts, dismiss }
}
