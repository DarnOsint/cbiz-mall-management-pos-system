import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatPrice } from '../../../lib/currency'
import { RefreshCw, Download, ChevronDown, ChevronRight } from 'lucide-react'

interface CatRow {
  id: string
  name: string
  itemsSold: number
  totalQty: number
  totalRevenue: number
  pct: number
}

interface ItemDetail {
  name: string
  qty: number
  revenue: number
}

const COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6',
  '#ef4444', '#06b6d4', '#f97316', '#84cc16',
  '#ec4899', '#14b8a6', '#a855f7', '#e11d48',
]

function getStartOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

function getEndOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString()
}

export default function SalesByCategory() {
  const [startDate, setStartDate] = useState(getStartOfMonth)
  const [endDate, setEndDate] = useState(getEndOfMonth)
  const [rows, setRows] = useState<CatRow[]>([])
  const [itemsByCat, setItemsByCat] = useState<Record<string, ItemDetail[]>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar')

  const grandTotal = useMemo(() => rows.reduce((s, r) => s + r.totalRevenue, 0), [rows])
  const grandQty = useMemo(() => rows.reduce((s, r) => s + r.totalQty, 0), [rows])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('orders')
        .select('id')
        .eq('status', 'paid')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
      if (err) throw err
      const paidIds = (data || []).map((o) => o.id)
      if (paidIds.length === 0) {
        setRows([])
        setItemsByCat({})
        return
      }

      const { data: items, error: itemsErr } = await supabase
        .from('order_items')
        .select('quantity, total_price, item_id, item!inner(name, category_id, item_categories!inner(id, name))')
        .in('order_id', paidIds)
      if (itemsErr) throw itemsErr

      const catMap: Record<string, CatRow> = {}
      const itemsMap: Record<string, ItemDetail[]> = {}

      for (const oi of items || []) {
        const raw = oi as any
        const catId = raw.item?.category_id || 'unknown'
        const catName = raw.item?.item_categories?.name || 'Unknown'
        if (!catMap[catId]) {
          catMap[catId] = {
            id: catId,
            name: catName,
            itemsSold: 0,
            totalQty: 0,
            totalRevenue: 0,
            pct: 0,
          }
        }
        catMap[catId].itemsSold++
        catMap[catId].totalQty += raw.quantity || 0
        catMap[catId].totalRevenue += raw.total_price || 0

        const itemName = raw.item?.name || 'Unknown'
        if (!itemsMap[catId]) itemsMap[catId] = []
        const arr = itemsMap[catId]
        const existing = arr.find((d) => d.name === itemName)
        if (existing) {
          existing.qty += raw.quantity || 0
          existing.revenue += raw.total_price || 0
        } else {
          arr.push({ name: itemName, qty: raw.quantity || 0, revenue: raw.total_price || 0 })
        }
      }

      const catRows = Object.values(catMap).sort((a, b) => b.totalRevenue - a.totalRevenue)
      const totalRev = catRows.reduce((s, r) => s + r.totalRevenue, 0)
      catRows.forEach((r) => {
        r.pct = totalRev > 0 ? Math.round((r.totalRevenue / totalRev) * 100) : 0
      })

      setRows(catRows)
      setItemsByCat(itemsMap)
    } catch (e) {
      console.warn('SalesByCategory load error:', e)
      setError('Failed to load data.')
      setRows([])
      setItemsByCat({})
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { void load() }, [load])

  const exportCsv = () => {
    const lines = [
      ['Category', 'Items Sold', 'Total Qty', 'Total Revenue (SSP)', '% of Total'],
      ...rows.map((r) => [
        r.name,
        String(r.itemsSold),
        String(r.totalQty),
        String(r.totalRevenue),
        `${r.pct}%`,
      ]),
      [],
      ['TOTAL', '', String(grandQty), String(grandTotal), '100%'],
    ]
    const csv = lines
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales_by_category_${startDate.slice(0, 10)}_${endDate.slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const barMax = Math.max(...rows.map((r) => r.totalRevenue), 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-white font-bold text-lg">Sales by Category</h3>
        <button onClick={load} className="p-2 text-gray-400 hover:text-white bg-gray-900 rounded-xl border border-gray-800">
          <RefreshCw size={15} />
        </button>
        <button onClick={exportCsv} className="p-2 text-gray-400 hover:text-white bg-gray-900 rounded-xl border border-gray-800">
          <Download size={15} />
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="date"
            value={startDate.slice(0, 10)}
            max={endDate.slice(0, 10)}
            onChange={(e) => setStartDate(new Date(e.target.value + 'T00:00:00').toISOString())}
            className="bg-gray-900 border border-gray-800 text-white text-xs rounded-lg px-2 py-1"
          />
          <span className="text-gray-500 text-xs">to</span>
          <input
            type="date"
            value={endDate.slice(0, 10)}
            min={startDate.slice(0, 10)}
            onChange={(e) => setEndDate(new Date(e.target.value + 'T23:59:59').toISOString())}
            className="bg-gray-900 border border-gray-800 text-white text-xs rounded-lg px-2 py-1"
          />
          <button
            onClick={() => { setStartDate(getStartOfMonth()); setEndDate(getEndOfMonth()) }}
            className="px-2 py-1 text-xs bg-amber-500 text-black rounded-lg"
          >
            This Month
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setChartType('bar')}
          className={`px-3 py-1.5 text-xs rounded-lg font-medium ${chartType === 'bar' ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400'}`}
        >
          Bar Chart
        </button>
        <button
          onClick={() => setChartType('pie')}
          className={`px-3 py-1.5 text-xs rounded-lg font-medium ${chartType === 'pie' ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400'}`}
        >
          Pie Chart
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : error ? (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg">{error}</div>
      ) : rows.length === 0 ? (
        <div className="text-gray-500">No paid orders in this period.</div>
      ) : (
        <>
          {chartType === 'bar' ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="space-y-2">
                {rows.map((r, i) => (
                  <div key={r.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-300">{r.name}</span>
                      <span className="text-white font-medium">{formatPrice(r.totalRevenue)}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(r.totalRevenue / barMax) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-4">
                {rows.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-300 text-xs">{r.name} <span className="text-gray-500">{r.pct}%</span></span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center py-4">
                <div className="relative w-48 h-48">
                  {(() => {
                    let cumulative = 0
                    return rows.map((r, i) => {
                      const pct = r.pct / 100
                      const startAngle = cumulative * 360
                      const angle = pct * 360
                      cumulative += pct
                      if (angle === 0) return null
                      const startRad = ((startAngle - 90) * Math.PI) / 180
                      const endRad = ((startAngle + angle - 90) * Math.PI) / 180
                      const rVal = 90
                      const cx = 96
                      const cy = 96
                      const x1 = cx + rVal * Math.cos(startRad)
                      const y1 = cy + rVal * Math.sin(startRad)
                      const x2 = cx + rVal * Math.cos(endRad)
                      const y2 = cy + rVal * Math.sin(endRad)
                      const large = angle > 180 ? 1 : 0
                      const d = angle >= 360
                        ? `M ${cx} ${cy - rVal} A ${rVal} ${rVal} 0 1 1 ${cx - 0.01} ${cy - rVal}`
                        : `M ${cx} ${cy} L ${x1} ${y1} A ${rVal} ${rVal} 0 ${large} 1 ${x2} ${y2} Z`
                      return <path key={r.id} d={d} fill={COLORS[i % COLORS.length]} />
                    })
                  })()}
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto bg-gray-900 border border-gray-800 rounded-xl">
            <table className="min-w-full text-sm text-white">
              <thead className="bg-gray-800 text-gray-300">
                <tr>
                  <th className="px-3 py-2 text-left w-8" />
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-right">Items Sold</th>
                  <th className="px-3 py-2 text-right">Total Qty</th>
                  <th className="px-3 py-2 text-right">Revenue (SSP)</th>
                  <th className="px-3 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <>
                    <tr
                      key={r.id}
                      className="border-t border-gray-800 hover:bg-gray-800/60 cursor-pointer"
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    >
                      <td className="px-3 py-2 text-gray-500">
                        {expanded === r.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2 text-right">{r.itemsSold}</td>
                      <td className="px-3 py-2 text-right">{r.totalQty}</td>
                      <td className="px-3 py-2 text-right text-amber-400">{formatPrice(r.totalRevenue)}</td>
                      <td className="px-3 py-2 text-right text-gray-400">{r.pct}%</td>
                    </tr>
                    {expanded === r.id && (
                      <tr key={`${r.id}-detail`}>
                        <td colSpan={6} className="px-3 py-0 bg-gray-900/50">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-left py-1 pl-8 pr-3">Item</th>
                                <th className="text-right py-1 pr-3">Qty</th>
                                <th className="text-right py-1 pr-3">Revenue</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(itemsByCat[r.id] || []).sort((a, b) => b.revenue - a.revenue).map((d) => (
                                <tr key={d.name} className="border-t border-gray-800/50">
                                  <td className="py-1 pl-8 pr-3 text-gray-300">{d.name}</td>
                                  <td className="py-1 pr-3 text-right text-gray-400">{d.qty}</td>
                                  <td className="py-1 pr-3 text-right text-amber-400/80">{formatPrice(d.revenue)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-700 bg-gray-800/50 font-bold">
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-white">TOTAL</td>
                  <td className="px-3 py-2 text-right">{rows.reduce((s, r) => s + r.itemsSold, 0)}</td>
                  <td className="px-3 py-2 text-right">{grandQty}</td>
                  <td className="px-3 py-2 text-right text-amber-400">{formatPrice(grandTotal)}</td>
                  <td className="px-3 py-2 text-right text-gray-400">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
