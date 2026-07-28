import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { ArrowLeft, ArrowLeftRight, Send, CheckCircle, XCircle, Search, Filter } from 'lucide-react'
import { audit } from '../../lib/audit'

interface Props {
  onBack: () => void
}

interface StockTransfer {
  id: string
  item_id: string
  item_name: string
  quantity: number
  from_location: string
  to_location: string
  status: 'pending' | 'completed' | 'cancelled'
  requested_by: string
  requested_by_name: string
  approved_by: string | null
  approved_by_name: string | null
  created_at: string
  completed_at: string | null
  notes: string | null
}

interface MenuItem {
  id: string
  name: string
}

type Tab = 'new' | 'pending' | 'history'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  completed: 'bg-green-500/10 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'new', label: 'New Transfer' },
  { id: 'pending', label: 'Pending Transfers' },
  { id: 'history', label: 'History' },
]

const blankForm = {
  item_id: '',
  quantity: '',
  from_location: '',
  to_location: '',
  notes: '',
}

export default function StockTransfers({ onBack }: Props) {
  const { profile } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('new')
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const [form, setForm] = useState(blankForm)
  const ff = (v: Partial<typeof blankForm>) => setForm((p) => ({ ...p, ...v }))

  useEffect(() => {
    Promise.all([fetchTransfers(), fetchMenuItems()])
  }, [])

  const fetchTransfers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('stock_transfers')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Error', error.message)
    } else if (data) {
      setTransfers(data as StockTransfer[])
    }
    setLoading(false)
  }

  const fetchMenuItems = async () => {
    const { data } = await supabase
      .from('item')
      .select('id, name')
      .eq('is_available', true)
      .order('name')
    if (data) setMenuItems(data as MenuItem[])
  }

  const handleSubmit = async () => {
    if (!form.item_id || !form.quantity || !form.from_location || !form.to_location) {
      return toast.warning('Required', 'Item, quantity, source and destination are required')
    }
    if (form.from_location === form.to_location) {
      return toast.warning('Invalid', 'Source and destination must be different')
    }
    if (!profile) return
    setSaving(true)
    const item = menuItems.find((m) => m.id === form.item_id)
    try {
      const { error } = await supabase.from('stock_transfers').insert({
        item_id: form.item_id,
        item_name: item?.name || '',
        quantity: parseFloat(form.quantity) || 0,
        from_location: form.from_location.trim(),
        to_location: form.to_location.trim(),
        status: 'pending',
        requested_by: profile.id,
        requested_by_name: profile.full_name,
        notes: form.notes.trim() || null,
        created_at: new Date().toISOString(),
      })
      if (error) throw error
      await audit({
        action: 'STOCK_TRANSFER_CREATED',
        entity: 'stock_transfer',
        entityName: `${item?.name || ''} ${form.quantity} ${form.from_location}→${form.to_location}`,
        newValue: { item_id: form.item_id, quantity: form.quantity, from: form.from_location, to: form.to_location },
        performer: profile,
      })
      toast.success('Created', 'Stock transfer request created')
      setForm(blankForm)
      fetchTransfers()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async (transfer: StockTransfer) => {
    if (!profile) return
    setProcessing(transfer.id)
    try {
      const { error } = await supabase
        .from('stock_transfers')
        .update({
          status: 'completed',
          approved_by: profile.id,
          approved_by_name: profile.full_name,
          completed_at: new Date().toISOString(),
        })
        .eq('id', transfer.id)
      if (error) throw error

      const invItem = await supabase
        .from('inventory')
        .select('id, current_stock')
        .eq('item_name', transfer.item_name)
        .maybeSingle()

      if (invItem.data) {
        const newStock = Math.max(0, (invItem.data.current_stock || 0) + transfer.quantity)
        await supabase
          .from('inventory')
          .update({ current_stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', invItem.data.id)
      } else {
        await supabase.from('inventory').insert({
          item_name: transfer.item_name,
          current_stock: transfer.quantity,
          unit: 'pieces',
          minimum_stock: 0,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
      }

      await audit({
        action: 'STOCK_TRANSFER_COMPLETED',
        entity: 'stock_transfer',
        entityId: transfer.id,
        entityName: `${transfer.item_name} ${transfer.quantity} ${transfer.from_location}→${transfer.to_location}`,
        newValue: { status: 'completed', quantity: transfer.quantity },
        performer: profile,
      })
      toast.success('Completed', `Transfer of ${transfer.item_name} completed`)
      fetchTransfers()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : String(err))
    } finally {
      setProcessing(null)
    }
  }

  const handleCancel = async (transfer: StockTransfer) => {
    if (!profile) return
    setProcessing(transfer.id)
    try {
      const { error } = await supabase
        .from('stock_transfers')
        .update({
          status: 'cancelled',
          approved_by: profile.id,
          approved_by_name: profile.full_name,
          completed_at: new Date().toISOString(),
        })
        .eq('id', transfer.id)
      if (error) throw error
      await audit({
        action: 'STOCK_TRANSFER_CANCELLED',
        entity: 'stock_transfer',
        entityId: transfer.id,
        entityName: `${transfer.item_name} ${transfer.quantity} ${transfer.from_location}→${transfer.to_location}`,
        newValue: { status: 'cancelled' },
        performer: profile,
      })
      toast.success('Cancelled', 'Transfer has been cancelled')
      fetchTransfers()
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : String(err))
    } finally {
      setProcessing(null)
    }
  }

  const stats = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    let todayCount = 0
    let pendingCount = 0
    for (const t of transfers) {
      if (t.created_at >= todayStart) todayCount++
      if (t.status === 'pending') pendingCount++
    }
    return { todayCount, pendingCount }
  }, [transfers])

  const pending = useMemo(() => transfers.filter((t) => t.status === 'pending'), [transfers])

  const history = useMemo(() => {
    let list = transfers.filter((t) => t.status !== 'pending')
    if (statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.item_name.toLowerCase().includes(q) ||
          t.from_location.toLowerCase().includes(q) ||
          t.to_location.toLowerCase().includes(q) ||
          t.requested_by_name?.toLowerCase().includes(q)
      )
    }
    return list
  }, [transfers, statusFilter, search])

  return (
    <div className="min-h-full bg-gray-950">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h2 className="text-white text-2xl font-bold">Stock Transfers</h2>
            <p className="text-gray-400 text-sm">Transfer stock between shop locations</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Transfers Today</p>
            <p className="text-white font-bold text-xl">{stats.todayCount}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Pending</p>
            <p className="text-amber-400 font-bold text-xl">{stats.pendingCount}</p>
          </div>
        </div>

        <div className="flex gap-1 mb-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-amber-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'new' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-lg space-y-4">
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                Item *
              </label>
              <select
                value={form.item_id}
                onChange={(e) => ff({ item_id: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 text-sm"
              >
                <option value="">— Select item —</option>
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                Quantity *
              </label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => ff({ quantity: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 text-sm"
                placeholder="e.g. 50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                  Source Location *
                </label>
                <input
                  value={form.from_location}
                  onChange={(e) => ff({ from_location: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 text-sm"
                  placeholder="e.g. Shop A"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                  Destination *
                </label>
                <input
                  value={form.to_location}
                  onChange={(e) => ff({ to_location: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 text-sm"
                  placeholder="e.g. Shop B"
                />
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => ff({ notes: e.target.value })}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 text-sm resize-none"
                placeholder="Reason for transfer..."
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 text-black font-bold rounded-xl py-3 transition-colors"
            >
              <Send size={16} />
              {saving ? 'Submitting...' : 'Submit Transfer Request'}
            </button>
          </div>
        )}

        {tab === 'pending' && (
          <>
            {loading ? (
              <div className="text-center py-12 text-amber-500">Loading...</div>
            ) : pending.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mx-auto mb-4">
                  <ArrowLeftRight size={24} className="text-gray-600" />
                </div>
                <p className="text-gray-400 font-semibold mb-1">No pending transfers</p>
                <p className="text-gray-600 text-xs">All stock transfers have been processed.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Date</th>
                      <th className="text-left text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Item</th>
                      <th className="text-center text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Qty</th>
                      <th className="text-left text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Route</th>
                      <th className="text-left text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Requested By</th>
                      <th className="text-right text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {pending.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-900/50 transition-colors">
                        <td className="px-3 py-3 text-white text-xs whitespace-nowrap">
                          {new Date(t.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-3 text-white text-xs font-medium">{t.item_name}</td>
                        <td className="px-3 py-3 text-gray-300 text-xs text-center">{t.quantity}</td>
                        <td className="px-3 py-3 text-xs">
                          <span className="text-gray-400">{t.from_location}</span>
                          <span className="text-gray-600 mx-1">→</span>
                          <span className="text-amber-400">{t.to_location}</span>
                        </td>
                        <td className="px-3 py-3 text-gray-400 text-xs">{t.requested_by_name}</td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleComplete(t)}
                              disabled={processing === t.id}
                              className="flex items-center gap-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-1.5 rounded-lg border border-green-500/20 hover:border-green-500/40 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle size={12} /> Complete
                            </button>
                            <button
                              onClick={() => handleCancel(t)}
                              disabled={processing === t.id}
                              className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-colors disabled:opacity-50"
                            >
                              <XCircle size={12} /> Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'history' && (
          <>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {['all', 'completed', 'cancelled'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-amber-500 text-black'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              <div className="flex-1" />
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 focus-within:border-amber-500 transition-colors">
                <Search size={14} className="text-gray-500 shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="flex-1 bg-transparent text-white text-xs placeholder-gray-500 focus:outline-none"
                />
              </div>
            </div>
            {loading ? (
              <div className="text-center py-12 text-amber-500">Loading...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mx-auto mb-4">
                  <ArrowLeftRight size={24} className="text-gray-600" />
                </div>
                <p className="text-gray-400 font-semibold mb-1">No history found</p>
                <p className="text-gray-600 text-xs">Try a different filter or search.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Date</th>
                      <th className="text-left text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Item</th>
                      <th className="text-center text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Qty</th>
                      <th className="text-left text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Route</th>
                      <th className="text-left text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Requested By</th>
                      <th className="text-center text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Status</th>
                      <th className="text-left text-gray-500 text-xs uppercase tracking-wide font-medium px-3 py-3">Processed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {history.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-900/50 transition-colors">
                        <td className="px-3 py-3 text-white text-xs whitespace-nowrap">
                          {new Date(t.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-3 text-white text-xs font-medium">{t.item_name}</td>
                        <td className="px-3 py-3 text-gray-300 text-xs text-center">{t.quantity}</td>
                        <td className="px-3 py-3 text-xs">
                          <span className="text-gray-400">{t.from_location}</span>
                          <span className="text-gray-600 mx-1">→</span>
                          <span className="text-amber-400">{t.to_location}</span>
                        </td>
                        <td className="px-3 py-3 text-gray-400 text-xs">{t.requested_by_name}</td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg border ${STATUS_STYLES[t.status]}`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-gray-400 text-xs">
                          {t.approved_by_name || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
