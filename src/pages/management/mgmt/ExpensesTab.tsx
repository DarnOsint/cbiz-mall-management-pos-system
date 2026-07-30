import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatPrice } from '../../../lib/currency'
import { Calendar, Filter, TrendingDown } from 'lucide-react'

interface Expense {
  id: string
  category: string
  amount: number
  description: string | null
  paid_by_name: string | null
  recorded_by_name: string | null
  created_at: string
}

const EXPENSE_CATEGORIES = [
  'Rent', 'Utilities', 'Salaries', 'Supplies', 'Maintenance',
  'Marketing', 'Insurance', 'Transportation', 'Food Cost',
  'Equipment', 'Cleaning', 'Security', 'Licenses', 'Other',
]

export default function ExpensesTab() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setExpenses(data as Expense[])
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
    today: expenses.filter((e) => e.created_at.slice(0, 10) === todayStr).reduce((s, e) => s + e.amount, 0),
    month: expenses.filter((e) => e.created_at.slice(0, 7) === todayStr.slice(0, 7)).reduce((s, e) => s + e.amount, 0),
  }

  const byCategory = filtered.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
          <TrendingDown size={20} className="text-red-400" />
        </div>
        <div>
          <h2 className="text-white font-bold text-lg">Expense Report</h2>
          <p className="text-gray-400 text-xs">{expenses.length} total expenses recorded</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Today</p>
          <p className="text-2xl font-bold text-white">{formatPrice(totals.today)}</p>
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
          />
        </div>
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 focus-within:border-amber-500 transition-colors">
          <Calendar size={14} className="text-gray-500 shrink-0" />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none w-full"
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

      {Object.keys(byCategory).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
          <h3 className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-3">
            Breakdown by Category
          </h3>
          <div className="space-y-2">
            {Object.entries(byCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amt]) => {
                const total = filtered.reduce((s, e) => s + e.amount, 0)
                const pct = total > 0 ? ((amt / total) * 100).toFixed(1) : '0'
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm w-28 shrink-0">{cat}</span>
                    <div className="flex-1 h-5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500/60 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-white text-sm font-medium w-28 text-right">
                      {formatPrice(amt)}
                    </span>
                    <span className="text-gray-500 text-xs w-12 text-right">{pct}%</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No expenses match the filter criteria</div>
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
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-red-500/10 text-red-400 text-xs px-2 py-0.5 rounded-lg">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate">
                      {e.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{e.paid_by_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{e.recorded_by_name || '—'}</td>
                    <td className="px-4 py-3 text-right text-red-400 font-bold">
                      -{formatPrice(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-800">
                  <td colSpan={5} className="px-4 py-3 text-right text-white font-bold">Total</td>
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
  )
}
