import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/currency'
import { useAuth } from '../../context/AuthContext'
import { X, RotateCcw } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import type { RefundMethod } from '../../types'

interface OrderItemForRefund {
  id: string
  item_id: string
  name: string
  quantity: number
  unit_price: number
}

interface Props {
  orderId: string
  orderNumber: string
  onClose: () => void
  onSuccess: () => void
}

const METHODS: { value: RefundMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'transfer', label: 'Bank Transfer' },
  { value: 'mobile', label: 'Mobile Money' },
]

export default function RefundModal({ orderId, orderNumber, onClose, onSuccess }: Props) {
  const { profile } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState<OrderItemForRefund[]>([])
  const [refundQtys, setRefundQtys] = useState<Record<string, number>>({})
  const [reason, setReason] = useState('')
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('cash')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrderItems()
  }, [orderId])

  const fetchOrderItems = async () => {
    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
    if (error) {
      toast.error('Error', error.message)
      setLoading(false)
      return
    }
    if (data) {
      const mapped: OrderItemForRefund[] = data.map((oi: any) => ({
        id: oi.id,
        item_id: oi.item_id,
        name: oi.name || '',
        quantity: oi.quantity,
        unit_price: oi.unit_price,
      }))
      setItems(mapped)
      const initial: Record<string, number> = {}
      mapped.forEach((item) => { initial[item.id] = 0 })
      setRefundQtys(initial)
    }
    setLoading(false)
  }

  const totalRefund = items.reduce((sum, item) => {
    return sum + (refundQtys[item.id] || 0) * item.unit_price
  }, 0)

  const hasItems = Object.values(refundQtys).some((q) => q > 0)

  const handleSubmit = async () => {
    if (!hasItems || !reason.trim() || !profile) return
    setSaving(true)
    try {
      const refundRecords = items
        .filter((item) => (refundQtys[item.id] || 0) > 0)
        .map((item) => ({
          id: crypto.randomUUID(),
          order_id: orderId,
          order_item_id: item.id,
          item_name: item.name,
          quantity: refundQtys[item.id],
          unit_price: item.unit_price,
          refund_amount: refundQtys[item.id] * item.unit_price,
          refund_method: refundMethod,
          reason: reason.trim(),
          status: 'pending',
          created_at: new Date().toISOString(),
        }))

      const { error } = await supabase.from('refunds').insert(refundRecords)
      if (error) throw error

      toast.success('Refund submitted', `${refundRecords.length} item(s) sent for approval`)
      onSuccess()
    } catch (err) {
      toast.error('Error', (err as any)?.message || 'Failed to submit refund')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-gray-950 rounded-2xl w-full max-w-lg border border-gray-800 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h3 className="text-white font-bold text-lg">Request Refund</h3>
            <p className="text-gray-400 text-sm">Order #{orderNumber}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-amber-500">Loading items...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No items found</div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-400 text-xs uppercase tracking-wide font-medium">Select items to refund</p>
              {items.map((item) => (
                <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{item.name}</p>
                    <p className="text-gray-500 text-xs">{formatPrice(item.unit_price)} each &middot; {item.quantity} sold</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() =>
                        setRefundQtys((prev) => ({
                          ...prev,
                          [item.id]: Math.max(0, (prev[item.id] || 0) - 1),
                        }))
                      }
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white bg-gray-700 hover:bg-gray-600 transition-colors text-sm"
                    >
                      -
                    </button>
                    <span className="text-white text-sm w-6 text-center font-medium">
                      {refundQtys[item.id] || 0}
                    </span>
                    <button
                      onClick={() =>
                        setRefundQtys((prev) => ({
                          ...prev,
                          [item.id]: Math.min(item.quantity, (prev[item.id] || 0) + 1),
                        }))
                      }
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white bg-gray-700 hover:bg-gray-600 transition-colors text-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">Refund Method</label>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setRefundMethod(m.value)}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                    refundMethod === m.value
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">Reason for Refund *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the reason..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 resize-none text-sm"
            />
          </div>
        </div>

        <div className="p-5 border-t border-gray-800 space-y-3">
          {totalRefund > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Total refund amount</span>
              <span className="text-amber-400 font-bold text-lg">{formatPrice(totalRefund)}</span>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl py-3 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!hasItems || !reason.trim() || saving}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} />
              {saving ? 'Submitting...' : 'Submit Refund'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
