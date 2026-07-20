import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { getPrintServiceUrl } from '../../../lib/printService'
import { useToast } from '../../../context/ToastContext'
import { Printer, Plus, Trash2, Save, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import type { PrinterConfig } from '../../../types'

export default function PrinterSettingsTab() {
  const toast = useToast()
  const [printers, setPrinters] = useState<PrinterConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  const checkPrintService = async () => {
    setServiceStatus('checking')
    const online = await fetch(`${getPrintServiceUrl()}/health`, {
      signal: AbortSignal.timeout(2000),
    })
      .then((r) => r.ok)
      .catch(() => false)
    setServiceStatus(online ? 'online' : 'offline')
  }

  const loadPrinters = async () => {
    setLoading(true)
    const { data } = await supabase.from('settings').select('value').eq('id', 'printers').single()

    if (data?.value) {
      const parsed = Array.isArray(data.value) ? data.value : JSON.parse(data.value)
      setPrinters(parsed)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPrinters()
    checkPrintService()
  }, [])

  const savePrinters = async (updated: PrinterConfig[]) => {
    setSaving(true)
    const { error } = await supabase.from('settings').upsert({
      id: 'printers',
      value: JSON.stringify(updated),
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) {
      toast.error('Error', 'Failed to save: ' + error.message)
      return false
    }
    setPrinters(updated)
    toast.success('Saved', 'Printer configuration updated')
    return true
  }

  const addPrinter = () => {
    const newPrinter: PrinterConfig = {
      id: crypto.randomUUID(),
      name: '',
      ip: '',
      port: 9100,
      copies: 1,
      types: ['customer', 'internal'],
    }
    savePrinters([...printers, newPrinter])
  }

  const removePrinter = (id: string) => {
    savePrinters(printers.filter((p) => p.id !== id))
  }

  const updatePrinter = (id: string, field: string, value: unknown) => {
    setPrinters((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const toggleType = (id: string, type: string) => {
    setPrinters((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        const has = p.types.includes(type as any)
        return {
          ...p,
          types: has ? p.types.filter((t) => t !== type) : [...p.types, type as any],
        }
      })
    )
  }

  const testPrinter = async (printer: PrinterConfig) => {
    setTestingId(printer.id)
    try {
      const res = await fetch(`${getPrintServiceUrl()}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: printer.ip, port: printer.port }),
        signal: AbortSignal.timeout(10000),
      })
      const result = await res.json()
      if (result.success) {
        toast.success('Test OK', `Connected to ${printer.ip}:${printer.port}`)
      } else {
        toast.error('Test Failed', result.error || 'Could not connect')
      }
    } catch (err) {
      toast.error('Test Failed', err instanceof Error ? err.message : 'Print service unreachable')
    }
    setTestingId(null)
  }

  if (loading) return <div className="text-gray-500 text-center py-8">Loading...</div>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-bold text-lg">Printer Configuration</h2>
          <p className="text-gray-400 text-sm flex items-center gap-2">
            Network thermal printers for ESC/POS receipt printing
            {serviceStatus === 'online' ? (
              <span className="flex items-center gap-1 text-green-400">
                <Wifi size={12} /> Service online
              </span>
            ) : serviceStatus === 'offline' ? (
              <span className="flex items-center gap-1 text-red-400">
                <WifiOff size={12} /> Service offline
              </span>
            ) : (
              <span className="text-gray-500">Checking service...</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={checkPrintService}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 p-2 rounded-xl"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={addPrinter}
            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-3 py-2 rounded-xl"
          >
            <Plus size={14} /> Add Printer
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {printers.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-gray-900 rounded-xl border border-gray-800">
            <Printer size={36} className="mx-auto mb-3 text-gray-600" />
            <p className="font-medium">No printers configured</p>
            <p className="text-xs mt-1">Add your network receipt printers above</p>
          </div>
        )}

        {printers.map((printer, idx) => (
          <div
            key={printer.id}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-mono">Printer {idx + 1}</span>
              <button
                onClick={() => removePrinter(printer.id)}
                className="text-red-400 hover:text-red-300 p-1"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                  Name
                </label>
                <input
                  value={printer.name}
                  onChange={(e) => updatePrinter(printer.id, 'name', e.target.value)}
                  placeholder="e.g. Cashier Printer"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                  IP Address
                </label>
                <input
                  value={printer.ip}
                  onChange={(e) => updatePrinter(printer.id, 'ip', e.target.value)}
                  placeholder="e.g. 192.168.1.50"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={printer.port}
                  onChange={(e) =>
                    updatePrinter(printer.id, 'port', parseInt(e.target.value) || 9100)
                  }
                  placeholder="9100"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                  Copies
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={printer.copies}
                  onChange={(e) =>
                    updatePrinter(printer.id, 'copies', parseInt(e.target.value) || 1)
                  }
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wide block mb-2">
                Print Types
              </label>
              <div className="flex gap-2 flex-wrap">
                {['customer', 'waiter', 'kitchen', 'bar'].map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleType(printer.id, type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      printer.types.includes(type as any)
                        ? 'bg-amber-500 text-black'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
              <button
                onClick={() => testPrinter(printer)}
                disabled={testingId === printer.id || !printer.ip}
                className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium px-3 py-2 rounded-xl disabled:opacity-50"
              >
                {testingId === printer.id ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Wifi size={12} />
                )}
                Test Connection
              </button>
              <button
                onClick={() => savePrinters(printers)}
                disabled={saving}
                className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50"
              >
                <Save size={13} /> {saving ? 'Saving...' : 'Save All'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
