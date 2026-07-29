import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { audit } from '../../lib/audit'
import { useAuth } from '../../context/AuthContext'
import { ArrowLeft, Plus, Edit2, X, Save, ToggleLeft, ToggleRight, Search, Tag, ScanBarcode } from 'lucide-react'
import { formatPrice } from '../../lib/currency'
import { useToast } from '../../context/ToastContext'

interface ItemCategory {
  id: string
  name: string
}
interface Item {
  id: string
  name: string
  price: number
  description?: string
  image_url?: string | null
  is_available: boolean
  category_id: string
  item_categories?: ItemCategory | null
  barcode?: string | null
}
interface ItemForm {
  name: string
  category_id: string
  price: string
  description: string
  image_url: string
  is_available: boolean
  barcode: string
}
interface CatForm {
  name: string
}

interface Props {
  onBack: () => void
}

export default function MenuManagement({ onBack }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<ItemCategory[]>([])
  const [loading, setLoading] = useState(true)
  const { profile } = useAuth()
  const toast = useToast()
  const [showItemModal, setShowItemModal] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [editingCat, setEditingCat] = useState<ItemCategory | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('All')
  const [view, setView] = useState<'items' | 'categories'>('items')
  const [itemForm, setItemForm] = useState<ItemForm>({
    name: '',
    category_id: '',
    price: '',
    description: '',
    image_url: '',
    is_available: true,
    barcode: '',
  })
  const [catForm, setCatForm] = useState<CatForm>({ name: '' })

  const fetchAll = useCallback(async () => {
    const [itemsRes, catsRes] = await Promise.all([
      supabase.from('item').select('*, item_categories(id, name)').order('name'),
      supabase.from('item_categories').select('*').order('name'),
    ])
    if (itemsRes.data) setItems(itemsRes.data)
    if (catsRes.data) setCategories(catsRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const openAddItem = () => {
    setEditingItem(null)
    setItemForm({
      name: '',
      category_id: categories[0]?.id || '',
      price: '',
      description: '',
      image_url: '',
      is_available: true,
      barcode: '',
    })
    setShowItemModal(true)
  }
  const openEditItem = async (item: Item) => {
    setEditingItem(item)
    setItemForm({
      name: item.name,
      category_id: item.category_id,
      price: item.price.toString(),
      description: item.description || '',
      image_url: item.image_url || '',
      is_available: item.is_available,
      barcode: item.barcode || '',
    })
    setShowItemModal(true)
  }

  const uploadMenuImage = async (file: File) => {
    if (!editingItem?.id) {
      toast.warning('Save first', 'Please save the item first, then upload the image.')
      return
    }
    try {
      setSaving(true)
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('You are not logged in')

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })

      const resp = await fetch('/api/admin/menu-item-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ menuItemId: editingItem.id, dataUrl }),
      })
      const json = (await resp.json()) as { ok?: boolean; imageUrl?: string; error?: string }
      if (!resp.ok || !json.ok || !json.imageUrl) {
        throw new Error(json.error || 'Upload failed')
      }
      setItemForm((f) => ({ ...f, image_url: json.imageUrl }))
      toast.success('Uploaded', 'Menu item image updated')
      await fetchAll()
    } catch (err) {
      toast.error('Upload error', (err as { message?: string }).message || JSON.stringify(err))
    } finally {
      setSaving(false)
    }
  }
  const saveItem = async () => {
    if (!itemForm.name || !itemForm.category_id)
      return toast.warning('Required', 'Name and category are required')
    setSaving(true)
    const payload = {
      name: itemForm.name,
      category_id: itemForm.category_id,
      price: parseFloat(itemForm.price || '0'),
      description: itemForm.description,
      image_url: itemForm.image_url || null,
      is_available: itemForm.is_available,
      barcode: itemForm.barcode || null,
    }
    let savedItemId: string | undefined
    try {
      if (editingItem) {
        const { error } = await supabase.from('item').update(payload).eq('id', editingItem.id)
        if (error) throw error
        savedItemId = editingItem.id
        audit({
          action: 'MENU_ITEM_UPDATED',
          entity: 'item',
          entityId: editingItem.id,
          entityName: itemForm.name,
          newValue: payload,
          performer: profile as any,
        })
      } else {
        const { data: inserted, error } = await supabase
          .from('item')
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error
        savedItemId = inserted?.id
        audit({
          action: 'MENU_ITEM_CREATED',
          entity: 'item',
          entityId: inserted?.id,
          entityName: itemForm.name,
          newValue: payload,
          performer: profile as any,
        })
        // Auto-add to main store inventory for bar items (not kitchen, griller, mixologist)
        if (inserted) {
          const cat = categories.find((c) => c.id === itemForm.category_id)
          if (cat?.name !== 'Cocktails') {
            await supabase.from('inventory').insert({
              item_name: itemForm.name,
              category: cat?.name || 'Drinks',
              unit: 'bottles',
              current_stock: 0,
              minimum_stock: 5,
              cost_price: 0,
              selling_price: parseFloat(itemForm.price) || 0,
              menu_item_id: inserted.id,
              is_active: true,
            })
          }
        }
      }
      if (!savedItemId) return toast.error('Error', 'Failed to determine item ID')
      if (itemForm.barcode) {
        await supabase.from('item_barcodes').upsert({
          item_id: savedItemId,
          barcode: itemForm.barcode,
          is_primary: true,
        }, { onConflict: 'barcode' })
      }
      await fetchAll()
      setShowItemModal(false)
    } catch (err) {
      toast.error('Error', (err as { message?: string }).message || JSON.stringify(err))
    } finally {
      setSaving(false)
    }
  }
  const toggleAvailable = async (item: Item) => {
    const { error } = await supabase
      .from('item')
      .update({ is_available: !item.is_available })
      .eq('id', item.id)
    if (error) {
      toast.error('Toggle failed', (error as { message?: string }).message || JSON.stringify(error))
      return
    }
    audit({
      action: item.is_available ? 'MENU_ITEM_DISABLED' : 'MENU_ITEM_ENABLED',
      entity: 'item',
      entityId: item.id,
      entityName: item.name,
      performer: profile as any,
    })
    fetchAll()
  }
  const openAddCat = () => {
    setEditingCat(null)
    setCatForm({ name: '' })
    setShowCatModal(true)
  }
  const openEditCat = (cat: ItemCategory) => {
    setEditingCat(cat)
    setCatForm({ name: cat.name })
    setShowCatModal(true)
  }
  const saveCat = async () => {
    if (!catForm.name) return toast.warning('Required', 'Category name is required')
    setSaving(true)
    try {
      const { error } = editingCat
        ? await supabase
            .from('item_categories')
            .update({ name: catForm.name })
            .eq('id', editingCat.id)
        : await supabase
            .from('item_categories')
            .insert({ name: catForm.name })
      if (error) throw error
      await fetchAll()
      setShowCatModal(false)
    } catch (err) {
      toast.error('Error', (err as { message?: string }).message || JSON.stringify(err))
    } finally {
      setSaving(false)
    }
  }

  void audit // suppress unused import warning

  const filtered = items.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'All' || item.item_categories?.name === filterCat
    return matchSearch && matchCat
  })

  const categoryColor = (name?: string) => {
    const colors: Record<string, string> = {
      Food: 'bg-green-500/20 text-green-400',
      Drinks: 'bg-blue-500/20 text-blue-400',
    }
    return name ? colors[name] || 'bg-gray-700 text-gray-400' : 'bg-gray-700 text-gray-400'
  }

  return (
    <div className="min-h-full bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-white font-bold">Item Management</h1>
            <p className="text-gray-400 text-xs">
              {items.length} items · {categories.length} categories
            </p>
          </div>
        </div>
        {view === 'items' ? (
          <button
            onClick={openAddItem}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-xl text-xs"
          >
            <Plus size={14} /> Add Item
          </button>
        ) : (
          <button
            onClick={openAddCat}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-xl text-xs"
          >
            <Plus size={14} /> Add Category
          </button>
        )}
      </div>

      <div className="bg-gray-900 border-b border-gray-800 px-4 flex gap-1 py-2">
        <button
          onClick={() => setView('items')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'items' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}`}
        >
          Menu Items
        </button>
        <button
          onClick={() => setView('categories')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${view === 'categories' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}`}
        >
          <Tag size={14} /> Categories
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : view === 'items' ? (
          <>
            <div className="flex flex-col md:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search menu items..."
                  className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {['All', ...categories.map((c) => c.name)].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCat(cat)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${filterCat === cat ? 'bg-amber-500 text-black' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No items found</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    className={`bg-gray-900 border rounded-xl p-4 flex items-center justify-between gap-3 ${item.is_available ? 'border-gray-800' : 'border-gray-800 opacity-50'}`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center shrink-0">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-gray-600 text-xs">IMG</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-lg ${categoryColor(item.item_categories?.name)}`}
                        >
                          {item.item_categories?.name}
                        </span>
                      </div>
                      <h3 className="text-white font-medium text-sm truncate">{item.name}</h3>
                      <div className="flex items-center gap-2">
                        <p className="text-amber-400 font-bold text-sm">{formatPrice(item.price)}</p>
                      </div>
                      {item.barcode && (
                        <p className="text-gray-500 text-[10px] mt-1">Code: {item.barcode}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEditItem(item)}
                        className="text-gray-400 hover:text-white"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => toggleAvailable(item)}>
                        {item.is_available ? (
                          <ToggleRight size={22} className="text-green-400" />
                        ) : (
                          <ToggleLeft size={22} className="text-gray-500" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl">
            {categories.map((cat) => {
              return (
                <div
                  key={cat.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-white font-semibold">{cat.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-500 text-xs">
                        {items.filter((i) => i.category_id === cat.id).length} items
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => openEditCat(cat)}
                    className="text-gray-400 hover:text-white"
                  >
                    <Edit2 size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showItemModal && (
        <div className="fixed inset-0 bg-black/80 z-50 p-4 overflow-y-auto">
          <div className="min-h-full flex items-start justify-center py-6">
            <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-800 flex flex-col max-h-[calc(100vh-4rem)]">
              <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
                <h3 className="text-white font-bold">
                  {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
                </h3>
                <button
                  onClick={() => setShowItemModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 space-y-4 overflow-y-auto min-h-0">
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                    Item Name *
                  </label>
                  <input
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                    placeholder="e.g. Jollof Rice & Chicken"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                    Category *
                  </label>
                  <select
                    value={itemForm.category_id}
                    onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Select category --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                    Price (SSP)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={itemForm.price}
                    onChange={(e) => {
                      setItemForm({ ...itemForm, price: e.target.value })
                    }}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                    <span className="flex items-center gap-1"><ScanBarcode size={12} /> Barcode</span>
                  </label>
                  <input
                    value={itemForm.barcode}
                    onChange={(e) => setItemForm({ ...itemForm, barcode: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                    placeholder="Scan or enter barcode..."
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                    Description
                  </label>
                  <textarea
                    value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 resize-none text-sm"
                    placeholder="Optional description..."
                  />
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-white text-sm font-semibold">Item photo</p>
                      <p className="text-gray-500 text-xs">Shows on the public menu QR page</p>
                    </div>
                    <div className="w-14 h-14 rounded-xl bg-gray-900 border border-gray-700 overflow-hidden flex items-center justify-center shrink-0">
                      {itemForm.image_url ? (
                        <img
                          src={itemForm.image_url}
                          alt="Item"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-gray-600 text-xs">No image</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      disabled={!editingItem || saving}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void uploadMenuImage(f)
                        e.currentTarget.value = ''
                      }}
                      className="block w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-700 file:text-white hover:file:bg-gray-600"
                    />
                  </div>
                  {!editingItem ? (
                    <p className="text-gray-500 text-[11px] mt-2">
                      Save the item first, then upload a photo.
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                  <span className="text-white text-sm">Available on menu</span>
                  <button
                    onClick={() =>
                      setItemForm({ ...itemForm, is_available: !itemForm.is_available })
                    }
                  >
                    {itemForm.is_available ? (
                      <ToggleRight size={24} className="text-green-400" />
                    ) : (
                      <ToggleLeft size={24} className="text-gray-500" />
                    )}
                  </button>
                </div>
                <button
                  onClick={saveItem}
                  disabled={saving}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2"
                >
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCatModal && (
        <div className="fixed inset-0 bg-black/80 z-50 p-4 overflow-y-auto">
          <div className="min-h-full flex items-start justify-center py-6">
            <div className="bg-gray-900 rounded-2xl w-full max-w-sm border border-gray-800 flex flex-col max-h-[calc(100vh-4rem)]">
              <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
                <h3 className="text-white font-bold">
                  {editingCat ? 'Edit Category' : 'Add Category'}
                </h3>
                <button
                  onClick={() => setShowCatModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 space-y-4 overflow-y-auto min-h-0">
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide block mb-1">
                    Category Name *
                  </label>
                  <input
                    value={catForm.name}
                    onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                    placeholder="e.g. Grills"
                  />
                </div>
                <button
                  onClick={saveCat}
                  disabled={saving}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2"
                >
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
