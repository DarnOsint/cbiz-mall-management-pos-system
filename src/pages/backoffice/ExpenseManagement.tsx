import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ArrowLeft, Plus, X, Save, Search, DollarSign, Calendar, Filter } from 'lucide-react'
import { formatPrice } from '../../lib/currency'
import { useToast } from '../../context/ToastContext'

interface Props {
  onBack: () => void
}

interface Expense {
  id: string
  category: string
  amount: number
  description: string | null
  paid_by: string | null
  paid_by_name: string | null
  recorded_by: string | null
  recorded_by_name: string | null
  created_at: string
  shift_id: string | null
}

const EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Salaries',
  'Supplies',
  'Maintenance',
  'Marketing',
  'Insurance',
  'Transportation',
  'Food Cost',
  'Equipment',
  'Cleaning',
  'Security',
  'Licenses',
  'Other',
]

export default function ExpenseManagement({ onBack }: Props) {
  const { profile } = useAuth()
  const toast = useToast()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [paidBy, setPaidBy] = useState('')

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    setLoading(true)
    let query = supabase.from('expenses').select('*').order('created_at', { ascending: false })
    const { data, error } = await query
    if (error) {
      toast.error('Error', error.message)
    } else {
      setExpenses((data || []) as Expense[])
    }
    setLoading(false)
  }

  const filtered = expenses.filter((e) => {
    if (filterCategory !== 'All' && e.category !== filterCategory) return false
    if (dateFrom && new Date(e.created_at) < new Date(dateFrom)) return false
    if (dateTo) {
      const end = new Date(dateTo)
      end.setDate(end.getDate() + 1)
      if (new Date(e.created_at) >= end) return false
    }
    return true
  })

  const todayStr = new Date().toISOString().slice(0, 10)
  const totals = {
    today: expenses
      .filter((e) => e.created_at.slice(0, 10) === todayStr)
      .reduce((s, e) => s + e.amount, 0),
    week: expenses
      .filter((e) => {
        const d = new Date(e.created_at)
        const now = new Date()
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        startOfWeek.setHours(0, 0, 0, 0)
        return d >= startOfWeek
      })
      .reduce((s, e) => s + e.amount, 0),
    month: expenses
      .filter((e) => e.created_at.slice(0, 7) === todayStr.slice(0, 7))
      .reduce((s, e) => s + e.amount, 0),
  }

  const resetForm = () => {
    setCategory(EXPENSE_CATEGORIES[0])
    setAmount('')
    setDescription('')
    setPaidBy('')
  }

  const handleSave = async () => {
    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum <= 0) {
      toast.info('Notice', 'Amount must be greater than 0')
      return
    }
    if (!paidBy.trim()) {
      toast.info('Notice', 'Please enter who the expense was paid to')
      return
    }

    setSaving(true)
    try {
      const expenseId = crypto.randomUUID()
      const expensePayload = {
        id: expenseId,
        category,
        amount: amountNum,
        description: description.trim() || null,
        paid_by: null,
        paid_by_name: paidBy.trim(),
        recorded_by: profile?.id || null,
        recorded_by_name: profile?.full_name || null,
        shift_id: null,
        created_at: new Date().toISOString(),
      }

      const { error: expErr } = await supabase.from('expenses').insert(expensePayload)
      if (expErr) throw expErr

      const { error: cmErr } = await supabase.from('cash_movements').insert({
        id: crypto.randomUUID(),
        shift_id: null,
        type: 'expense',
        amount: amountNum,
        description: `${category}${description.trim() ? ' — ' + description.trim() : ''}`,
        reference_id: expenseId,
        performed_by: profile?.id || null,
        performed_by_name: profile?.full_name || null,
        created_at: new Date().toISOString(),
      })
      if (cmErr) throw cmErr

      toast.success('Expense Recorded', `${formatPrice(amountNum)} recorded for ${category}`)
      resetForm()
      setShowForm(false)
      fetchExpenses()
    } catch (err) {
      toast.error('Error', (err as { message?: string }).message || 'Failed to record expense')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-white font-bold">Expense Management</h1>
            <p className="text-gray-400 text-xs">{expenses.length} total expenses</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-xl text-xs transition-colors"
        >
          <Plus size={14} /> New Expense
        </button>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Today</p>
            <p className="text-2xl font-bold text-white">{formatPrice(totals.today)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">This Week</p>
            <p className="text-2xl font-bold text-white">{formatPrice(totals.week)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">This Month</p>
            <p className="text-2xl font-bold text-white">{formatPrice(totals.month)}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 focus-within:border-amber-500 transition-colors">
            <Calendar size={14} className="text-gray-500 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none w-full"
              placeholder="From"
            />
          </div>
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 focus-within:border-amber-500 transition-colors">
            <Calendar size={14} className="text-gray-500 shrink-0" />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none w-full"
              placeholder="To"
            />
          </div>
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2">
            <Filter size={14} className="text-gray-500 shrink-0" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-transparent text-white text-sm focus:outline-none w-full"
            >
              <option value="All">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-amber-500 text-center py-12">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mx-auto mb-4">
              <DollarSign size={24} className="text-gray-600" />
            </div>
            <p className="text-gray-400 font-semibold mb-1">No expenses found</p>
            <p className="text-gray-600 text-xs">Record your first expense to get started.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Category</th>
                    <th className="text-left px-4 py-3 font-medium">Description</th>
                    <th className="text-left px-4 py-3 font-medium">Paid To</th>
                    <th className="text-left px-4 py-3 font-medium">Recorded By</th>
                    <th className="text-right px-4 py-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(e.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-amber-500/10 text-amber-400 text-xs px-2 py-0.5 rounded-lg">
                          {e.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate">
                        {e.description || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{e.paid_by_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-400">{e.recorded_by_name || '—'}</td>
                      <td className="px-4 py-3 text-right text-red-400 font-bold whitespace-nowrap">
                        -{formatPrice(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-800">
                    <td colSpan={5} className="px-4 py-3 text-right text-white font-bold">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right text-red-400 font-bold">
                      -{formatPrice(filtered.reduce((s, e) => s + e.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-800">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div>
                <h3 className="text-white font-bold">Record Expense</h3>
                <p className="text-gray-400 text-xs mt-0.5">Enter the expense details below</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 text-sm"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                  Amount (SSP) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 text-sm"
                  placeholder="e.g. 50000"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 text-sm resize-none"
                  placeholder="Brief description of the expense"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                  Paid To *
                </label>
                <input
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 text-sm"
                  placeholder="Vendor or employee name"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-800">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition-colors"
              >
                <Save size={16} /> {saving ? 'Recording...' : 'Record Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
