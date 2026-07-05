import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { audit } from '../../lib/audit'
import { ArrowLeft, Plus, X, Search } from 'lucide-react'
import type { BodaOperator, Profile } from '../../types'

interface Props {
  onBack: () => void
}

export default function DeliveryOperators({ onBack }: Props) {
  const { profile } = useAuth()
  const toast = useToast()
  const [operators, setOperators] = useState<BodaOperator[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<BodaOperator | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', service_area: '' })
  const [saving, setSaving] = useState(false)

  const fetchOperators = async () => {
    const { data } = await supabase
      .from('boda_operators')
      .select('*')
      .order('name')
    if (data) setOperators(data as BodaOperator[])
    setLoading(false)
  }

  useEffect(() => {
    fetchOperators()
  }, [])

  const filtered = operators.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.phone.includes(search) ||
    (o.service_area || '').toLowerCase().includes(search.toLowerCase())
  )

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', phone: '', service_area: '' })
    setShowForm(true)
  }

  const openEdit = (op: BodaOperator) => {
    setEditing(op)
    setForm({ name: op.name, phone: op.phone, service_area: op.service_area || '' })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.name.trim()) return toast.warning('Required', 'Name is required')
    if (!form.phone.trim()) return toast.warning('Required', 'Phone number is required')
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase
          .from('boda_operators')
          .update({ name: form.name.trim(), phone: form.phone.trim(), service_area: form.service_area.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', editing.id)
        if (error) throw error
        await audit({
          action: 'BODA_OPERATOR_UPDATED',
          entity: 'boda_operator',
          entityId: editing.id,
          entityName: form.name.trim(),
          oldValue: { name: editing.name, phone: editing.phone },
          newValue: { name: form.name.trim(), phone: form.phone.trim() },
          performer: profile as Profile,
        })
        toast.success('Updated', 'Delivery operator updated')
      } else {
        const { error } = await supabase.from('boda_operators').insert({
          name: form.name.trim(),
          phone: form.phone.trim(),
          service_area: form.service_area.trim() || null,
        })
        if (error) throw error
        await audit({
          action: 'BODA_OPERATOR_CREATED',
          entity: 'boda_operator',
          entityName: form.name.trim(),
          newValue: { name: form.name.trim(), phone: form.phone.trim() },
          performer: profile as Profile,
        })
        toast.success('Created', 'Delivery operator added')
      }
      setShowForm(false)
      setEditing(null)
      await fetchOperators()
    } catch (err) {
      toast.error('Error', (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (op: BodaOperator) => {
    const next = !op.is_active
    const { error } = await supabase
      .from('boda_operators')
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq('id', op.id)
    if (error) return toast.error('Error', error.message)
    await audit({
      action: next ? 'BODA_OPERATOR_ACTIVATED' : 'BODA_OPERATOR_DEACTIVATED',
      entity: 'boda_operator',
      entityId: op.id,
      entityName: op.name,
      performer: profile as Profile,
    })
    await fetchOperators()
  }

  return (
    <div className="min-h-full bg-gray-950">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-gray-400 hover:text-white p-1">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-white text-2xl font-bold">Delivery Operators</h2>
              <p className="text-gray-500 text-sm mt-0.5">Manage Boda Boda riders for takeaway delivery</p>
            </div>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            <Plus size={15} /> Add Rider
          </button>
        </div>

        <div className="relative mb-4 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or area..."
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        {loading ? (
          <div className="text-gray-500 text-center py-12">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">{search ? 'No operators match your search' : 'No delivery operators yet. Add your first rider.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((op) => (
              <div
                key={op.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-start gap-4"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${op.is_active ? 'bg-amber-500/20' : 'bg-gray-800'}`}>
                  <span className={`font-bold text-sm ${op.is_active ? 'text-amber-400' : 'text-gray-600'}`}>
                    {op.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold text-sm truncate">{op.name}</h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${op.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                      {op.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mt-0.5">{op.phone}</p>
                  {op.service_area && (
                    <p className="text-gray-500 text-xs mt-0.5">Area: {op.service_area}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => openEdit(op)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(op)}
                      className={`text-xs font-medium ${op.is_active ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}
                    >
                      {op.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-800">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">{editing ? 'Edit Rider' : 'Add Rider'}</h3>
              <button onClick={() => { setShowForm(false); setEditing(null) }} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1">Full Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1">Phone Number *</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. 08012345678"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1">Service Area</label>
                <input
                  value={form.service_area}
                  onChange={(e) => setForm({ ...form, service_area: e.target.value })}
                  placeholder="e.g. Lekki Phase 1"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-800 flex gap-2 justify-end">
              <button
                onClick={() => { setShowForm(false); setEditing(null) }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white font-medium"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                {saving ? 'Saving...' : editing ? 'Update' : 'Add Rider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
