import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { setExchangeRate, getExchangeRate } from '../../../lib/currency'
import { Save } from 'lucide-react'

export default function CurrencySelector() {
  const [rate, setRate] = useState('2200')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase
      .from('settings')
      .select('value')
      .eq('id', 'exchange_rate')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const raw = String(data.value).replace(/"/g, '')
          setRate(raw)
        }
      })
  }, [])

  const saveRate = async () => {
    const parsed = parseFloat(rate)
    if (isNaN(parsed) || parsed <= 0) {
      setMessage('Enter a valid rate')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      await setExchangeRate(parsed)
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('id', 'exchange_rate')
        .maybeSingle()
      const saved = data?.value ? parseFloat(String(data.value).replace(/"/g, '')) : null
      if (saved !== parsed) {
        setMessage('Save failed — check permissions')
        return
      }
      setRate(String(saved))
      setMessage(`Rate set: $1 = SSP ${saved.toLocaleString()}`)
    } catch {
      setMessage('Save failed — try again')
    } finally {
      setSaving(false)
    }
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 md:p-5 mb-8">
      <h3 className="text-white font-semibold text-sm md:text-base mb-1">
        SSP → USD Exchange Rate
      </h3>
      <p className="text-gray-500 text-xs mb-4">
        All prices display in USD. The SSP equivalent shows underneath. Current rate:{' '}
        <span className="text-amber-400">$1 = SSP {getExchangeRate().toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">$1 = SSP</span>
          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="Exchange rate"
            className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm w-40 focus:outline-none focus:border-amber-500"
          />
        </div>
        <button
          onClick={saveRate}
          disabled={saving}
          className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
        >
          <Save size={14} /> {saving ? 'Saving...' : 'Update Rate'}
        </button>
        {message && <span className="text-green-400 text-sm">{message}</span>}
      </div>
    </div>
  )
}
