import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { audit } from '../../lib/audit'
import {
  ArrowLeft, Plus, X, Building2, Search, DollarSign,
  CalendarDays, Users, Trash2, Edit3, Grid3X3,
  Move, Maximize
} from 'lucide-react'
import type { MallFloor, MallShop, MallRentPayment, Profile } from '../../types'

interface Props {
  onBack?: () => void
}

const GRID_COLS = 12
const GRID_ROWS = 8
const CELL_SIZE = 72
const MIN_SHOP_SIZE = 1

function calcRentStatus(shop: MallShop, payments: MallRentPayment[]): {
  label: string; color: string; remainingMonths: number; daysUntilDue: number
} {
  if (!shop.is_occupied) return { label: 'Vacant', color: 'bg-gray-600', remainingMonths: 0, daysUntilDue: 0 }
  if (payments.length === 0) return { label: 'No payment', color: 'bg-red-600', remainingMonths: 0, daysUntilDue: 0 }

  const totalMonthsPaid = payments.reduce((sum, p) => sum + p.months_paid, 0)
  if (totalMonthsPaid <= 0) return { label: 'No payment', color: 'bg-red-600', remainingMonths: 0, daysUntilDue: 0 }

  const now = new Date()
  const lastPayment = payments.reduce((latest, p) =>
    new Date(p.paid_at) > new Date(latest.paid_at) ? p : latest
  , payments[0])
  const lastPaidDate = new Date(lastPayment.paid_at)
  const monthsPassed = (now.getFullYear() - lastPaidDate.getFullYear()) * 12 +
    (now.getMonth() - lastPaidDate.getMonth())
  const daysIntoCurrentMonth = now.getDate() - lastPaidDate.getDate()
  const remainingMonths = totalMonthsPaid - monthsPassed - 1
  const daysUntilDue = remainingMonths * 30 + (30 - daysIntoCurrentMonth)

  if (remainingMonths >= 1) return { label: `${remainingMonths}mo left`, color: 'bg-green-600', remainingMonths, daysUntilDue }
  if (daysUntilDue >= 14) return { label: `${daysUntilDue}d left`, color: 'bg-yellow-500', remainingMonths, daysUntilDue }
  if (daysUntilDue >= 7) return { label: `${daysUntilDue}d left`, color: 'bg-red-600', remainingMonths, daysUntilDue }
  if (daysUntilDue >= 0) return { label: `${daysUntilDue}d left`, color: 'bg-red-700', remainingMonths, daysUntilDue }
  return { label: 'Overdue', color: 'bg-red-800', remainingMonths, daysUntilDue }
}

export default function MallManagement({ onBack }: Props) {
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const handleBack = onBack || (() => navigate('/backoffice'))
  const planRef = useRef<HTMLDivElement>(null)

  const [floors, setFloors] = useState<MallFloor[]>([])
  const [activeFloor, setActiveFloor] = useState<string | null>(null)
  const [shops, setShops] = useState<MallShop[]>([])
  const [rentPayments, setRentPayments] = useState<Record<string, MallRentPayment[]>>({})
  const [loading, setLoading] = useState(true)

  const [showShopForm, setShowShopForm] = useState(false)
  const [editingShop, setEditingShop] = useState<MallShop | null>(null)
  const [shopForm, setShopForm] = useState({
    shop_number: '', shop_name: '', pos_x: 0, pos_y: 0, width: 2, height: 2,
    tenant_name: '', tenant_phone: '', monthly_rent: '', is_occupied: false
  })
  const [savingShop, setSavingShop] = useState(false)

  const [showFloorForm, setShowFloorForm] = useState(false)
  const [floorForm, setFloorForm] = useState({ name: '', floor_number: '' })
  const [savingFloor, setSavingFloor] = useState(false)

  const [showRentForm, setShowRentForm] = useState(false)
  const [rentShop, setRentShop] = useState<MallShop | null>(null)
  const [rentForm, setRentForm] = useState({ months_paid: '1', amount_paid: '', notes: '' })
  const [savingRent, setSavingRent] = useState(false)

  const [selectedShop, setSelectedShop] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'plan' | 'list'>('plan')

  const [resizing, setResizing] = useState<string | null>(null)
  const [resizeDir, setResizeDir] = useState<'se' | 'e' | 's' | null>(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 })

  const fetchData = async () => {
    const { data: floorsData } = await supabase
      .from('mall_floors')
      .select('*')
      .order('floor_number')
    if (floorsData) {
      setFloors(floorsData as MallFloor[])
      if (!activeFloor && floorsData.length > 0) setActiveFloor(floorsData[0].id)
    }

    const { data: shopsData } = await supabase
      .from('mall_shops')
      .select('*')
      .order('shop_number')
    if (shopsData) {
      setShops(shopsData as MallShop[])
      const shopIds = shopsData.map((s: MallShop) => s.id)
      if (shopIds.length > 0) {
        const { data: rentData } = await supabase
          .from('mall_rent_payments')
          .select('*')
          .in('shop_id', shopIds)
          .order('paid_at')
        if (rentData) {
          const grouped: Record<string, MallRentPayment[]> = {}
          for (const r of rentData as MallRentPayment[]) {
            if (!grouped[r.shop_id]) grouped[r.shop_id] = []
            grouped[r.shop_id].push(r)
          }
          setRentPayments(grouped)
        }
      }
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const currentFloorsShops = shops.filter(s =>
    s.floor_id === activeFloor &&
    (s.shop_number.toLowerCase().includes(search.toLowerCase()) ||
     s.shop_name.toLowerCase().includes(search.toLowerCase()) ||
     (s.tenant_name || '').toLowerCase().includes(search.toLowerCase()))
  )

  // ── Drag & Resize handlers ──
  const handleMouseDown = useCallback((e: React.MouseEvent, shopId: string, dir: 'se' | 'e' | 's') => {
    e.preventDefault()
    e.stopPropagation()
    const shop = shops.find(s => s.id === shopId)
    if (!shop) return
    setResizing(shopId)
    setResizeDir(dir)
    setResizeStart({ x: e.clientX, y: e.clientY, w: shop.width, h: shop.height, px: shop.pos_x, py: shop.pos_y })
  }, [shops])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing || !resizeDir || !planRef.current) return
    const rect = planRef.current.getBoundingClientRect()
    const dx = Math.round((e.clientX - resizeStart.x) / CELL_SIZE)
    const dy = Math.round((e.clientY - resizeStart.y) / CELL_SIZE)

    setShops(prev => prev.map(s => {
      if (s.id !== resizing) return s
      let newW = s.width, newH = s.height
      if (resizeDir === 'se' || resizeDir === 'e') newW = Math.max(MIN_SHOP_SIZE, resizeStart.w + dx)
      if (resizeDir === 'se' || resizeDir === 's') newH = Math.max(MIN_SHOP_SIZE, resizeStart.h + dy)
      if (resizeDir === 'e') newH = s.height
      if (resizeDir === 's') newW = s.width
      const maxW = GRID_COLS - s.pos_x
      const maxH = GRID_ROWS - s.pos_y
      return { ...s, width: Math.min(newW, maxW), height: Math.min(newH, maxH) }
    }))
  }, [resizing, resizeDir, resizeStart])

  const handleMouseUp = useCallback(async () => {
    if (!resizing) return
    const shop = shops.find(s => s.id === resizing)
    if (shop) {
      const { error } = await supabase
        .from('mall_shops')
        .update({ width: shop.width, height: shop.height, updated_at: new Date().toISOString() })
        .eq('id', shop.id)
      if (error) toast.error('Error', error.message)
    }
    setResizing(null)
    setResizeDir(null)
  }, [resizing, shops, toast])

  useEffect(() => {
    if (!resizing) return
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing, handleMouseMove, handleMouseUp])

  const handleDragStart = useCallback((e: React.MouseEvent, shopId: string) => {
    if ((e.target as HTMLElement).closest('.resize-handle')) return
    e.preventDefault()
    const shop = shops.find(s => s.id === shopId)
    if (!shop) return
    const startX = e.clientX
    const startY = e.clientY
    const origPosX = shop.pos_x
    const origPosY = shop.pos_y

    const onMove = (ev: MouseEvent) => {
      const rect = planRef.current!.getBoundingClientRect()
      const dx = Math.round((ev.clientX - startX) / CELL_SIZE)
      const dy = Math.round((ev.clientY - startY) / CELL_SIZE)
      setShops(prev => prev.map(s => {
        if (s.id !== shopId) return s
        return {
          ...s,
          pos_x: Math.max(0, Math.min(GRID_COLS - s.width, origPosX + dx)),
          pos_y: Math.max(0, Math.min(GRID_ROWS - s.height, origPosY + dy))
        }
      }))
    }

    const onUp = async () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const updated = shops.find(s => s.id === shopId)
      if (updated) {
        const { error } = await supabase
          .from('mall_shops')
          .update({ pos_x: updated.pos_x, pos_y: updated.pos_y, updated_at: new Date().toISOString() })
          .eq('id', shopId)
        if (error) toast.error('Error', error.message)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [shops, toast])

  // ── CRUD handlers ──
  const openNewShop = () => {
    setEditingShop(null)
    setShopForm({ shop_number: '', shop_name: '', pos_x: 0, pos_y: 0, width: 2, height: 2, tenant_name: '', tenant_phone: '', monthly_rent: '', is_occupied: false })
    setShowShopForm(true)
  }

  const openEditShop = (shop: MallShop) => {
    setEditingShop(shop)
    setShopForm({
      shop_number: shop.shop_number, shop_name: shop.shop_name,
      pos_x: shop.pos_x, pos_y: shop.pos_y, width: shop.width, height: shop.height,
      tenant_name: shop.tenant_name || '', tenant_phone: shop.tenant_phone || '',
      monthly_rent: String(shop.monthly_rent), is_occupied: shop.is_occupied
    })
    setShowShopForm(true)
  }

  const saveShop = async () => {
    if (!shopForm.shop_number.trim()) return toast.warning('Required', 'Shop number is required')
    if (!shopForm.shop_name.trim()) return toast.warning('Required', 'Shop name is required')
    setSavingShop(true)
    try {
      const payload = {
        shop_number: shopForm.shop_number.trim(),
        shop_name: shopForm.shop_name.trim(),
        floor_id: activeFloor,
        pos_x: shopForm.pos_x, pos_y: shopForm.pos_y,
        width: Math.max(1, shopForm.width), height: Math.max(1, shopForm.height),
        tenant_name: shopForm.tenant_name.trim() || null,
        tenant_phone: shopForm.tenant_phone.trim() || null,
        monthly_rent: parseFloat(shopForm.monthly_rent) || 0,
        is_occupied: shopForm.is_occupied,
        updated_at: new Date().toISOString()
      }
      if (editingShop) {
        const { error } = await supabase.from('mall_shops').update(payload).eq('id', editingShop.id)
        if (error) throw error
        await audit({ action: 'MALL_SHOP_UPDATED', entity: 'mall_shop', entityId: editingShop.id, entityName: shopForm.shop_name.trim(), oldValue: { name: editingShop.shop_name }, newValue: { name: shopForm.shop_name.trim() }, performer: profile as Profile })
        toast.success('Updated', 'Shop updated')
      } else {
        const { error } = await supabase.from('mall_shops').insert(payload)
        if (error) throw error
        await audit({ action: 'MALL_SHOP_CREATED', entity: 'mall_shop', entityName: shopForm.shop_name.trim(), newValue: { name: shopForm.shop_name.trim() }, performer: profile as Profile })
        toast.success('Created', 'Shop added')
      }
      setShowShopForm(false)
      setEditingShop(null)
      await fetchData()
    } catch (err) {
      toast.error('Error', (err as Error).message)
    } finally {
      setSavingShop(false)
    }
  }

  const toggleOccupied = async (shop: MallShop) => {
    const next = !shop.is_occupied
    const { error } = await supabase
      .from('mall_shops')
      .update({ is_occupied: next, updated_at: new Date().toISOString() })
      .eq('id', shop.id)
    if (error) return toast.error('Error', error.message)
    await audit({ action: next ? 'MALL_SHOP_OCCUPIED' : 'MALL_SHOP_VACATED', entity: 'mall_shop', entityId: shop.id, entityName: shop.shop_name, performer: profile as Profile })
    setShops(prev => prev.map(s => s.id === shop.id ? { ...s, is_occupied: next } : s))
  }

  const deleteShop = async (shop: MallShop) => {
    if (!confirm(`Delete shop ${shop.shop_name}?`)) return
    const { error } = await supabase.from('mall_shops').delete().eq('id', shop.id)
    if (error) return toast.error('Error', error.message)
    await audit({ action: 'MALL_SHOP_DELETED', entity: 'mall_shop', entityId: shop.id, entityName: shop.shop_name, performer: profile as Profile })
    toast.success('Deleted', 'Shop removed')
    await fetchData()
  }

  const openNewFloor = () => {
    setFloorForm({ name: '', floor_number: String(floors.length + 1) })
    setShowFloorForm(true)
  }

  const saveFloor = async () => {
    if (!floorForm.name.trim()) return toast.warning('Required', 'Floor name is required')
    setSavingFloor(true)
    try {
      const { error } = await supabase.from('mall_floors').insert({
        name: floorForm.name.trim(),
        floor_number: parseInt(floorForm.floor_number) || floors.length + 1
      })
      if (error) throw error
      toast.success('Created', 'Floor added')
      setShowFloorForm(false)
      await fetchData()
    } catch (err) {
      toast.error('Error', (err as Error).message)
    } finally {
      setSavingFloor(false)
    }
  }

  const openAddRent = (shop: MallShop) => {
    setRentShop(shop)
    setRentForm({ months_paid: '1', amount_paid: String(shop.monthly_rent), notes: '' })
    setShowRentForm(true)
  }

  const saveRent = async () => {
    if (!rentShop) return
    const months = parseInt(rentForm.months_paid) || 1
    const amount = parseFloat(rentForm.amount_paid) || 0
    if (amount <= 0) return toast.warning('Required', 'Amount is required')
    setSavingRent(true)
    try {
      const { error } = await supabase.from('mall_rent_payments').insert({
        shop_id: rentShop.id, months_paid: months, amount_paid: amount,
        notes: rentForm.notes.trim() || null
      })
      if (error) throw error
      await audit({ action: 'MALL_RENT_PAID', entity: 'mall_rent_payment', entityName: rentShop.shop_name, newValue: { months, amount, shop: rentShop.shop_name }, performer: profile as Profile })
      toast.success('Recorded', `Rent recorded for ${rentShop.shop_name}`)
      setShowRentForm(false)
      setRentShop(null)
      await fetchData()
    } catch (err) {
      toast.error('Error', (err as Error).message)
    } finally {
      setSavingRent(false)
    }
  }

  if (loading) return (
    <div className="min-h-full bg-gray-950 flex items-center justify-center">
      <div className="text-amber-500">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-full bg-gray-950">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="text-gray-400 hover:text-white p-1">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-white text-2xl font-bold">Mall Management</h2>
              <p className="text-gray-500 text-sm mt-0.5">Manage shops, floor plan & rent tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'plan' ? 'list' : 'plan')}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-xl text-sm transition-colors"
            >
              <Grid3X3 size={14} />
              {viewMode === 'plan' ? 'List' : 'Plan'}
            </button>
            <button
              onClick={openNewFloor}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-xl text-sm transition-colors"
            >
              <Building2 size={14} /> Add Floor
            </button>
            <button
              onClick={openNewShop}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              <Plus size={15} /> Add Shop
            </button>
          </div>
        </div>

        {/* Floor tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto">
          {floors.map((floor) => (
            <button
              key={floor.id}
              onClick={() => setActiveFloor(floor.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                activeFloor === floor.id
                  ? 'bg-amber-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {floor.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shops by number, name or tenant..."
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        {viewMode === 'plan' ? (
          /* ─── FLOOR PLAN VIEW ─── */
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 overflow-auto">
            <div className="flex items-center gap-3 mb-3 text-[10px] text-gray-500">
              <Move size={12} /> Drag shops to move them
              <Maximize size={12} /> Drag corners to resize
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-600 inline-block" /> Paid</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500 inline-block" /> Due soon</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-600 inline-block" /> Overdue</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-600 inline-block" /> Vacant</span>
            </div>
            <div
              ref={planRef}
              className="relative select-none"
              style={{
                width: GRID_COLS * CELL_SIZE,
                height: GRID_ROWS * CELL_SIZE,
                minWidth: GRID_COLS * CELL_SIZE,
              }}
            >
              {Array.from({ length: GRID_COLS }).map((_, x) => (
                <div
                  key={`gx-${x}`}
                  className="absolute top-0 bottom-0 border-l border-gray-800/50"
                  style={{ left: x * CELL_SIZE }}
                />
              ))}
              {Array.from({ length: GRID_ROWS }).map((_, y) => (
                <div
                  key={`gy-${y}`}
                  className="absolute left-0 right-0 border-t border-gray-800/50"
                  style={{ top: y * CELL_SIZE }}
                />
              ))}

              {currentFloorsShops.map((shop) => {
                const payments = rentPayments[shop.id] || []
                const status = calcRentStatus(shop, payments)
                const isSelected = selectedShop === shop.id
                return (
                  <div
                    key={shop.id}
                    onMouseDown={(e) => handleDragStart(e, shop.id)}
                    onClick={() => setSelectedShop(isSelected ? null : shop.id)}
                    className={`absolute border-2 rounded-lg flex flex-col items-center justify-center text-xs font-medium cursor-grab active:cursor-grabbing transition-colors ${
                      isSelected ? 'border-amber-400 z-10' : 'border-gray-700'
                    } ${status.color} bg-opacity-90`}
                    style={{
                      left: shop.pos_x * CELL_SIZE + 2,
                      top: shop.pos_y * CELL_SIZE + 2,
                      width: shop.width * CELL_SIZE - 4,
                      height: shop.height * CELL_SIZE - 4,
                    }}
                  >
                    <span className="text-white font-bold text-xs leading-tight text-center px-1">
                      {shop.shop_number}
                    </span>
                    <span className="text-white/80 text-[10px] leading-tight text-center px-1 truncate max-w-full">
                      {shop.shop_name}
                    </span>
                    {shop.is_occupied && shop.tenant_name && (
                      <span className="text-white/60 text-[9px] leading-tight truncate max-w-full px-1">
                        {shop.tenant_name}
                      </span>
                    )}
                    {!shop.is_occupied && (
                      <span className="text-white/40 text-[9px] leading-tight">Vacant</span>
                    )}

                    {/* Resize handles */}
                    <div
                      className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-white/20 hover:bg-white/40 rounded-bl-lg rounded-tr-lg"
                      onMouseDown={(e) => handleMouseDown(e, shop.id, 'se')}
                    />
                    <div
                      className="resize-handle absolute top-0 right-0 w-2 h-full cursor-e-resize bg-white/10 hover:bg-white/30 rounded-r"
                      style={{ right: -1 }}
                      onMouseDown={(e) => handleMouseDown(e, shop.id, 'e')}
                    />
                    <div
                      className="resize-handle absolute bottom-0 left-0 w-full h-2 cursor-s-resize bg-white/10 hover:bg-white/30 rounded-b"
                      style={{ bottom: -1 }}
                      onMouseDown={(e) => handleMouseDown(e, shop.id, 's')}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* ─── LIST VIEW ─── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {currentFloorsShops.map((shop) => {
              const payments = rentPayments[shop.id] || []
              const status = calcRentStatus(shop, payments)
              const isSelected = selectedShop === shop.id
              return (
                <div
                  key={shop.id}
                  className={`bg-gray-900 border rounded-2xl p-4 ${isSelected ? 'border-amber-500' : 'border-gray-800'}`}
                  onClick={() => setSelectedShop(isSelected ? null : shop.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${status.color}`} />
                      <h3 className="text-white font-semibold text-sm">{shop.shop_number}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      {shop.is_occupied && (
                        <span className="text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">Occupied</span>
                      )}
                      {!shop.is_occupied && (
                        <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-full">Vacant</span>
                      )}
                      <span className="text-[10px] text-gray-500">{status.label}</span>
                    </div>
                  </div>
                  <p className="text-gray-300 text-xs font-medium">{shop.shop_name}</p>
                  {shop.is_occupied && shop.tenant_name && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Users size={11} className="text-gray-500" />
                      <span className="text-gray-400 text-xs">{shop.tenant_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    <DollarSign size={11} className="text-gray-500" />
                    <span className="text-gray-400 text-xs">₦{shop.monthly_rent.toLocaleString()}/mo</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleOccupied(shop) }}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors ${
                        shop.is_occupied
                          ? 'bg-gray-800 text-gray-400 hover:text-white'
                          : 'bg-green-600 hover:bg-green-500 text-white'
                      }`}
                    >
                      {shop.is_occupied ? 'Vacate' : 'Occupy'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openAddRent(shop) }}
                      className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-500 text-white px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <CalendarDays size={11} /> Pay Rent
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditShop(shop) }}
                      className="text-xs text-amber-400 hover:text-amber-300 p-1"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteShop(shop) }}
                      className="text-xs text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
            {currentFloorsShops.length === 0 && (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500 text-sm">No shops on this floor. Add your first shop.</p>
              </div>
            )}
          </div>
        )}

        {/* Selected shop detail */}
        {(() => {
          const shop = shops.find(s => s.id === selectedShop)
          if (!shop) return null
          const payments = rentPayments[shop.id] || []
          const status = calcRentStatus(shop, payments)
          return (
            <div className="mt-4 bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-bold text-lg">{shop.shop_name}</h3>
                  <p className="text-gray-400 text-sm">Shop {shop.shop_number}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleOccupied(shop)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                      shop.is_occupied
                        ? 'bg-gray-800 text-gray-400 hover:text-white'
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    {shop.is_occupied ? 'Vacate' : 'Occupy'}
                  </button>
                  <button
                    onClick={() => openAddRent(shop)}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    <CalendarDays size={14} /> Record Payment
                  </button>
                  <button
                    onClick={() => openEditShop(shop)}
                    className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-xl text-sm transition-colors"
                  >
                    <Edit3 size={14} /> Edit
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-800 rounded-xl p-3">
                  <p className="text-gray-500 text-xs">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-3 h-3 rounded-full ${status.color}`} />
                    <span className="text-white font-medium text-sm">{shop.is_occupied ? 'Occupied' : 'Vacant'} — {status.label}</span>
                  </div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <p className="text-gray-500 text-xs">Tenant</p>
                  <p className="text-white font-medium text-sm">{shop.tenant_name || 'N/A'}</p>
                  {shop.tenant_phone && <p className="text-gray-400 text-xs mt-0.5">{shop.tenant_phone}</p>}
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <p className="text-gray-500 text-xs">Monthly Rent</p>
                  <p className="text-white font-medium text-sm">₦{shop.monthly_rent.toLocaleString()}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <p className="text-gray-500 text-xs">Position</p>
                  <p className="text-white font-medium text-sm">X:{shop.pos_x} Y:{shop.pos_y}</p>
                  <p className="text-gray-400 text-xs">{shop.width}x{shop.height} cells</p>
                </div>
              </div>

              <div>
                <h4 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">Payment History</h4>
                {payments.length === 0 ? (
                  <p className="text-gray-600 text-sm">No payments recorded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {[...payments].reverse().map((payment) => (
                      <div key={payment.id} className="bg-gray-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-medium">
                            {payment.months_paid} month{payment.months_paid > 1 ? 's' : ''}
                          </p>
                          {payment.notes && <p className="text-gray-500 text-xs mt-0.5">{payment.notes}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-amber-400 font-medium text-sm">₦{payment.amount_paid.toLocaleString()}</p>
                          <p className="text-gray-500 text-xs">{new Date(payment.paid_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* ─── SHOP FORM MODAL ─── */}
      {showShopForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">{editingShop ? 'Edit Shop' : 'Add Shop'}</h3>
              <button onClick={() => { setShowShopForm(false); setEditingShop(null) }} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Shop Number *</label>
                  <input value={shopForm.shop_number} onChange={(e) => setShopForm({ ...shopForm, shop_number: e.target.value })} placeholder="e.g. A1" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Shop Name *</label>
                  <input value={shopForm.shop_name} onChange={(e) => setShopForm({ ...shopForm, shop_name: e.target.value })} placeholder="e.g. Fashion Hub" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shopForm.is_occupied}
                    onChange={(e) => setShopForm({ ...shopForm, is_occupied: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-white text-sm font-medium">Occupied</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Position X (col)</label>
                  <input type="number" min={0} max={GRID_COLS - 1} value={shopForm.pos_x} onChange={(e) => setShopForm({ ...shopForm, pos_x: parseInt(e.target.value) || 0 })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Position Y (row)</label>
                  <input type="number" min={0} max={GRID_ROWS - 1} value={shopForm.pos_y} onChange={(e) => setShopForm({ ...shopForm, pos_y: parseInt(e.target.value) || 0 })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Width (cells)</label>
                  <input type="number" min={1} max={GRID_COLS} value={shopForm.width} onChange={(e) => setShopForm({ ...shopForm, width: parseInt(e.target.value) || 1 })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Height (cells)</label>
                  <input type="number" min={1} max={GRID_ROWS} value={shopForm.height} onChange={(e) => setShopForm({ ...shopForm, height: parseInt(e.target.value) || 1 })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Tenant Name</label>
                  <input value={shopForm.tenant_name} onChange={(e) => setShopForm({ ...shopForm, tenant_name: e.target.value })} placeholder="Tenant name" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Tenant Phone</label>
                  <input value={shopForm.tenant_phone} onChange={(e) => setShopForm({ ...shopForm, tenant_phone: e.target.value })} placeholder="Phone number" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1">Monthly Rent (₦)</label>
                <input value={shopForm.monthly_rent} onChange={(e) => setShopForm({ ...shopForm, monthly_rent: e.target.value })} placeholder="e.g. 50000" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-800 flex gap-2 justify-end">
              <button onClick={() => { setShowShopForm(false); setEditingShop(null) }} className="px-4 py-2 text-sm text-gray-400 hover:text-white font-medium">Cancel</button>
              <button onClick={saveShop} disabled={savingShop} className="bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors">
                {savingShop ? 'Saving...' : editingShop ? 'Update' : 'Add Shop'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── FLOOR FORM MODAL ─── */}
      {showFloorForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-sm border border-gray-800">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Add Floor</h3>
              <button onClick={() => setShowFloorForm(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="text-gray-400 text-xs font-medium block mb-1">Floor Name *</label><input value={floorForm.name} onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })} placeholder="e.g. Ground Floor" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" /></div>
              <div><label className="text-gray-400 text-xs font-medium block mb-1">Floor Number</label><input type="number" min={1} value={floorForm.floor_number} onChange={(e) => setFloorForm({ ...floorForm, floor_number: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" /></div>
            </div>
            <div className="p-5 border-t border-gray-800 flex gap-2 justify-end">
              <button onClick={() => setShowFloorForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white font-medium">Cancel</button>
              <button onClick={saveFloor} disabled={savingFloor} className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors">{savingFloor ? 'Saving...' : 'Add Floor'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── RENT PAYMENT MODAL ─── */}
      {showRentForm && rentShop && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-sm border border-gray-800">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Rent Payment — {rentShop.shop_name}</h3>
              <button onClick={() => { setShowRentForm(false); setRentShop(null) }} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="text-gray-400 text-xs font-medium block mb-1">Months Paid *</label><input type="number" min={1} value={rentForm.months_paid} onChange={(e) => setRentForm({ ...rentForm, months_paid: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" /></div>
              <div><label className="text-gray-400 text-xs font-medium block mb-1">Amount Paid (₦) *</label><input value={rentForm.amount_paid} onChange={(e) => setRentForm({ ...rentForm, amount_paid: e.target.value })} placeholder="e.g. 50000" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" /></div>
              <div><label className="text-gray-400 text-xs font-medium block mb-1">Notes</label><textarea value={rentForm.notes} onChange={(e) => setRentForm({ ...rentForm, notes: e.target.value })} placeholder="Optional notes" rows={2} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" /></div>
            </div>
            <div className="p-5 border-t border-gray-800 flex gap-2 justify-end">
              <button onClick={() => { setShowRentForm(false); setRentShop(null) }} className="px-4 py-2 text-sm text-gray-400 hover:text-white font-medium">Cancel</button>
              <button onClick={saveRent} disabled={savingRent} className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors">{savingRent ? 'Saving...' : 'Record Payment'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
