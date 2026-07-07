import { useState, useEffect } from 'react'
import {
  ShoppingBag,
  LayoutDashboard,
  Users,
  TrendingUp,
  Clock,
  Settings,
  BookOpen,
  ChevronRight,
  UtensilsCrossed,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import UnassignedCustomerOrders from '../../../components/UnassignedCustomerOrders'
import { formatPrice } from '../../../lib/currency'

interface Stats {
  openOrders: number
  occupiedTables: number
  todayRevenue: number
}

interface Props {
  stats: Stats
  onTabChange: (tab: string) => void
}

export default function OverviewTab({ stats, onTabChange }: Props) {
  const navigate = useNavigate()
  const [totalTables, setTotalTables] = useState(0)

  useEffect(() => {
    supabase
      .from('tables')
      .select('id', { count: 'exact', head: true })
      .then((t) => {
        setTotalTables(t.count || 0)
      })
  }, [])

  const kpis = [
    {
      label: 'Open Orders',
      value: stats.openOrders,
      icon: ShoppingBag,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
    },
    {
      label: 'Occupied Tables',
      value: `${stats.occupiedTables}/${totalTables || '—'}`,
      icon: LayoutDashboard,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
    },
    {
      label: 'Staff',
      value: '-',
      icon: Users,
      color: 'text-green-400',
      bg: 'bg-green-400/10',
    },
    {
      label: 'Revenue Today',
      value: formatPrice(stats.todayRevenue),
      icon: TrendingUp,
      color: 'text-pink-400',
      bg: 'bg-pink-400/10',
    },
  ]

  const actions = [

    {
      label: 'Assign Tables',
      sub: 'Assign tables to waitrons',
      action: () => onTabChange('tables'),
      icon: Users,
    },
    {
      label: 'View Open Orders',
      sub: 'Monitor active orders',
      action: () => onTabChange('orders'),
      icon: ShoppingBag,
    },
    {
      label: 'Kitchen Stock',
      sub: 'Reconcile food input, yield & benchmarks',
      action: () => onTabChange('kitchen'),
      icon: UtensilsCrossed,
    },
    {
      label: 'Accounting',
      sub: 'Sales reports, trends and expenses',
      action: () => navigate('/accounting'),
      icon: BookOpen,
    },
    {
      label: 'Back Office',
      sub: 'Menu, staff and table config',
      action: () => navigate('/backoffice'),
      icon: Settings,
    },
  ]

  return (
    <div className="space-y-4">
      <UnassignedCustomerOrders />
      <div className="grid grid-cols-2 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className={`inline-flex p-2 rounded-lg ${k.bg} mb-2`}>
              <k.icon size={18} className={k.color} />
            </div>
            <p className="text-gray-400 text-xs">{k.label}</p>
            <p className="text-white text-xl font-bold mt-0.5">{k.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
        <h3 className="text-white font-semibold mb-3">Quick Actions</h3>
        <div className="space-y-2">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.action}
              className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded-xl p-3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <a.icon size={16} className="text-amber-400" />
                </div>
                <div className="text-left">
                  <p className="text-white text-sm font-medium">{a.label}</p>
                  <p className="text-gray-400 text-xs">{a.sub}</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
