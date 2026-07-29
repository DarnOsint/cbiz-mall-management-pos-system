import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { audit } from '../../lib/audit'
import { useAuth } from '../../context/AuthContext'
import {
  ArrowLeft,
  Plus,
  Edit2,
  X,
  Save,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  Percent,
  Tag,
} from 'lucide-react'
import { formatPrice } from '../../lib/currency'
import { useToast } from '../../context/ToastContext'
import type { Discount, ItemCategory, DiscountType, DiscountAppliesTo } from '../../types'

interface Props {
  onBack: () => void
}

interface DiscountForm {
  name: string
  code: string
  type: DiscountType
  value: string
  min_order_amount: string
  max_discount_amount: string
  applies_to: DiscountAppliesTo
  item_id: string
  category_id: string
  starts_at: string
  expires_at: string
  usage_limit: string
  is_active: boolean
}

const emptyForm: DiscountForm = {
  name: '',
  code: '',
  type: 'percentage',
  value: '',
  min_order_amount: '',
  max_discount_amount: '',
  applies_to: 'all',
  item_id: '',
  category_id: '',
  starts_at: '',
  expires_at: '',
  usage_limit: '',
  is_active: true,
}

export default function DiscountManagement({ onBack }: Props) {
  const { profile } = useAuth()
  const toast = useToast()
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [categories, setCategories] = useState<ItemCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null)
  const [form, setForm] = useState<DiscountForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchDiscounts()
    fetchCategories()
  }, [])

  const fetchDiscounts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Error', error.message)
      setLoading(false)
      return
    }
    setDiscounts((data || []) as Discount[])
    setLoading(false)
  }

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('item_categories')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    if (data) setCategories(data as ItemCategory[])
  }

  const openCreate = () => {
    setEditingDiscount(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (d: Discount) => {
    setEditingDiscount(d)
    setForm({
      name: d.name,
      code: d.code || '',
      type: d.type,
      value: String(d.value),
      min_order_amount: d.min_order_amount != null ? String(d.min_order_amount) : '',
      max_discount_amount: d.max_discount_amount != null ? String(d.max_discount_amount) : '',
      applies_to: d.applies_to,
      item_id: d.item_id || '',
      category_id: d.category_id || '',
      starts_at: d.starts_at ? d.starts_at.slice(0, 16) : '',
      expires_at: d.expires_at ? d.expires_at.slice(0, 16) : '',
      usage_limit: d.usage_limit != null ? String(d.usage_limit) : '',
      is_active: d.is_active,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.warning('Required', 'Discount name is required')
      return
    }
    if (!form.value || parseFloat(form.value) <= 0) {
      toast.warning('Required', 'Discount value must be greater than 0')
      return
    }
    if (form.type === 'percentage' && parseFloat(form.value) > 100) {
      toast.warning('Invalid', 'Percentage cannot exceed 100%')
      return
    }

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase() || null,
      type: form.type,
      value: parseFloat(form.value),
      min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
      max_discount_amount: form.max_discount_amount ? parseFloat(form.max_discount_amount) : null,
      applies_to: form.applies_to,
      item_id: form.applies_to === 'item' ? form.item_id || null : null,
      category_id: form.applies_to === 'category' ? form.category_id || null : null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null,
      is_active: form.is_active,
    }

    try {
      if (editingDiscount) {
        const { error } = await supabase
          .from('discounts')
          .update(payload)
          .eq('id', editingDiscount.id)
        if (error) throw error
        await audit({
          action: 'DISCOUNT_UPDATED',
          entity: 'discount',
          entityId: editingDiscount.id,
          entityName: form.name,
          newValue: payload,
          performer: profile,
        })
        toast.success('Updated', 'Discount updated successfully')
      } else {
        const newId = crypto.randomUUID()
        const { error } = await supabase
          .from('discounts')
          .insert({ id: newId, usage_count: 0, created_at: new Date().toISOString(), ...payload })
        if (error) throw error
        await audit({
          action: 'DISCOUNT_CREATED',
          entity: 'discount',
          entityId: newId,
          entityName: form.name,
          newValue: payload,
          performer: profile,
        })
        toast.success('Created', 'Discount created successfully')
      }
      setShowModal(false)
      fetchDiscounts()
    } catch (err) {
      toast.error('Error', (err as { message?: string })?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (d: Discount) => {
    const { error } = await supabase
      .from('discounts')
      .update({ is_active: !d.is_active })
      .eq('id', d.id)
    if (error) {
      toast.error('Error', error.message)
      return
    }
    await audit({
      action: d.is_active ? 'DISCOUNT_DEACTIVATED' : 'DISCOUNT_ACTIVATED',
      entity: 'discount',
      entityId: d.id,
      entityName: d.name,
      performer: profile,
    })
    fetchDiscounts()
  }

  const handleDelete = async (d: Discount) => {
    if (!confirm(`Delete discount "${d.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('discounts').delete().eq('id', d.id)
    if (error) {
      toast.error('Error', error.message)
      return
    }
    await audit({
      action: 'DISCOUNT_DELETED',
      entity: 'discount',
      entityId: d.id,
      entityName: d.name,
      performer: profile,
    })
    toast.success('Deleted', 'Discount removed')
    fetchDiscounts()
  }

  const filtered = discounts.filter(
    (d) =>
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.code && d.code.toLowerCase().includes(search.toLowerCase()))
  )

  const isExpired = (d: Discount) => d.expires_at && new Date(d.expires_at) < new Date()
  const isNotStarted = (d: Discount) => d.starts_at && new Date(d.starts_at) > new Date()
  const atUsageLimit = (d: Discount) => d.usage_limit != null && d.usage_count >= d.usage_limit

  return (
    <div className="min-h-full bg-gray-950">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h2 className="text-white text-2xl font-bold">Discounts</h2>
            <p className="text-gray-400 text-sm">Manage discounts and promo codes</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl px-4 py-2.5 text-sm transition-colors"
          >
            <Plus size={16} /> New Discount
          </button>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 focus-within:border-amber-500 transition-colors">
            <Search size={16} className="text-gray-500 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or code..."
              className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mx-auto mb-4">
              <Tag size={24} className="text-gray-600" />
            </div>
            <p className="text-gray-400 font-semibold mb-1">No discounts found</p>
            <p className="text-gray-600 text-xs">
              {discounts.length === 0
                ? 'Create your first discount to get started.'
                : 'Try a different search.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((d) => {
              const expired = isExpired(d)
              const notStarted = isNotStarted(d)
              const atLimit = atUsageLimit(d)
              const inactive = !d.is_active || expired || atLimit || notStarted
              return (
                <div
                  key={d.id}
                  className={`bg-gray-900 border rounded-xl p-4 flex items-center gap-4 transition-colors ${
                    inactive ? 'border-gray-800 opacity-60' : 'border-gray-800 hover:border-amber-500/30'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      d.type === 'percentage'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {d.type === 'percentage' ? <Percent size={20} /> : <Tag size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-semibold text-sm truncate">{d.name}</p>
                      {d.code && (
                        <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-amber-500/30 shrink-0">
                          {d.code}
                        </span>
                      )}
                      {expired && (
                        <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-red-500/30 shrink-0">
                          Expired
                        </span>
                      )}
                      {notStarted && (
                        <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-blue-500/30 shrink-0">
                          Scheduled
                        </span>
                      )}
                      {atLimit && (
                        <span className="bg-orange-500/20 text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-orange-500/30 shrink-0">
                          Limit reached
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>
                        {d.type === 'percentage' ? `${d.value}% off` : `${formatPrice(d.value)} off`}
                      </span>
                      <span>·</span>
                      <span>
                        {d.applies_to === 'all'
                          ? 'All items'
                          : d.applies_to === 'category'
                            ? 'Specific category'
                            : 'Specific item'}
                      </span>
                      {d.usage_limit != null && (
                        <>
                          <span>·</span>
                          <span>
                            {d.usage_count}/{d.usage_limit} used
                          </span>
                        </>
                      )}
                      {d.min_order_amount != null && (
                        <>
                          <span>·</span>
                          <span>Min {formatPrice(d.min_order_amount)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggle(d)}
                      className="text-gray-400 hover:text-white transition-colors"
                      title={d.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {d.is_active ? (
                        <ToggleRight size={22} className="text-green-400" />
                      ) : (
                        <ToggleLeft size={22} />
                      )}
                    </button>
                    <button
                      onClick={() => openEdit(d)}
                      className="text-gray-400 hover:text-amber-400 transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-gray-950 rounded-2xl w-full max-w-lg border border-gray-800 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold text-lg">
                {editingDiscount ? 'Edit Discount' : 'New Discount'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                  Name *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Holiday Sale, First Order"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                  Promo Code (optional)
                </label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SAVE10, WELCOME"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 font-mono uppercase focus:outline-none focus:border-amber-500"
                />
                <p className="text-gray-600 text-[11px] mt-1">
                  Customers enter this code at checkout. Leave empty for auto-applied discounts.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                    Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setForm({ ...form, type: 'percentage' })}
                      className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                        form.type === 'percentage'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                          : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <Percent size={14} className="inline mr-1" />
                      Percentage
                    </button>
                    <button
                      onClick={() => setForm({ ...form, type: 'fixed' })}
                      className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                        form.type === 'fixed'
                          ? 'bg-green-500/20 text-green-400 border-green-500/50'
                          : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <Tag size={14} className="inline mr-1" />
                      Fixed Amount
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                    Value * ({form.type === 'percentage' ? '%' : 'SSP'})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={form.type === 'percentage' ? '1' : '100'}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    placeholder={form.type === 'percentage' ? '10' : '5000'}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                    Min Order Amount (optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.min_order_amount}
                    onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                    placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                  />
                </div>
                {form.type === 'percentage' && (
                  <div>
                    <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                      Max Discount (optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.max_discount_amount}
                      onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })}
                      placeholder="No cap"
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                  Applies To
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'all' as DiscountAppliesTo, label: 'All Items' },
                    { value: 'category' as DiscountAppliesTo, label: 'Category' },
                    { value: 'item' as DiscountAppliesTo, label: 'Specific Item' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        setForm({
                          ...form,
                          applies_to: opt.value,
                          item_id: opt.value !== 'item' ? '' : form.item_id,
                          category_id: opt.value !== 'category' ? '' : form.category_id,
                        })
                      }
                      className={`py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                        form.applies_to === opt.value
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                          : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.applies_to === 'category' && (
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 mt-2 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Select category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                    Start Date (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                    Expiry Date (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.expires_at}
                    onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
                    Usage Limit (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.usage_limit}
                    onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <button
                    onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      form.is_active
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-gray-800 border-gray-700 text-gray-500'
                    }`}
                  >
                    {form.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    {form.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-800 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl py-3 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Save size={16} />
                {saving ? 'Saving...' : editingDiscount ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
