import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Star,
  TrendingUp,
  ShoppingBag,
  Gift,
  Coins,
} from 'lucide-react'
import type { Customer, CustomerPurchase } from '../../types'

export default function CustomerProfile({
  customerId: customerIdProp,
  onBack,
}: {
  customerId?: string
  onBack?: () => void
} = {}) {
  const { id: routeId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const customerId = customerIdProp || routeId || ''
  const handleBack = onBack || (() => navigate('/customers'))
  const toast = useToast()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [purchases, setPurchases] = useState<CustomerPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [showPointsModal, setShowPointsModal] = useState(false)
  const [showRedeemModal, setShowRedeemModal] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const [custRes, purchaseRes] = await Promise.all([
      supabase.from('customers').select('*').eq('id', customerId).single(),
      supabase
        .from('customer_purchases')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false }),
    ])

    if (custRes.data) setCustomer(custRes.data)
    if (purchaseRes.data) setPurchases(purchaseRes.data)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [customerId])

  const addPoints = async (points: number) => {
    if (!customer || points <= 0) return
    const newTotal = (customer.loyalty_points || 0) + points
    const { error } = await supabase
      .from('customers')
      .update({ loyalty_points: newTotal })
      .eq('id', customer.id)

    if (error) {
      toast.error('Error', 'Failed to add points')
    } else {
      setCustomer({ ...customer, loyalty_points: newTotal })
      toast.success('Points Added', `${points} points added to ${customer.name}'s account`)
      setShowPointsModal(false)
    }
  }

  const redeemPoints = async (points: number) => {
    if (!customer || points <= 0) return
    if (points > (customer.loyalty_points || 0)) {
      toast.warning('Insufficient Points', 'Customer does not have enough points')
      return
    }
    const newTotal = (customer.loyalty_points || 0) - points
    const discount = points / 100
    const { error } = await supabase
      .from('customers')
      .update({ loyalty_points: newTotal })
      .eq('id', customer.id)

    if (error) {
      toast.error('Error', 'Failed to redeem points')
    } else {
      setCustomer({ ...customer, loyalty_points: newTotal })
      toast.success(
        'Points Redeemed',
        `${points} points redeemed for SSP ${discount.toFixed(2)} discount`
      )
      setShowRedeemModal(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Customer not found</p>
        <button onClick={handleBack} className="text-amber-400 text-sm mt-2 hover:underline">
          Go back
        </button>
      </div>
    )
  }

  const discountValue = (customer.loyalty_points || 0) / 100

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Customers
      </button>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{customer.name}</h1>
            {customer.phone && (
              <div className="flex items-center gap-2 text-gray-400 text-sm mt-1">
                <Phone size={13} />
                {customer.phone}
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-gray-400 text-sm mt-1">
                <Mail size={13} />
                {customer.email}
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-2 text-gray-400 text-sm mt-1">
                <MapPin size={13} />
                {customer.address}
              </div>
            )}
          </div>
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-lg ${
              customer.is_active
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
          >
            {customer.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        {customer.notes && (
          <div className="mt-3 bg-gray-800 rounded-xl px-4 py-3">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Notes</p>
            <p className="text-gray-300 text-sm">{customer.notes}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Star size={18} className="text-amber-400" />
            </div>
            <div>
              <p className="text-gray-500 text-xs">Loyalty Points</p>
              <p className="text-amber-400 text-xl font-bold">{customer.loyalty_points || 0}</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs">≈ SSP {discountValue.toFixed(2)} redeemable</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setShowPointsModal(true)}
              className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 font-medium rounded-xl py-2 text-xs transition-colors"
            >
              <Gift size={12} className="inline mr-1" />
              Add
            </button>
            <button
              onClick={() => setShowRedeemModal(true)}
              disabled={(customer.loyalty_points || 0) <= 0}
              className="flex-1 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 font-medium rounded-xl py-2 text-xs transition-colors disabled:opacity-40"
            >
              <Coins size={12} className="inline mr-1" />
              Redeem
            </button>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <TrendingUp size={18} className="text-green-400" />
            </div>
            <div>
              <p className="text-gray-500 text-xs">Total Spent</p>
              <p className="text-white text-xl font-bold">
                SSP {(customer.total_spent || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <p className="text-gray-500 text-xs">
            Avg SSP {purchases.length > 0
              ? ((customer.total_spent || 0) / purchases.length).toFixed(2)
              : '0.00'} per visit
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <ShoppingBag size={18} className="text-blue-400" />
            </div>
            <div>
              <p className="text-gray-500 text-xs">Total Visits</p>
              <p className="text-white text-xl font-bold">{customer.visit_count || 0}</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs">
            Member since {new Date(customer.created_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-white font-bold">Purchase History</h3>
        </div>
        {purchases.length === 0 ? (
          <div className="p-8 text-center">
            <ShoppingBag size={32} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No purchases recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs text-gray-500 uppercase tracking-wider px-5 py-3">Date</th>
                  <th className="text-left text-xs text-gray-500 uppercase tracking-wider px-5 py-3">Order ID</th>
                  <th className="text-right text-xs text-gray-500 uppercase tracking-wider px-5 py-3">Amount</th>
                  <th className="text-right text-xs text-gray-500 uppercase tracking-wider px-5 py-3">Points Earned</th>
                  <th className="text-right text-xs text-gray-500 uppercase tracking-wider px-5 py-3">Points Redeemed</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b border-gray-800/50">
                    <td className="px-5 py-3 text-gray-300 text-sm">
                      {new Date(purchase.created_at).toLocaleDateString('en-NG', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-sm font-mono">
                      {purchase.order_id ? purchase.order_id.slice(0, 8).toUpperCase() : '—'}
                    </td>
                    <td className="px-5 py-3 text-white text-sm text-right font-medium">
                      SSP {(purchase.amount_spent || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {(purchase.points_earned || 0) > 0 ? (
                        <span className="text-green-400 text-sm">+{purchase.points_earned}</span>
                      ) : (
                        <span className="text-gray-600 text-sm">0</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {(purchase.points_redeemed || 0) > 0 ? (
                        <span className="text-red-400 text-sm">-{purchase.points_redeemed}</span>
                      ) : (
                        <span className="text-gray-600 text-sm">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPointsModal && (
        <PointsModal
          title="Add Loyalty Points"
          color="amber"
          onConfirm={addPoints}
          onClose={() => setShowPointsModal(false)}
        />
      )}

      {showRedeemModal && (
        <PointsModal
          title="Redeem Points"
          color="green"
          maxPoints={customer.loyalty_points || 0}
          onConfirm={redeemPoints}
          onClose={() => setShowRedeemModal(false)}
        />
      )}
    </div>
  )
}

function PointsModal({
  title,
  color,
  maxPoints,
  onConfirm,
  onClose,
}: {
  title: string
  color: 'amber' | 'green'
  maxPoints?: number
  onConfirm: (points: number) => void
  onClose: () => void
}) {
  const [points, setPoints] = useState('')

  const isRedeem = color === 'green'
  const borderColor = isRedeem ? 'border-green-500' : 'border-amber-500'
  const textColor = isRedeem ? 'text-green-400' : 'text-amber-400'
  const bgHover = isRedeem ? 'hover:bg-green-400' : 'hover:bg-amber-400'
  const btnBg = isRedeem ? 'bg-green-500' : 'bg-amber-500'
  const val = parseInt(points) || 0

  const quickAmounts = isRedeem
    ? [100, 500, 1000].filter((n) => !maxPoints || n <= maxPoints)
    : [50, 100, 500]

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-sm border border-gray-800">
        <div className="p-5 border-b border-gray-800">
          <h3 className={`font-bold text-lg ${textColor}`}>{title}</h3>
          {isRedeem && maxPoints !== undefined && (
            <p className="text-gray-500 text-xs mt-1">
              Available: {maxPoints} points (SSP {(maxPoints / 100).toFixed(2)} value)
            </p>
          )}
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">Points</label>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="0"
              max={isRedeem ? maxPoints : undefined}
              className={`w-full bg-gray-800 border ${borderColor} text-white rounded-xl px-4 py-3 text-2xl font-bold focus:outline-none ${textColor}`}
            />
          </div>
          <div className="flex gap-2">
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => setPoints(String(amt))}
                className={`flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs rounded-lg py-2 transition-colors`}
              >
                {amt}
              </button>
            ))}
          </div>
          {val > 0 && (
            <div className={`bg-gray-800 border border-gray-700 rounded-xl p-3`}>
              <p className="text-gray-400 text-xs">
                {isRedeem ? 'Discount value' : 'Points value'}
              </p>
              <p className={`font-bold ${textColor}`}>
                SSP {(val / 100).toFixed(2)}
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl py-3 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(val)}
              disabled={val <= 0 || (isRedeem && maxPoints !== undefined && val > maxPoints)}
              className={`flex-1 ${btnBg} ${bgHover} disabled:bg-gray-800 disabled:text-gray-600 text-black font-bold rounded-xl py-3 text-sm transition-colors`}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
