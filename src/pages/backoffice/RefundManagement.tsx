import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/currency'
import { audit } from '../../lib/audit'
import { useAuth } from '../../context/AuthContext'
import {
  ArrowLeft,
  Search,
  RotateCcw,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import type { Refund, RefundStatus } from '../../types'

interface Props {
  onBack: () => void
}

const TABS: { label: string; value: RefundStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Completed', value: 'completed' },
]

const STATUS_STYLES: Record<RefundStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  approved: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
  completed: 'bg-green-500/10 text-green-400 border-green-500/30',
}

export default function RefundManagement({ onBack }: Props) {
  const { profile } = useAuth()
  const toast = useToast()
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<RefundStatus | 'all'>('all')
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    fetchRefunds()
  }, [])

  const fetchRefunds = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('refunds')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Error', error.message)
    } else if (data) {
      setRefunds(data as Refund[])
    }
    setLoading(false)
  }

  const handleApprove = async (refund: Refund) => {
    if (!profile) return
    setProcessing(refund.id)
    try {
      const { error } = await supabase
        .from('refunds')
        .update({
          status: 'completed',
          processed_by: profile.id,
          processed_by_name: profile.full_name,
          processed_at: new Date().toISOString(),
        })
        .eq('id', refund.id)
      if (error) throw error

      await audit({
        action: 'REFUND_COMPLETED',
        entity: 'refund',
        entityId: refund.id,
        entityName: `Refund for ${refund.item_name}`,
        newValue: { status: 'completed', amount: refund.refund_amount },
        performer: profile,
      })

      toast.success('Refund completed', `${formatPrice(refund.refund_amount)} refunded for ${refund.item_name}`)
      fetchRefunds()
    } catch (err) {
      toast.error('Error', (err as any)?.message || 'Failed to approve refund')
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (refund: Refund) => {
    if (!profile) return
    setProcessing(refund.id)
    try {
      const { error } = await supabase
        .from('refunds')
        .update({
          status: 'rejected',
          processed_by: profile.id,
          processed_by_name: profile.full_name,
          processed_at: new Date().toISOString(),
        })
        .eq('id', refund.id)
      if (error) throw error

      await audit({
        action: 'REFUND_REJECTED',
        entity: 'refund',
        entityId: refund.id,
        entityName: `Refund for ${refund.item_name}`,
        newValue: { status: 'rejected' },
        performer: profile,
      })

      toast.success('Refund rejected', `${refund.item_name} refund has been rejected`)
      fetchRefunds()
    } catch (err) {
      toast.error('Error', (err as any)?.message || 'Failed to reject refund')
    } finally {
      setProcessing(null)
    }
  }

  const filtered = useMemo(() => {
    let list = refunds
    if (activeTab !== 'all') {
      list = list.filter((r) => r.status === activeTab)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (r) =>
          r.order_id.toLowerCase().includes(q) ||
          r.item_name.toLowerCase().includes(q)
      )
    }
    return list
  }, [refunds, activeTab, search])

  const stats = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    let todayTotal = 0
    let monthTotal = 0
    let pendingCount = 0

    for (const r of refunds) {
      if (r.status === 'pending') pendingCount++
      if (r.created_at >= monthStart && (r.status === 'completed' || r.status === 'approved')) {
        monthTotal += r.refund_amount
        if (r.created_at >= todayStart) todayTotal += r.refund_amount
      }
    }

    return { todayTotal, monthTotal, pendingCount }
  }, [refunds])

  return (
    <div className="min-h-full bg-gray-950">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h2 className="text-white text-2xl font-bold">Refund Management</h2>
            <p className="text-gray-400 text-sm">Approve, reject and manage refund requests</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Today</p>
            <p className="text-white font-bold text-xl">{formatPrice(stats.todayTotal)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">This Month</p>
            <p className="text-white font-bold text-xl">{formatPrice(stats.monthTotal)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Pending</p>
            <p className="text-amber-400 font-bold text-xl">{stats.pendingCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.value
                  ? 'bg-amber-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="flex-1" />
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 focus-within:border-amber-500 transition-colors">
            <Search size={14} className="text-gray-500 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order or item..."
              className="flex-1 bg-transparent text-white text-xs placeholder-gray-500 focus:outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-amber-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mx-auto mb-4">
              <RotateCcw size={24} className="text-gray-600" />
            </div>
            <p className="text-gray-400 font-semibold mb-1">No refunds found</p>
            <p className="text-gray-600 text-xs">
              {refunds.length === 0
                ? 'No refund requests have been submitted yet.'
                : 'Try a different search or filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Date</th>
                  <th className="text-left text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Order #</th>
                  <th className="text-left text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Item</th>
                  <th className="text-center text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Qty</th>
                  <th className="text-right text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Amount</th>
                  <th className="text-center text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Method</th>
                  <th className="text-center text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Status</th>
                  <th className="text-left text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Notes</th>
                  <th className="text-right text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filtered.map((refund) => (
                  <tr key={refund.id} className="hover:bg-gray-900/50 transition-colors">
                    <td className="px-3 py-3 text-white text-xs whitespace-nowrap">
                      {new Date(refund.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-white text-xs font-mono">
                      #{refund.order_id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-3 py-3 text-white text-xs">{refund.item_name}</td>
                    <td className="px-3 py-3 text-gray-300 text-xs text-center">{refund.quantity}</td>
                    <td className="px-3 py-3 text-amber-400 text-xs text-right font-medium">
                      {formatPrice(refund.refund_amount)}
                    </td>
                    <td className="px-3 py-3 text-gray-400 text-xs text-center capitalize">
                      {refund.refund_method}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg border ${STATUS_STYLES[refund.status]}`}
                      >
                        {refund.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-400 text-xs max-w-[160px] truncate">
                      {refund.reason || '-'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {refund.status === 'pending' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleApprove(refund)}
                            disabled={processing === refund.id}
                            className="flex items-center gap-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-1.5 rounded-lg border border-green-500/20 hover:border-green-500/40 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle size={12} />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(refund)}
                            disabled={processing === refund.id}
                            className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-colors disabled:opacity-50"
                          >
                            <XCircle size={12} />
                            Reject
                          </button>
                        </div>
                      )}
                      {refund.status !== 'pending' && (
                        <span className="text-gray-600 text-[10px]">
                          {refund.processed_by_name || 'System'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
