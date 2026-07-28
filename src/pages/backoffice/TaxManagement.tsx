import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { audit } from '../../lib/audit'
import { useAuth } from '../../context/AuthContext'
import { ArrowLeft, Plus, Edit2, X, Save, Trash2 } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import type { TaxRate } from '../../types'

interface Props {
  onBack: () => void
}

interface TaxForm {
  name: string
  rate: string
}

export default function TaxManagement({ onBack }: Props) {
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  const [loading, setLoading] = useState(true)
  const { profile } = useAuth()
  const toast = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<TaxRate | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<TaxForm>({ name: '', rate: '' })

  const fetchAll = useCallback(async () => {
    const { data } = await supabase.from('tax_rates').select('*').order('name')
    if (data) setTaxRates(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', rate: '' })
    setShowModal(true)
  }

  const openEdit = (tr: TaxRate) => {
    setEditing(tr)
    setForm({ name: tr.name, rate: tr.rate.toString() })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.name || !form.rate)
      return toast.warning('Required', 'Name and rate are required')
    const rateNum = parseFloat(form.rate)
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100)
      return toast.warning('Invalid', 'Rate must be between 0 and 100')
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase
          .from('tax_rates')
          .update({ name: form.name, rate: rateNum })
          .eq('id', editing.id)
        if (error) throw error
        audit({
          action: 'TAX_RATE_UPDATED',
          entity: 'tax_rate',
          entityId: editing.id,
          entityName: form.name,
          newValue: { name: form.name, rate: rateNum },
          performer: profile as any,
        })
      } else {
        const { data, error } = await supabase
          .from('tax_rates')
          .insert({ name: form.name, rate: rateNum, is_active: true, is_default: taxRates.length === 0 })
          .select('id')
          .single()
        if (error) throw error
        audit({
          action: 'TAX_RATE_CREATED',
          entity: 'tax_rate',
          entityId: data?.id,
          entityName: form.name,
          newValue: { name: form.name, rate: rateNum },
          performer: profile as any,
        })
      }
      await fetchAll()
      setShowModal(false)
    } catch (err) {
      toast.error('Error', (err as { message?: string }).message || JSON.stringify(err))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (tr: TaxRate) => {
    const { error } = await supabase
      .from('tax_rates')
      .update({ is_active: !tr.is_active })
      .eq('id', tr.id)
    if (error) {
      toast.error('Error', error.message)
      return
    }
    audit({
      action: tr.is_active ? 'TAX_RATE_DISABLED' : 'TAX_RATE_ENABLED',
      entity: 'tax_rate',
      entityId: tr.id,
      entityName: tr.name,
      performer: profile as any,
    })
    fetchAll()
  }

  const setDefault = async (tr: TaxRate) => {
    if (tr.is_default) return
    const updates = taxRates.map((t) =>
      t.id === tr.id
        ? supabase.from('tax_rates').update({ is_default: true }).eq('id', t.id)
        : t.is_default
          ? supabase.from('tax_rates').update({ is_default: false }).eq('id', t.id)
          : null
    ).filter(Boolean)
    await Promise.all(updates)
    audit({
      action: 'TAX_RATE_DEFAULT_CHANGED',
      entity: 'tax_rate',
      entityId: tr.id,
      entityName: tr.name,
      performer: profile as any,
    })
    fetchAll()
  }

  const deleteRate = async (tr: TaxRate) => {
    if (tr.is_default) {
      toast.warning('Cannot delete', 'Cannot delete the default tax rate')
      return
    }
    const { error } = await supabase.from('tax_rates').delete().eq('id', tr.id)
    if (error) {
      toast.error('Error', error.message)
      return
    }
    audit({
      action: 'TAX_RATE_DELETED',
      entity: 'tax_rate',
      entityId: tr.id,
      entityName: tr.name,
      performer: profile as any,
    })
    fetchAll()
  }

  void audit

  return (
    <div className="min-h-full bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-white font-bold">Tax Rate Management</h1>
            <p className="text-gray-400 text-xs">
              {taxRates.length} tax rate{taxRates.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-xl text-xs"
        >
          <Plus size={14} /> Add Tax Rate
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="text-amber-500 text-center py-12">Loading...</div>
        ) : taxRates.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No tax rates configured</div>
        ) : (
          <div className="max-w-3xl">
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide font-medium">
                <div className="col-span-3">Name</div>
                <div className="col-span-2">Rate</div>
                <div className="col-span-2">Default</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3 text-right">Actions</div>
              </div>
              {taxRates.map((tr) => (
                <div
                  key={tr.id}
                  className={`grid grid-cols-12 gap-4 px-4 py-3 items-center border-b border-gray-800 last:border-b-0 ${!tr.is_active ? 'opacity-50' : ''}`}
                >
                  <div className="col-span-3">
                    <p className="text-white font-medium text-sm">{tr.name}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-amber-400 font-bold text-sm">{tr.rate}%</span>
                  </div>
                  <div className="col-span-2">
                    <button
                      onClick={() => setDefault(tr)}
                      className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${tr.is_default ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
                    >
                      {tr.is_default ? 'Default' : 'Set Default'}
                    </button>
                  </div>
                  <div className="col-span-2">
                    <button
                      onClick={() => toggleActive(tr)}
                      className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${tr.is_active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}
                    >
                      {tr.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEdit(tr)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Edit2 size={15} />
                    </button>
                    {!tr.is_default && (
                      <button
                        onClick={() => deleteRate(tr)}
                        className="text-gray-400 hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 p-4 overflow-y-auto">
          <div className="min-h-full flex items-start justify-center py-6">
            <div className="bg-gray-900 rounded-2xl w-full max-w-sm border border-gray-800 flex flex-col max-h-[calc(100vh-4rem)]">
              <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
                <h3 className="text-white font-bold">
                  {editing ? 'Edit Tax Rate' : 'Add Tax Rate'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 space-y-4 overflow-y-auto min-h-0">
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                    Name *
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                    placeholder="e.g. VAT"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                    Rate (%) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    value={form.rate}
                    onChange={(e) => setForm({ ...form, rate: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                    placeholder="e.g. 16"
                  />
                </div>
                <button
                  onClick={save}
                  disabled={saving}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2"
                >
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Tax Rate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
