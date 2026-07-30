import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Edit2, X, Save, Plus, Trash2, Filter } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { formatPrice } from '../../lib/currency'

interface Floor {
  id: string
  name: string
  hire_fee?: number | null
  min_spend?: number | null
}

interface Shop {
  id: string
  name: string
  shop_number?: string | null
  capacity: number
  size_sqm?: number | null
  status: string
  category_id: string
  tenant_name?: string | null
  tenant_phone?: string | null
  tenant_email?: string | null
  lease_start?: string | null
  lease_end?: string | null
  category?: string | null
  table_categories?: { id: string; name: string } | null
}

interface ShopForm {
  name: string
  shop_number: string
  capacity: string
  size_sqm: string
  category_id: string
  tenant_name: string
  tenant_phone: string
  tenant_email: string
  lease_start: string
  lease_end: string
  category: string
  status: string
}

const FLOOR_COLORS: Record<string, string> = {
  'Ground Floor': 'bg-blue-500/20 text-blue-400',
  'First Floor': 'bg-green-500/20 text-green-400',
  'Second Floor': 'bg-yellow-500/20 text-yellow-400',
}

const inp =
  'w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500'

export default function ShopConfig() {
  const [shops, setShops] = useState<Shop[]>([])
  const [floors, setFloors] = useState<Floor[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Shop | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<ShopForm>({
    name: '',
    shop_number: '',
    capacity: '0',
    size_sqm: '20',
    category_id: '',
    tenant_name: '',
    tenant_phone: '',
    tenant_email: '',
    lease_start: '',
    lease_end: '',
    category: 'shop',
    status: 'available',
  })
  const [saving, setSaving] = useState(false)
  const [filterFloor, setFilterFloor] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const toast = useToast()

  const fetchAll = async () => {
    try {
      const [shopsRes, floorsRes] = await Promise.all([
        supabase
          .from('tables')
          .select('*, table_categories(id, name)')
          .order('shop_number', { ascending: true, nullsFirst: false }),
        supabase.from('table_categories').select('id, name, hire_fee').order('name'),
      ])
      if (shopsRes.error) throw shopsRes.error
      if (floorsRes.error) throw floorsRes.error
      setShops((shopsRes.data || []) as Shop[])
      setFloors((floorsRes.data || []) as Floor[])
    } catch (err) {
      toast.error('Error loading shops', String(err))
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const openEdit = (shop: Shop) => {
    setEditing(shop)
    setShowAdd(false)
    setForm({
      name: shop.name,
      shop_number: shop.shop_number || '',
      capacity: shop.capacity.toString(),
      size_sqm: shop.size_sqm?.toString() || '20',
      category_id: shop.category_id,
      tenant_name: shop.tenant_name || '',
      tenant_phone: shop.tenant_phone || '',
      tenant_email: shop.tenant_email || '',
      lease_start: shop.lease_start || '',
      lease_end: shop.lease_end || '',
      category: shop.category || 'shop',
      status: shop.status,
    })
  }

  const openAdd = () => {
    setEditing(null)
    setShowAdd(true)
    setForm({
      name: '',
      shop_number: '',
      capacity: '0',
      size_sqm: '20',
      category_id: floors[0]?.id || '',
      tenant_name: '',
      tenant_phone: '',
      tenant_email: '',
      lease_start: '',
      lease_end: '',
      category: 'shop',
      status: 'available',
    })
  }

  const saveShop = async () => {
    if (!form.name || !form.category_id) {
      toast.warning('Required', 'Shop name and floor are required')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase
          .from('tables')
          .update({
            name: form.name,
            shop_number: form.shop_number || null,
            capacity: parseInt(form.capacity) || 0,
            size_sqm: parseFloat(form.size_sqm) || null,
            category_id: form.category_id,
            tenant_name: form.tenant_name || null,
            tenant_phone: form.tenant_phone || null,
            tenant_email: form.tenant_email || null,
            lease_start: form.lease_start || null,
            lease_end: form.lease_end || null,
            category: form.category,
            status: form.status,
          })
          .eq('id', editing.id)
        if (error) throw error
        toast.success('Updated', `${form.name} updated`)
      } else {
        const floorName = floors.find((f) => f.id === form.category_id)?.name || ''
        const { error } = await supabase.from('tables').insert({
          name: form.name,
          shop_number: form.shop_number || null,
          capacity: parseInt(form.capacity) || 0,
          size_sqm: parseFloat(form.size_sqm) || null,
          category_id: form.category_id,
          tenant_name: form.tenant_name || null,
          tenant_phone: form.tenant_phone || null,
          tenant_email: form.tenant_email || null,
          lease_start: form.lease_start || null,
          lease_end: form.lease_end || null,
          category: form.category,
          status: 'available',
          floor: floorName,
        })
        if (error) throw error
        toast.success('Added', `${form.name} added`)
      }
      await fetchAll()
      setEditing(null)
      setShowAdd(false)
    } catch (err) {
      toast.error('Error', (err as { message?: string }).message || JSON.stringify(err))
    } finally {
      setSaving(false)
    }
  }

  const deleteShop = async (shop: Shop) => {
    if (!confirm(`Delete "${shop.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('tables').delete().eq('id', shop.id)
    if (error) {
      toast.error('Error', error.message)
      return
    }
    toast.success('Deleted', `${shop.name} removed`)
    fetchAll()
  }

  // Bulk add
  const [bulkFloor, setBulkFloor] = useState('')
  const [bulkCount, setBulkCount] = useState('10')
  const [bulkAdding, setBulkAdding] = useState(false)

  useEffect(() => {
    if (floors.length > 0 && !bulkFloor) setBulkFloor(floors[0].id)
  }, [floors, bulkFloor])

  const bulkAddShops = async () => {
    const count = parseInt(bulkCount)
    const floorId = bulkFloor
    if (!floorId || !count || count < 1) return
    const floorObj = floors.find((f) => f.id === floorId)
    const floorName = floorObj?.name || 'Floor'
    const prefix = floorName === 'Ground Floor' ? 'G-' : floorName === 'First Floor' ? '1-' : '2-'

    setBulkAdding(true)
    try {
      const floorShops = shops.filter((s) => s.category_id === floorId)
      const maxNum = floorShops.reduce((max, s) => {
        const match = s.shop_number?.match(/(\d+)$/)
        return match ? Math.max(max, parseInt(match[1])) : max
      }, 0)

      const newShops = Array.from({ length: count }, (_, i) => {
        const num = maxNum + i + 1
        const shopNum = prefix + String(num).padStart(2, '0')
        return {
          name: `Shop ${shopNum}`,
          shop_number: shopNum,
          capacity: 0,
          size_sqm: 20 + Math.floor(Math.random() * 30),
          category_id: floorId,
          status: 'available' as const,
          category: 'shop',
          floor: floorName,
        }
      })
      const { error } = await supabase.from('tables').insert(newShops)
      if (error) throw error
      toast.success('Added', `${count} shops added to ${floorName}`)
      fetchAll()
    } catch (err) {
      toast.error('Error', (err as { message?: string }).message || JSON.stringify(err))
    } finally {
      setBulkAdding(false)
    }
  }

  const filtered = shops.filter((s) => {
    if (filterFloor !== 'All' && s.table_categories?.name !== filterFloor) return false
    if (filterStatus !== 'All' && s.status !== filterStatus) return false
    return true
  })

  const floorColor = (name?: string) =>
    name ? FLOOR_COLORS[name] || 'bg-gray-700 text-gray-400' : 'bg-gray-700 text-gray-400'

  const statusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'text-green-400'
      case 'occupied':
        return 'text-amber-400'
      case 'maintenance':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  const nextShopNumber = () => {
    if (!form.category_id) return ''
    const floorShops = shops.filter((s) => s.category_id === form.category_id)
    const floorName = floors.find((f) => f.id === form.category_id)?.name || ''
    const prefix = floorName === 'Ground Floor' ? 'G-' : floorName === 'First Floor' ? '1-' : '2-'
    const maxNum = floorShops.reduce((max, s) => {
      const match = s.shop_number?.match(/(\d+)$/)
      return match ? Math.max(max, parseInt(match[1])) : max
    }, 0)
    return prefix + String(maxNum + 1).padStart(2, '0')
  }

  return (
    <div className="p-6 space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {floors.map((f) => {
          const count = shops.filter((s) => s.category_id === f.id).length
          const occ = shops.filter((s) => s.category_id === f.id && s.status === 'occupied').length
          const col = floorColor(f.name)
          return (
            <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className={`text-xs font-medium ${col} inline-block px-2 py-0.5 rounded-lg mb-2`}>
                {f.name}
              </p>
              <p className="text-white text-2xl font-bold">{count}</p>
              <p className="text-gray-500 text-xs">
                {occ} occupied · {count - occ} available
              </p>
            </div>
          )
        })}
      </div>

      {/* Bulk add */}
      {floors.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-white text-sm font-medium mb-3">Quick Add Multiple Shops</p>
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <label className="text-gray-500 text-[10px] uppercase block mb-1">Count</label>
              <input
                type="number"
                min="1"
                max="100"
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
                className="w-20 bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="text-gray-500 text-[10px] uppercase block mb-1">Floor</label>
              <select
                value={bulkFloor}
                onChange={(e) => setBulkFloor(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
              >
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={bulkAddShops}
              disabled={bulkAdding}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-sm"
            >
              {bulkAdding ? 'Adding...' : `Add ${bulkCount} Shops`}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto items-center">
        <Filter size={14} className="text-gray-500" />
        {['All', ...floors.map((f) => f.name)].map((floor) => (
          <button
            key={floor}
            onClick={() => setFilterFloor(floor)}
            className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              filterFloor === floor
                ? 'bg-amber-500 text-black'
                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {floor}
          </button>
        ))}
        <div className="w-px h-6 bg-gray-800 mx-1" />
        {['All', 'available', 'occupied', 'maintenance'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              filterStatus === s
                ? 'bg-amber-500 text-black'
                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <button
          onClick={openAdd}
          className="ml-auto flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-2 rounded-xl text-sm"
        >
          <Plus size={14} /> Add Shop
        </button>
      </div>

      {/* Shop grid */}
      {loading ? (
        <div className="text-amber-500 text-center py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No shops found. Use the quick add above or create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((shop) => (
            <div
              key={shop.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col gap-2 hover:border-amber-500/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <span
                  className={`text-xs px-2 py-0.5 rounded-lg ${floorColor(shop.table_categories?.name)}`}
                >
                  {shop.shop_number || shop.name}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(shop)} className="text-gray-400 hover:text-white">
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => deleteShop(shop)}
                    className="text-gray-400 hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="text-white font-semibold text-sm truncate">{shop.name}</p>
              <div className="flex items-center gap-2 text-xs">
                <span className={statusColor(shop.status)}>
                  {shop.status.charAt(0).toUpperCase() + shop.status.slice(1)}
                </span>
                <span className="text-gray-500">{shop.size_sqm || shop.capacity} m²</span>
              </div>
              {shop.tenant_name && (
                <p className="text-gray-400 text-xs truncate">{shop.tenant_name}</p>
              )}
              {shop.lease_end && (
                <p className="text-gray-500 text-xs">
                  Lease ends: {new Date(shop.lease_end).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Shop Modal */}
      {(editing || showAdd) && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg border border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-gray-900">
              <h3 className="text-white font-bold">{editing ? 'Edit Shop' : 'Add New Shop'}</h3>
              <button
                onClick={() => {
                  setEditing(null)
                  setShowAdd(false)
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                    Shop Name
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Shop G-01"
                    className={inp}
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                    Shop Number
                  </label>
                  <input
                    value={form.shop_number}
                    onChange={(e) => setForm({ ...form, shop_number: e.target.value })}
                    placeholder={showAdd ? nextShopNumber() : 'e.g. G-01'}
                    className={inp}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                    Floor
                  </label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className={inp}
                  >
                    <option value="" disabled>
                      Select floor...
                    </option>
                    {floors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                    Size (m²)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.size_sqm}
                    onChange={(e) => setForm({ ...form, size_sqm: e.target.value })}
                    className={inp}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className={inp}
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="reserved">Reserved</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className={inp}
                  >
                    <option value="shop">Shop</option>
                    <option value="kiosk">Kiosk</option>
                    <option value="restroom">Restroom</option>
                    <option value="elevator">Elevator</option>
                    <option value="staircase">Staircase</option>
                    <option value="escalator">Escalator</option>
                    <option value="entrance">Entrance</option>
                    <option value="common">Common Area</option>
                    <option value="storage">Storage</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <p className="text-gray-400 text-xs uppercase tracking-wide block mb-3">
                  Tenant Info
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                      Tenant Name
                    </label>
                    <input
                      value={form.tenant_name}
                      onChange={(e) => setForm({ ...form, tenant_name: e.target.value })}
                      placeholder="Tenant business name"
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                      Phone
                    </label>
                    <input
                      value={form.tenant_phone}
                      onChange={(e) => setForm({ ...form, tenant_phone: e.target.value })}
                      placeholder="+1 234 567 890"
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                      Email
                    </label>
                    <input
                      value={form.tenant_email}
                      onChange={(e) => setForm({ ...form, tenant_email: e.target.value })}
                      placeholder="tenant@example.com"
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                      Lease Start
                    </label>
                    <input
                      type="date"
                      value={form.lease_start}
                      onChange={(e) => setForm({ ...form, lease_start: e.target.value })}
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                      Lease End
                    </label>
                    <input
                      type="date"
                      value={form.lease_end}
                      onChange={(e) => setForm({ ...form, lease_end: e.target.value })}
                      className={inp}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={saveShop}
                disabled={saving}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={16} /> {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Shop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
