import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { setActiveCurrency, setExchangeRate, invalidateCurrencyCache } from '../../lib/currency'
import { ArrowLeft, DollarSign } from 'lucide-react'

interface Props {
  onBack: () => void
}

export default function CurrencyConfig({ onBack }: Props) {
  const [currency, setCurrency] = useState<'SSP' | 'USD'>('SSP')
  const [rate, setRate] = useState('2200')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase
      .from('settings')
      .select('id, value')
      .in('id', ['active_currency', 'exchange_rate'])
      .then(({ data }) => {
        if (!data) return
        const map = Object.fromEntries(data.map((r) => [r.id, r.value]))
        if (map['active_currency'] === 'USD') setCurrency('USD')
        if (map['exchange_rate']) setRate(map['exchange_rate'])
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await setActiveCurrency(currency)
      const rateNum = parseFloat(rate)
      if (!isNaN(rateNum) && rateNum > 0) {
        await setExchangeRate(rateNum)
      }
      setMessage('Currency settings saved.')
    } catch {
      setMessage('Failed to save.')
    }
    setSaving(false)
  }

  return (
    <div className="min-h-full bg-gray-950">
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="text-gray-400 hover:text-white p-1">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-white text-xl font-bold">Currency Settings</h2>
        </div>

        <div className="max-w-md space-y-6">
          <div>
            <label className="text-gray-400 text-sm block mb-2">Active Currency</label>
            <div className="flex gap-3">
              <button
                onClick={() => setCurrency('SSP')}
                className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-colors ${
                  currency === 'SSP'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                SSP — South Sudanese Pound
              </button>
              <button
                onClick={() => setCurrency('USD')}
                className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-colors ${
                  currency === 'USD'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                $ — US Dollar
              </button>
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-2">
              Exchange Rate <span className="text-gray-600">(1 USD = ? SSP)</span>
            </label>
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:border-amber-500 focus:outline-none"
              placeholder="2200"
              min="0"
              step="0.01"
            />
            <p className="text-gray-600 text-xs mt-1">
              Used to convert between SSP and Dollar in reports.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-medium py-3 px-4 rounded-xl transition-colors"
          >
            {saving ? 'Saving...' : 'Save Currency Settings'}
          </button>

          {message && <p className="text-center text-sm text-green-400">{message}</p>}
        </div>
      </div>
    </div>
  )
}
