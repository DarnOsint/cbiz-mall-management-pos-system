import { TrendingUp, ShoppingBag, LayoutDashboard, Users, Package, UtensilsCrossed, Wine } from 'lucide-react'
import { formatPrice } from '../../../lib/currency'
import PriceDisplay from '../../../components/PriceDisplay'

interface Stats {
  revenue: number
  openOrders: number
  occupiedTables: number
  totalTables: number
  staffOnDuty: number
  lowStock: number
  foodItems: number
  drinkItems: number
}

interface Props {
  stats: Stats
}

export default function StatCards({ stats }: Props) {
  const cards = [
    {
      label: "Today's Revenue",
      value: (
        <PriceDisplay amount={stats.revenue} className="text-white text-xl md:text-2xl font-bold" />
      ),
      icon: TrendingUp,
      color: 'text-green-400',
      bg: 'bg-green-400/10',
    },
    {
      label: 'Food Items Sold',
      value: stats.foodItems.toString(),
      icon: UtensilsCrossed,
      color: 'text-orange-400',
      bg: 'bg-orange-400/10',
    },
    {
      label: 'Drink Items Sold',
      value: stats.drinkItems.toString(),
      icon: Wine,
      color: 'text-sky-400',
      bg: 'bg-sky-400/10',
    },
    {
      label: 'Open Orders',
      value: stats.openOrders.toString(),
      icon: ShoppingBag,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
    },
    {
      label: 'Occupied Tables',
      value: `${stats.occupiedTables}/${stats.totalTables}`,
      icon: LayoutDashboard,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
    },
    {
      label: 'Staff On Duty',
      value: stats.staffOnDuty.toString(),
      icon: Users,
      color: 'text-pink-400',
      bg: 'bg-pink-400/10',
    },
    {
      label: 'Low Stock Items',
      value: stats.lowStock.toString(),
      icon: Package,
      color: stats.lowStock > 0 ? 'text-red-400' : 'text-gray-400',
      bg: stats.lowStock > 0 ? 'bg-red-400/10' : 'bg-gray-400/10',
    },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((c) => (
        <div key={c.label} className="bg-gray-900 rounded-2xl p-4 md:p-5 border border-gray-800">
          <div className={`inline-flex p-2 rounded-lg ${c.bg} mb-3`}>
            <c.icon size={18} className={c.color} />
          </div>
          <p className="text-gray-400 text-xs md:text-sm">{c.label}</p>
          <p className="text-white text-xl md:text-2xl font-bold mt-1">{c.value}</p>
        </div>
      ))}
    </div>
  )
}
