import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { audit } from '../../lib/audit'
import {
  ArrowLeft, Plus, X, Building2, Search, DollarSign,
  CalendarDays, Users, Trash2, Edit3, Grid3X3,
  Move, Maximize, LayoutDashboard, Map, FileText,
  Download, Info, Phone, Mail, Tag, CreditCard,
  Clock, AlertTriangle, ChevronRight, Store,
  BarChart3, Percent, Home, KeyRound, Wrench, Receipt, Box
} from 'lucide-react'
import Mall3DView from '../mall/Mall3DView'
import ErrorBoundary from '../../components/ErrorBoundary'
import type { MallFloor, MallShop, MallRentPayment, MallMaintenanceRequest, MallRentInvoice, Profile } from '../../types'

interface Props {
  onBack?: () => void
}

const SHOP_CATEGORIES = [
  'Retail', 'Food & Beverage', 'Services', 'Entertainment',
  'Fashion', 'Electronics', 'Other'
] as const

function fmtUSD(amount: number): string {
  return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtUSDshort(amount: number): string {
  return `$${Number(amount || 0).toLocaleString('en-US')}`
}

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

  const [activeTab, setActiveTab] = useState<'overview' | 'floor-plan' | 'tenants' | 'reports' | 'maintenance' | '3d-view'>('overview')

  const [showShopForm, setShowShopForm] = useState(false)
  const [editingShop, setEditingShop] = useState<MallShop | null>(null)
  const [shopForm, setShopForm] = useState({
    shop_number: '', shop_name: '', pos_x: 0, pos_y: 0, width: 2, height: 2,
    tenant_name: '', tenant_phone: '', monthly_rent: '', is_occupied: false,
    lease_start_date: '', lease_end_date: '', deposit_amount: '',
    shop_category: '', email: '', notes: ''
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
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'plan' | 'list'>('plan')

  const shopsRef = useRef(shops)
  shopsRef.current = shops

  const [resizing, setResizing] = useState<string | null>(null)
  const [resizeDir, setResizeDir] = useState<string | null>(null)
  const [resizeStart, setResizeStart] = useState({ mx: 0, my: 0, px: 0, py: 0, w: 0, h: 0 })
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, px: 0, py: 0 })

  const [tenantSearch, setTenantSearch] = useState('')
  const [tenantFilterFloor, setTenantFilterFloor] = useState('')
  const [showTenantDetail, setShowTenantDetail] = useState(false)
  const [tenantDetailShop, setTenantDetailShop] = useState<MallShop | null>(null)

  const [maintenanceRequests, setMaintenanceRequests] = useState<MallMaintenanceRequest[]>([])
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false)
  const [maintenanceForm, setMaintenanceForm] = useState({
    shop_id: '', title: '', description: '', priority: 'medium'
  })
  const [savingMaintenance, setSavingMaintenance] = useState(false)

  const [rentInvoices, setRentInvoices] = useState<MallRentInvoice[]>([])
  const [generatingInvoices, setGeneratingInvoices] = useState(false)

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

  useEffect(() => { fetchMaintenanceRequests(); fetchRentInvoices() }, [shops.length])

  const currentFloorsShops = shops.filter(s =>
    s.floor_id === activeFloor &&
    (s.shop_number.toLowerCase().includes(search.toLowerCase()) ||
     s.shop_name.toLowerCase().includes(search.toLowerCase()) ||
     (s.tenant_name || '').toLowerCase().includes(search.toLowerCase()))
  )

  const activeFloorObj = floors.find(f => f.id === activeFloor)

  // ── Resize handlers (free-form, 8 directions) ──
  const handleResizeStart = useCallback((e: React.MouseEvent, shopId: string, dir: string) => {
    e.preventDefault()
    e.stopPropagation()
    const shop = shops.find(s => s.id === shopId)
    if (!shop) return
    setResizing(shopId)
    setResizeDir(dir)
    setResizeStart({ mx: e.clientX, my: e.clientY, px: shop.pos_x, py: shop.pos_y, w: shop.width, h: shop.height })
  }, [shops])

  useEffect(() => {
    if (!resizing || !resizeDir) return
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - resizeStart.mx
      const dy = ev.clientY - resizeStart.my
      setShops(prev => prev.map(s => {
        if (s.id !== resizing) return s
        let pos_x = resizeStart.px
        let pos_y = resizeStart.py
        let width = resizeStart.w
        let height = resizeStart.h
        const dir = resizeDir
        if (dir.includes('e')) width = Math.max(20, resizeStart.w + dx)
        if (dir.includes('w')) {
          const newW = Math.max(20, resizeStart.w - dx)
          pos_x = resizeStart.px + (resizeStart.w - newW)
          width = newW
        }
        if (dir.includes('s')) height = Math.max(20, resizeStart.h + dy)
        if (dir.includes('n')) {
          const newH = Math.max(20, resizeStart.h - dy)
          pos_y = resizeStart.py + (resizeStart.h - newH)
          height = newH
        }
        return { ...s, pos_x, pos_y, width, height }
      }))
    }
    const onUp = async () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const updated = shopsRef.current.find(s => s.id === resizing)
      if (updated) {
        const { error } = await supabase
          .from('mall_shops')
          .update({ pos_x: updated.pos_x, pos_y: updated.pos_y, width: updated.width, height: updated.height, updated_at: new Date().toISOString() })
          .eq('id', updated.id)
        if (error) toast.error('Error', error.message)
      }
      setResizing(null)
      setResizeDir(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizing, resizeDir, resizeStart, toast])

  // ── Drag handlers (free-form, no grid) ──
  const handleDragStart = useCallback((e: React.MouseEvent, shopId: string) => {
    if ((e.target as HTMLElement).closest('.resize-handle') || (e.target as HTMLElement).closest('.info-btn')) return
    e.preventDefault()
    const shop = shops.find(s => s.id === shopId)
    if (!shop) return
    setDragging(shopId)
    setDragStart({ mx: e.clientX, my: e.clientY, px: shop.pos_x, py: shop.pos_y })
  }, [shops])

  useEffect(() => {
    if (!dragging) return
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStart.mx
      const dy = ev.clientY - dragStart.my
      setShops(prev => prev.map(s => {
        if (s.id !== dragging) return s
        return {
          ...s,
          pos_x: Math.max(0, dragStart.px + dx),
          pos_y: Math.max(0, dragStart.py + dy)
        }
      }))
    }
    const onUp = async () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setDragging(null)
      const updated = shopsRef.current.find(s => s.id === dragging)
      if (updated) {
        const { error } = await supabase
          .from('mall_shops')
          .update({ pos_x: updated.pos_x, pos_y: updated.pos_y, updated_at: new Date().toISOString() })
          .eq('id', updated.id)
        if (error) toast.error('Error', error.message)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, dragStart, toast])

  // ── CRUD handlers ──
  const openNewShop = () => {
    setEditingShop(null)
    setShopForm({
    shop_number: '', shop_name: '', pos_x: 0, pos_y: 0, width: 50, height: 50,
      tenant_name: '', tenant_phone: '', monthly_rent: '', is_occupied: false,
      lease_start_date: '', lease_end_date: '', deposit_amount: '',
      shop_category: '', email: '', notes: ''
    })
    setShowShopForm(true)
  }

  const openEditShop = (shop: MallShop) => {
    setEditingShop(shop)
    setShopForm({
      shop_number: shop.shop_number, shop_name: shop.shop_name,
      pos_x: shop.pos_x, pos_y: shop.pos_y, width: shop.width, height: shop.height,
      tenant_name: shop.tenant_name || '', tenant_phone: shop.tenant_phone || '',
      monthly_rent: String(shop.monthly_rent), is_occupied: shop.is_occupied,
      lease_start_date: shop.lease_start_date || '',
      lease_end_date: shop.lease_end_date || '',
      deposit_amount: String(shop.deposit_amount || 0),
      shop_category: shop.shop_category || '',
      email: shop.email || '',
      notes: shop.notes || ''
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
        width: Math.max(20, shopForm.width), height: Math.max(20, shopForm.height),
        tenant_name: shopForm.tenant_name.trim() || null,
        tenant_phone: shopForm.tenant_phone.trim() || null,
        monthly_rent: parseFloat(shopForm.monthly_rent) || 0,
        is_occupied: shopForm.is_occupied,
        lease_start_date: shopForm.lease_start_date || null,
        lease_end_date: shopForm.lease_end_date || null,
        deposit_amount: parseFloat(shopForm.deposit_amount) || 0,
        shop_category: shopForm.shop_category || null,
        email: shopForm.email.trim() || null,
        notes: shopForm.notes.trim() || null,
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
        notes: rentForm.notes.trim() || null,
        recorded_by: profile?.id || null,
        recorded_by_name: profile?.full_name || null
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

  const showShopDetail = (shop: MallShop) => {
    setSelectedShop(shop.id)
    setShowDetailPanel(true)
  }

  const handleShopPlanClick = (shop: MallShop) => {
    if (selectedShop === shop.id) {
      setSelectedShop(null)
    } else {
      setSelectedShop(shop.id)
    }
  }

  const handleShopInfoClick = (e: React.MouseEvent, shop: MallShop) => {
    e.stopPropagation()
    if (selectedShop === shop.id && showDetailPanel) {
      setShowDetailPanel(false)
      setSelectedShop(null)
    } else {
      setSelectedShop(shop.id)
      setShowDetailPanel(true)
    }
  }

  // ── Overview data ──
  const overviewStats = (() => {
    const totalShops = shops.length
    const occupied = shops.filter(s => s.is_occupied).length
    const vacant = totalShops - occupied
    const occupancyRate = totalShops > 0 ? Math.round((occupied / totalShops) * 100) : 0
    const totalMonthlyRent = shops.filter(s => s.is_occupied).reduce((sum, s) => sum + s.monthly_rent, 0)
    const totalDeposits = shops.filter(s => s.is_occupied).reduce((sum, s) => sum + (s.deposit_amount || 0), 0)

    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()

    const rentCollectedThisMonth = Object.values(rentPayments).flat().filter(p => {
      const d = new Date(p.paid_at)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    }).reduce((sum, p) => sum + p.amount_paid, 0)

    const overdueCount = shops.filter(s => {
      if (!s.is_occupied) return false
      const status = calcRentStatus(s, rentPayments[s.id] || [])
      return status.label === 'Overdue'
    }).length

    return { totalShops, occupied, vacant, occupancyRate, totalMonthlyRent, totalDeposits, rentCollectedThisMonth, overdueCount }
  })()

  const recentPayments = Object.entries(rentPayments).flatMap(([shopId, payments]) =>
    payments.map(p => ({ ...p, shop: shops.find(s => s.id === shopId) }))
  ).sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()).slice(0, 5)

  // ── Tenants data ──
  const tenantList = shops.filter(s => s.is_occupied || s.tenant_name).map(s => ({
    ...s,
    floorName: floors.find(f => f.id === s.floor_id)?.name || 'Unknown'
  })).filter(s => {
    if (tenantSearch) {
      const q = tenantSearch.toLowerCase()
      if (!s.shop_number.toLowerCase().includes(q) &&
          !s.shop_name.toLowerCase().includes(q) &&
          !(s.tenant_name || '').toLowerCase().includes(q) &&
          !(s.email || '').toLowerCase().includes(q) &&
          !(s.tenant_phone || '').toLowerCase().includes(q)) return false
    }
    if (tenantFilterFloor && s.floor_id !== tenantFilterFloor) return false
    return true
  })

  // ── Reports data ──
  const occupancyReport = floors.map(floor => {
    const floorShops = shops.filter(s => s.floor_id === floor.id)
    const total = floorShops.length
    const occ = floorShops.filter(s => s.is_occupied).length
    return { floor: floor.name, total, occupied: occ, vacant: total - occ, rate: total > 0 ? Math.round((occ / total) * 100) : 0 }
  })

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()

  const rentCollectionReport = floors.map(floor => {
    const floorShops = shops.filter(s => s.floor_id === floor.id)
    const occupiedShops = floorShops.filter(s => s.is_occupied)
    const expected = occupiedShops.reduce((sum, s) => sum + s.monthly_rent, 0)
    const collected = occupiedShops.reduce((sum, s) => {
      const payments = rentPayments[s.id] || []
      return sum + payments.filter(p => {
        const d = new Date(p.paid_at)
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear
      }).reduce((ps, p) => ps + p.amount_paid, 0)
    }, 0)
    return { floor: floor.name, expected, collected, outstanding: expected - collected }
  })

  const sixtyDaysFromNow = new Date()
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60)

  const leasesExpiring = shops.filter(s => {
    if (!s.lease_end_date || !s.is_occupied) return false
    const end = new Date(s.lease_end_date)
    return end <= sixtyDaysFromNow && end >= now
  }).map(s => ({
    ...s,
    floorName: floors.find(f => f.id === s.floor_id)?.name || 'Unknown',
    daysLeft: Math.ceil((new Date(s.lease_end_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  })).sort((a, b) => new Date(a.lease_end_date!).getTime() - new Date(b.lease_end_date!).getTime())

  const fetchMaintenanceRequests = async () => {
    const { data } = await supabase
      .from('mall_maintenance_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setMaintenanceRequests(data as MallMaintenanceRequest[])
  }

  const fetchRentInvoices = async () => {
    const { data } = await supabase
      .from('mall_rent_invoices')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setRentInvoices(data as MallRentInvoice[])
  }

  const maintenanceStats = (() => {
    const open = maintenanceRequests.filter(r => r.status === 'open').length
    const urgent = maintenanceRequests.filter(r => r.priority === 'urgent' && r.status !== 'closed' && r.status !== 'resolved').length
    const inProgress = maintenanceRequests.filter(r => r.status === 'in_progress').length
    return { open, urgent, inProgress }
  })()

  const maintenanceWithShop = maintenanceRequests.map(r => ({
    ...r,
    shop_name: shops.find(s => s.id === r.shop_id)?.shop_name || 'Unknown',
    shop_number: shops.find(s => s.id === r.shop_id)?.shop_number || ''
  }))

  // ── Export helpers ──
  const exportCSV = (filename: string, headers: string[], rows: string[][]) => {
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    console.log(`CSV Export — ${filename}:\n${csv}`)
    window.alert(`CSV data for "${filename}" logged to console.\n\nPreview:\n${rows.slice(0, 3).map(r => r.join(' | ')).join('\n')}`)
  }

  const openNewMaintenance = () => {
    setMaintenanceForm({ shop_id: '', title: '', description: '', priority: 'medium' })
    setShowMaintenanceForm(true)
  }

  const saveMaintenanceRequest = async () => {
    if (!maintenanceForm.shop_id) return toast.warning('Required', 'Select a shop')
    if (!maintenanceForm.title.trim()) return toast.warning('Required', 'Title is required')
    setSavingMaintenance(true)
    try {
      const { error } = await supabase.from('mall_maintenance_requests').insert({
        shop_id: maintenanceForm.shop_id,
        title: maintenanceForm.title.trim(),
        description: maintenanceForm.description.trim() || null,
        priority: maintenanceForm.priority,
        requested_by: profile?.id || null,
        requested_by_name: profile?.full_name || null
      })
      if (error) throw error
      toast.success('Created', 'Maintenance request submitted')
      setShowMaintenanceForm(false)
      await fetchMaintenanceRequests()
    } catch (err) {
      toast.error('Error', (err as Error).message)
    } finally {
      setSavingMaintenance(false)
    }
  }

  const updateMaintenanceStatus = async (req: MallMaintenanceRequest, newStatus: string) => {
    const payload: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() }
    if (newStatus === 'resolved') payload.resolved_at = new Date().toISOString()
    const { error } = await supabase
      .from('mall_maintenance_requests')
      .update(payload)
      .eq('id', req.id)
    if (error) return toast.error('Error', error.message)
    setMaintenanceRequests(prev => prev.map(r =>
      r.id === req.id ? { ...r, ...payload, updated_at: new Date().toISOString() } as MallMaintenanceRequest : r
    ))
  }

  const deleteMaintenanceRequest = async (req: MallMaintenanceRequest) => {
    if (!confirm('Delete this maintenance request?')) return
    const { error } = await supabase.from('mall_maintenance_requests').delete().eq('id', req.id)
    if (error) return toast.error('Error', error.message)
    toast.success('Deleted', 'Request removed')
    setMaintenanceRequests(prev => prev.filter(r => r.id !== req.id))
  }

  const generateInvoices = async () => {
    setGeneratingInvoices(true)
    try {
      const occupied = shops.filter(s => s.is_occupied)
      const nowGen = new Date()
      const periodStart = new Date(nowGen.getFullYear(), nowGen.getMonth(), 1).toISOString().split('T')[0]
      const periodEnd = new Date(nowGen.getFullYear(), nowGen.getMonth() + 1, 0).toISOString().split('T')[0]
      const invNumber = `INV-${nowGen.getFullYear()}${String(nowGen.getMonth() + 1).padStart(2, '0')}-`
      let count = 0
      for (const shop of occupied) {
        const { data: existing } = await supabase
          .from('mall_rent_invoices')
          .select('id')
          .eq('shop_id', shop.id)
          .eq('period_start', periodStart)
          .maybeSingle()
        if (existing) continue
        count++
        const { error } = await supabase.from('mall_rent_invoices').insert({
          shop_id: shop.id,
          invoice_number: `${invNumber}${String(count).padStart(3, '0')}`,
          period_start: periodStart,
          period_end: periodEnd,
          rent_amount: shop.monthly_rent,
          late_fee: 0,
          total_amount: shop.monthly_rent,
          status: 'pending'
        })
        if (error) throw error
      }
      toast.success('Invoices', `${count} invoice(s) generated for ${nowGen.toLocaleString('default', { month: 'long', year: 'numeric' })}`)
      await fetchRentInvoices()
    } catch (err) {
      toast.error('Error', (err as Error).message)
    } finally {
      setGeneratingInvoices(false)
    }
  }

  const calculateLateFees = async () => {
    try {
      const overdue = rentInvoices.filter(i =>
        i.status === 'pending' && new Date(i.period_end) < new Date()
      )
      let count = 0
      for (const inv of overdue) {
        const monthsOverdue = Math.max(1, Math.floor(
          (new Date().getTime() - new Date(inv.period_end).getTime()) / (1000 * 60 * 60 * 24 * 30)
        ))
        const lateFee = Math.round(inv.rent_amount * 0.05 * monthsOverdue * 100) / 100
        const { error } = await supabase
          .from('mall_rent_invoices')
          .update({
            late_fee: lateFee,
            total_amount: inv.rent_amount + lateFee,
            status: 'overdue'
          })
          .eq('id', inv.id)
        if (error) throw error
        count++
      }
      toast.success('Late Fees', `${count} invoice(s) updated with late fees (5% per month overdue)`)
      await fetchRentInvoices()
    } catch (err) {
      toast.error('Error', (err as Error).message)
    }
  }

  if (loading) return (
    <div className="min-h-full bg-gray-950 flex items-center justify-center h-full py-16">
      <div className="space-y-4 w-full max-w-md px-4">
        <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-gray-800 rounded animate-pulse w-1/2" />
        <div className="h-10 bg-gray-800 rounded animate-pulse w-full" />
        <div className="h-10 bg-gray-800 rounded animate-pulse w-full" />
        <div className="h-4 bg-gray-800 rounded animate-pulse w-2/3" />
      </div>
    </div>
  )

  return (
    <div className="min-h-full bg-gray-950">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="text-gray-400 hover:text-white p-1">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-white text-2xl font-bold">Mall Management</h2>
              <p className="text-gray-500 text-sm mt-0.5">Manage shops, floor plan & rent tracking</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-800 pb-2 overflow-x-auto">
          {[
            { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
            { id: 'floor-plan' as const, label: 'Floor Plan', icon: Map },
            { id: 'tenants' as const, label: 'Tenants', icon: Users },
            { id: 'reports' as const, label: 'Reports', icon: BarChart3 },
            { id: 'maintenance' as const, label: 'Maintenance', icon: Wrench },
            { id: '3d-view' as const, label: '3D View', icon: Box },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-black'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {activeTab === 'floor-plan' && (
              <>
                <button
                  onClick={() => setViewMode(viewMode === 'plan' ? 'list' : 'plan')}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-xl text-sm transition-colors"
                >
                  <Grid3X3 size={14} />
                  {viewMode === 'plan' ? 'List' : 'Plan'}
                </button>
                <button
                  onClick={() => {
                    if (selectedShop) setShowDetailPanel(!showDetailPanel)
                    else if (currentFloorsShops.length > 0) {
                      setSelectedShop(currentFloorsShops[0].id)
                      setShowDetailPanel(true)
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                    showDetailPanel && selectedShop
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                  }`}
                >
                  <Info size={14} />
                  Details
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
              </>
            )}
            {activeTab === 'overview' && (
              <button
                onClick={openNewShop}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                <Plus size={15} /> Add Shop
              </button>
            )}
            {activeTab === 'tenants' && (
              <button
                onClick={openNewShop}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                <Plus size={15} /> Add Shop
              </button>
            )}
            {activeTab === 'maintenance' && (
              <button
                onClick={() => { fetchMaintenanceRequests(); fetchRentInvoices() }}
                className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-xl text-sm transition-colors"
              >
                <Download size={14} /> Refresh
              </button>
            )}
          </div>
        </div>

        {/* ─── 3D VIEW TAB ─── */}
        {activeTab === '3d-view' && (
          <div className="h-[600px] rounded-2xl overflow-hidden">
            <ErrorBoundary>
              <Mall3DView />
            </ErrorBoundary>
          </div>
        )}

        {/* ─── OVERVIEW TAB ─── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats cards row 1 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-500/10 p-2.5 rounded-xl"><Store size={18} className="text-blue-400" /></div>
                </div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Total Shops</p>
                <p className="text-white text-2xl font-bold mt-1">{overviewStats.totalShops}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-green-500/10 p-2.5 rounded-xl"><Building2 size={18} className="text-green-400" /></div>
                </div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Occupied</p>
                <p className="text-white text-2xl font-bold mt-1">{overviewStats.occupied}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-gray-600/10 p-2.5 rounded-xl"><Home size={18} className="text-gray-400" /></div>
                </div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Vacant</p>
                <p className="text-white text-2xl font-bold mt-1">{overviewStats.vacant}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-amber-500/10 p-2.5 rounded-xl"><Percent size={18} className="text-amber-400" /></div>
                </div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Occupancy Rate</p>
                <p className="text-white text-2xl font-bold mt-1">{overviewStats.occupancyRate}%</p>
              </div>
            </div>

            {/* Stats cards row 2 */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Total Monthly Rent</p>
                <p className="text-white text-2xl font-bold">{fmtUSDshort(overviewStats.totalMonthlyRent)}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Rent Collected This Month</p>
                <p className="text-green-400 text-2xl font-bold">{fmtUSDshort(overviewStats.rentCollectedThisMonth)}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Overdue Accounts</p>
                <p className={`text-2xl font-bold ${overviewStats.overdueCount > 0 ? 'text-red-400' : 'text-white'}`}>{overviewStats.overdueCount}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Total Deposits Held</p>
                <p className="text-white text-2xl font-bold">{fmtUSDshort(overviewStats.totalDeposits)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Clock size={16} className="text-gray-400" />
                  Recent Activity
                </h3>
                {recentPayments.length === 0 ? (
                  <p className="text-gray-600 text-sm">No payments recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {recentPayments.map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="bg-green-500/10 p-1.5 rounded-lg"><DollarSign size={14} className="text-green-400" /></div>
                          <div>
                            <p className="text-white text-sm font-medium">{p.shop?.shop_name || 'Unknown'}</p>
                            <p className="text-gray-500 text-xs">{p.months_paid} month{p.months_paid > 1 ? 's' : ''} · {new Date(p.paid_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <span className="text-green-400 font-medium text-sm">{fmtUSD(p.amount_paid)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={openNewShop}
                    className="flex flex-col items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl p-5 transition-colors"
                  >
                    <Plus size={22} className="text-amber-400" />
                    <span className="text-white text-sm font-medium">Add Shop</span>
                  </button>
                  <button
                    onClick={() => {
                      const firstOverdue = shops.find(s => {
                        if (!s.is_occupied) return false
                        const st = calcRentStatus(s, rentPayments[s.id] || [])
                        return st.label === 'Overdue'
                      })
                      if (firstOverdue) openAddRent(firstOverdue)
                      else {
                        const occupied = shops.filter(s => s.is_occupied)
                        if (occupied.length > 0) openAddRent(occupied[0])
                        else toast.info('No Shops', 'No occupied shops to record rent for')
                      }
                    }}
                    className="flex flex-col items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl p-5 transition-colors"
                  >
                    <DollarSign size={22} className="text-green-400" />
                    <span className="text-white text-sm font-medium">Record Rent</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('reports') }}
                    className="flex flex-col items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl p-5 transition-colors"
                  >
                    <BarChart3 size={22} className="text-blue-400" />
                    <span className="text-white text-sm font-medium">View Reports</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('tenants') }}
                    className="flex flex-col items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl p-5 transition-colors"
                  >
                    <Users size={22} className="text-purple-400" />
                    <span className="text-white text-sm font-medium">Tenants</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── FLOOR PLAN TAB ─── */}
        {activeTab === 'floor-plan' && (
          <>
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
              {floors.length === 0 && (
                <span className="text-gray-500 text-sm">No floors yet. Add a floor to get started.</span>
              )}
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
                  <Move size={12} /> Drag to move
                  <Maximize size={12} /> Drag handles to resize
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-600 inline-block" /> Paid</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500 inline-block" /> Due 7-14d</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500 inline-block" /> Due &lt;7d</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-600 inline-block" /> Overdue</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-600 inline-block" /> Vacant</span>
                </div>
                <div
                  ref={planRef}
                  className="relative select-none"
                  style={{ minHeight: 800, minWidth: 1200 }}
                >
                  {currentFloorsShops.map((shop) => {
                    const payments = rentPayments[shop.id] || []
                    const status = calcRentStatus(shop, payments)
                    return (
                      <div
                        key={shop.id}
                        onMouseDown={(e) => handleDragStart(e, shop.id)}
                        onClick={() => handleShopPlanClick(shop)}
                        className={`absolute border-2 rounded-lg flex flex-col items-center justify-center text-xs font-medium cursor-grab active:cursor-grabbing transition-colors group ${
                          selectedShop === shop.id ? 'border-amber-400 z-10' : 'border-gray-700'
                        } ${status.color} bg-opacity-90`}
                        style={{
                          left: shop.pos_x,
                          top: shop.pos_y,
                          width: shop.width,
                          height: shop.height,
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

                        <button
                          className="info-btn absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900/80 rounded-full p-0.5 text-gray-300 hover:text-white z-20"
                          onClick={(e) => handleShopInfoClick(e, shop)}
                          title="View details"
                        >
                          <Info size={10} />
                        </button>
                        {selectedShop === shop.id && (
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditShop(shop) }}
                              className="bg-gray-900/80 hover:bg-gray-800 text-amber-400 p-0.5 rounded"
                              title="Edit shop"
                            >
                              <Edit3 size={10} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteShop(shop) }}
                              className="bg-gray-900/80 hover:bg-gray-800 text-red-400 p-0.5 rounded"
                              title="Delete shop"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        )}

                        <div className="resize-handle absolute -top-1 -left-1 w-3 h-3 cursor-nwse-resize bg-white/20 hover:bg-white/40 rounded-sm z-20" onMouseDown={(e) => handleResizeStart(e, shop.id, 'nw')} />
                        <div className="resize-handle absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 cursor-ns-resize bg-white/20 hover:bg-white/40 rounded-sm z-20" onMouseDown={(e) => handleResizeStart(e, shop.id, 'n')} />
                        <div className="resize-handle absolute -top-1 -right-1 w-3 h-3 cursor-nesw-resize bg-white/20 hover:bg-white/40 rounded-sm z-20" onMouseDown={(e) => handleResizeStart(e, shop.id, 'ne')} />
                        <div className="resize-handle absolute top-1/2 -right-1 -translate-y-1/2 w-3 h-3 cursor-ew-resize bg-white/20 hover:bg-white/40 rounded-sm z-20" onMouseDown={(e) => handleResizeStart(e, shop.id, 'e')} />
                        <div className="resize-handle absolute -bottom-1 -right-1 w-3 h-3 cursor-nwse-resize bg-white/20 hover:bg-white/40 rounded-sm z-20" onMouseDown={(e) => handleResizeStart(e, shop.id, 'se')} />
                        <div className="resize-handle absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 cursor-ns-resize bg-white/20 hover:bg-white/40 rounded-sm z-20" onMouseDown={(e) => handleResizeStart(e, shop.id, 's')} />
                        <div className="resize-handle absolute -bottom-1 -left-1 w-3 h-3 cursor-nesw-resize bg-white/20 hover:bg-white/40 rounded-sm z-20" onMouseDown={(e) => handleResizeStart(e, shop.id, 'sw')} />
                        <div className="resize-handle absolute top-1/2 -left-1 -translate-y-1/2 w-3 h-3 cursor-ew-resize bg-white/20 hover:bg-white/40 rounded-sm z-20" onMouseDown={(e) => handleResizeStart(e, shop.id, 'w')} />
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
                      className={`bg-gray-900 border rounded-2xl p-4 cursor-pointer transition-colors ${
                        isSelected ? 'border-amber-500' : 'border-gray-800 hover:border-gray-700'
                      }`}
                      onClick={() => {
                        if (selectedShop === shop.id) {
                          setSelectedShop(null)
                        } else {
                          setSelectedShop(shop.id)
                        }
                      }}
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
                        <span className="text-gray-400 text-xs">{fmtUSDshort(shop.monthly_rent)}/mo</span>
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

            {/* Selected shop detail panel */}
            {showDetailPanel && (() => {
              const shop = shops.find(s => s.id === selectedShop)
              if (!shop) return null
              const payments = rentPayments[shop.id] || []
              const status = calcRentStatus(shop, payments)
              return (
                <div className="mt-4 bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white font-bold text-lg">{shop.shop_name}</h3>
                      <p className="text-gray-400 text-sm">Shop {shop.shop_number} · {activeFloorObj?.name || ''}</p>
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
                      <button
                        onClick={() => { setShowDetailPanel(false); deleteShop(shop) }}
                        className="flex items-center gap-1.5 bg-red-900/50 hover:bg-red-800/60 text-red-400 px-3 py-1.5 rounded-xl text-sm transition-colors"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                      <button
                        onClick={() => { setShowDetailPanel(false); setSelectedShop(null) }}
                        className="text-gray-400 hover:text-white p-1"
                      >
                        <X size={18} />
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
                      <p className="text-white font-medium text-sm">{fmtUSDshort(shop.monthly_rent)}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-gray-500 text-xs">Position</p>
                      <p className="text-white font-medium text-sm">X: {shop.pos_x}px Y: {shop.pos_y}px</p>
                      <p className="text-gray-400 text-xs">{shop.width} x {shop.height}px</p>
                    </div>
                  </div>

                  {shop.shop_category && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-gray-800 rounded-xl p-3">
                        <p className="text-gray-500 text-xs">Category</p>
                        <p className="text-white font-medium text-sm">{shop.shop_category}</p>
                      </div>
                      {shop.lease_start_date && (
                        <div className="bg-gray-800 rounded-xl p-3">
                          <p className="text-gray-500 text-xs">Lease</p>
                          <p className="text-white font-medium text-sm">
                            {new Date(shop.lease_start_date).toLocaleDateString()} — {shop.lease_end_date ? new Date(shop.lease_end_date).toLocaleDateString() : 'Open'}
                          </p>
                        </div>
                      )}
                      {shop.deposit_amount > 0 && (
                        <div className="bg-gray-800 rounded-xl p-3">
                          <p className="text-gray-500 text-xs">Deposit</p>
                          <p className="text-white font-medium text-sm">{fmtUSDshort(shop.deposit_amount)}</p>
                        </div>
                      )}
                    </div>
                  )}

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
                              {payment.recorded_by_name && <p className="text-gray-600 text-xs mt-0.5">Recorded by {payment.recorded_by_name}</p>}
                            </div>
                            <div className="text-right">
                              <p className="text-amber-400 font-medium text-sm">{fmtUSD(payment.amount_paid)}</p>
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
          </>
        )}

        {/* ─── TENANTS TAB ─── */}
        {activeTab === 'tenants' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={tenantSearch}
                  onChange={(e) => setTenantSearch(e.target.value)}
                  placeholder="Search by name, shop, phone, email..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <select
                value={tenantFilterFloor}
                onChange={(e) => setTenantFilterFloor(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">All Floors</option>
                {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <span className="text-gray-500 text-sm">{tenantList.length} tenant{tenantList.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/50">
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Shop #</th>
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Shop Name</th>
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Floor</th>
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Tenant</th>
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Phone</th>
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Email</th>
                      <th className="text-right text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Rent/mo</th>
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Lease End</th>
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Status</th>
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {tenantList.map(shop => {
                      const payments = rentPayments[shop.id] || []
                      const status = calcRentStatus(shop, payments)
                      return (
                        <tr
                          key={shop.id}
                          className="hover:bg-gray-800/50 transition-colors cursor-pointer"
                          onClick={() => { setTenantDetailShop(shop); setShowTenantDetail(true) }}
                        >
                          <td className="px-4 py-3 text-white font-medium">{shop.shop_number}</td>
                          <td className="px-4 py-3 text-gray-300">{shop.shop_name}</td>
                          <td className="px-4 py-3 text-gray-400">{shop.floorName}</td>
                          <td className="px-4 py-3 text-white">{shop.tenant_name || '-'}</td>
                          <td className="px-4 py-3 text-gray-400">{shop.tenant_phone || '-'}</td>
                          <td className="px-4 py-3 text-gray-400">{shop.email || '-'}</td>
                          <td className="px-4 py-3 text-right text-white font-medium">{fmtUSDshort(shop.monthly_rent)}</td>
                          <td className="px-4 py-3 text-gray-400">{shop.lease_end_date ? new Date(shop.lease_end_date).toLocaleDateString() : '-'}</td>
                          <td className="px-4 py-3">
                            {!shop.is_occupied ? (
                              <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">Vacant</span>
                            ) : status.label === 'Overdue' ? (
                              <span className="text-[10px] text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">Overdue</span>
                            ) : (
                              <span className="text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">Active</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditShop(shop) }}
                              className="text-gray-500 hover:text-amber-400 p-1"
                            >
                              <Edit3 size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {tenantList.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center py-12 text-gray-500 text-sm">No tenants found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── REPORTS TAB ─── */}
        {activeTab === 'reports' && (
          <div className="space-y-8">
            {/* Occupancy Report */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Building2 size={16} className="text-gray-400" />
                  Occupancy Report
                </h3>
                <button
                  onClick={() => exportCSV('occupancy-report', ['Floor', 'Total Shops', 'Occupied', 'Vacant', 'Occupancy %'], occupancyReport.map(r => [r.floor, String(r.total), String(r.occupied), String(r.vacant), `${r.rate}%`]))}
                  className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download size={12} /> Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Floor</th>
                      <th className="text-right text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Total Shops</th>
                      <th className="text-right text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Occupied</th>
                      <th className="text-right text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Vacant</th>
                      <th className="text-right text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Occupancy %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {occupancyReport.map(r => (
                      <tr key={r.floor} className="hover:bg-gray-800/30">
                        <td className="px-3 py-2.5 text-white font-medium">{r.floor}</td>
                        <td className="px-3 py-2.5 text-gray-300 text-right">{r.total}</td>
                        <td className="px-3 py-2.5 text-green-400 text-right">{r.occupied}</td>
                        <td className="px-3 py-2.5 text-gray-400 text-right">{r.vacant}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`font-medium ${r.rate >= 80 ? 'text-green-400' : r.rate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{r.rate}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rent Collection Report */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <DollarSign size={16} className="text-gray-400" />
                  Rent Collection — {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  onClick={() => exportCSV('rent-collection', ['Floor', 'Expected', 'Collected', 'Outstanding'], rentCollectionReport.map(r => [r.floor, fmtUSD(r.expected), fmtUSD(r.collected), fmtUSD(r.outstanding)]))}
                  className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download size={12} /> Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Floor</th>
                      <th className="text-right text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Expected</th>
                      <th className="text-right text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Collected</th>
                      <th className="text-right text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Outstanding</th>
                      <th className="text-right text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Collection %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {rentCollectionReport.map(r => {
                      const pct = r.expected > 0 ? Math.round((r.collected / r.expected) * 100) : 0
                      return (
                        <tr key={r.floor} className="hover:bg-gray-800/30">
                          <td className="px-3 py-2.5 text-white font-medium">{r.floor}</td>
                          <td className="px-3 py-2.5 text-gray-300 text-right">{fmtUSDshort(r.expected)}</td>
                          <td className="px-3 py-2.5 text-green-400 text-right">{fmtUSDshort(r.collected)}</td>
                          <td className="px-3 py-2.5 text-red-400 text-right">{r.outstanding > 0 ? fmtUSDshort(r.outstanding) : '$0'}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`font-medium ${pct >= 90 ? 'text-green-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{pct}%</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Lease Expiry Report */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <CalendarDays size={16} className="text-gray-400" />
                  Leases Expiring Within 60 Days
                </h3>
                <button
                  onClick={() => exportCSV('leases-expiring', ['Shop #', 'Shop Name', 'Floor', 'Tenant', 'Lease End', 'Days Left'], leasesExpiring.map(r => [r.shop_number, r.shop_name, r.floorName, r.tenant_name || '', r.lease_end_date ? new Date(r.lease_end_date).toLocaleDateString() : '', String(r.daysLeft)]))}
                  className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download size={12} /> Export CSV
                </button>
              </div>
              {leasesExpiring.length === 0 ? (
                <p className="text-gray-600 text-sm py-4">No leases expiring within the next 60 days.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Shop #</th>
                        <th className="text-left text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Shop Name</th>
                        <th className="text-left text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Floor</th>
                        <th className="text-left text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Tenant</th>
                        <th className="text-left text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Lease End</th>
                        <th className="text-right text-gray-400 font-medium px-3 py-2.5 text-xs uppercase tracking-wide">Days Left</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {leasesExpiring.map(r => (
                        <tr key={r.id} className="hover:bg-gray-800/30">
                          <td className="px-3 py-2.5 text-white font-medium">{r.shop_number}</td>
                          <td className="px-3 py-2.5 text-gray-300">{r.shop_name}</td>
                          <td className="px-3 py-2.5 text-gray-400">{r.floorName}</td>
                          <td className="px-3 py-2.5 text-white">{r.tenant_name || '-'}</td>
                          <td className="px-3 py-2.5 text-gray-300">{new Date(r.lease_end_date!).toLocaleDateString()}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`font-medium ${r.daysLeft <= 7 ? 'text-red-400' : r.daysLeft <= 30 ? 'text-amber-400' : 'text-yellow-400'}`}>{r.daysLeft}d</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── MAINTENANCE TAB ─── */}
        {activeTab === 'maintenance' && (
          <div className="space-y-6">
            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Open Requests</p>
                <p className="text-white text-2xl font-bold">{maintenanceStats.open}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Urgent</p>
                <p className={`text-2xl font-bold ${maintenanceStats.urgent > 0 ? 'text-red-400' : 'text-white'}`}>{maintenanceStats.urgent}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">In Progress</p>
                <p className="text-amber-400 text-2xl font-bold">{maintenanceStats.inProgress}</p>
              </div>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Wrench size={16} className="text-gray-400" />
                Maintenance Requests
              </h3>
              <button
                onClick={openNewMaintenance}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                <Plus size={15} /> New Request
              </button>
            </div>

            {/* Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/50">
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Shop</th>
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Title</th>
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Priority</th>
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Status</th>
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Requested By</th>
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Date</th>
                      <th className="text-left text-gray-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {maintenanceWithShop.map(r => (
                      <tr key={r.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">
                          <span className="text-xs text-gray-500">{r.shop_number}</span>
                          <div className="text-xs text-gray-400">{r.shop_name}</div>
                        </td>
                        <td className="px-4 py-3 text-white">
                          <div className="text-sm font-medium">{r.title}</div>
                          {r.description && <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{r.description}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            r.priority === 'urgent' ? 'bg-red-400/10 text-red-400' :
                            r.priority === 'high' ? 'bg-orange-400/10 text-orange-400' :
                            r.priority === 'medium' ? 'bg-yellow-400/10 text-yellow-400' :
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {r.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            r.status === 'open' ? 'bg-blue-400/10 text-blue-400' :
                            r.status === 'in_progress' ? 'bg-amber-400/10 text-amber-400' :
                            r.status === 'resolved' ? 'bg-green-400/10 text-green-400' :
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {r.status === 'in_progress' ? 'In Progress' : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{r.requested_by_name || '-'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {r.status === 'open' && (
                              <button
                                onClick={() => updateMaintenanceStatus(r, 'in_progress')}
                                className="text-[10px] bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 px-2 py-0.5 rounded-lg font-medium transition-colors"
                              >
                                Start
                              </button>
                            )}
                            {r.status === 'in_progress' && (
                              <button
                                onClick={() => updateMaintenanceStatus(r, 'resolved')}
                                className="text-[10px] bg-green-500/10 text-green-400 hover:bg-green-500/20 px-2 py-0.5 rounded-lg font-medium transition-colors"
                              >
                                Resolve
                              </button>
                            )}
                            {r.status === 'resolved' && (
                              <button
                                onClick={() => updateMaintenanceStatus(r, 'closed')}
                                className="text-[10px] bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 px-2 py-0.5 rounded-lg font-medium transition-colors"
                              >
                                Close
                              </button>
                            )}
                            <button
                              onClick={() => deleteMaintenanceRequest(r)}
                              className="text-[10px] text-red-400 hover:text-red-300 px-1 py-0.5"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {maintenanceWithShop.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-gray-500 text-sm">No maintenance requests.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── RENT INVOICES SECTION IN REPORTS ─── */}
        {activeTab === 'reports' && (() => {
          const totalPending = rentInvoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.total_amount, 0)
          const totalOverdue = rentInvoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.total_amount, 0)
          const totalPaid = rentInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_amount, 0)
          return (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Receipt size={16} className="text-gray-400" />
                  Rent Invoices
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={calculateLateFees}
                    className="flex items-center gap-1.5 text-xs bg-red-600/10 hover:bg-red-600/20 text-red-400 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <AlertTriangle size={12} /> Calculate Late Fees
                  </button>
                  <button
                    onClick={generateInvoices}
                    disabled={generatingInvoices}
                    className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {generatingInvoices ? 'Generating...' : <><Plus size={12} /> Generate Invoices</>}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-800 rounded-xl p-3">
                  <p className="text-gray-500 text-xs">Pending</p>
                  <p className="text-amber-400 font-bold text-lg">{fmtUSDshort(totalPending)}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <p className="text-gray-500 text-xs">Overdue</p>
                  <p className="text-red-400 font-bold text-lg">{fmtUSDshort(totalOverdue)}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <p className="text-gray-500 text-xs">Paid</p>
                  <p className="text-green-400 font-bold text-lg">{fmtUSDshort(totalPaid)}</p>
                </div>
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-400 font-medium px-3 py-2 text-xs uppercase tracking-wide">Invoice #</th>
                      <th className="text-left text-gray-400 font-medium px-3 py-2 text-xs uppercase tracking-wide">Shop</th>
                      <th className="text-left text-gray-400 font-medium px-3 py-2 text-xs uppercase tracking-wide">Period</th>
                      <th className="text-right text-gray-400 font-medium px-3 py-2 text-xs uppercase tracking-wide">Rent</th>
                      <th className="text-right text-gray-400 font-medium px-3 py-2 text-xs uppercase tracking-wide">Late Fee</th>
                      <th className="text-right text-gray-400 font-medium px-3 py-2 text-xs uppercase tracking-wide">Total</th>
                      <th className="text-left text-gray-400 font-medium px-3 py-2 text-xs uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {rentInvoices.map(inv => {
                      const shop = shops.find(s => s.id === inv.shop_id)
                      return (
                        <tr key={inv.id} className="hover:bg-gray-800/30">
                          <td className="px-3 py-2 text-white font-medium text-xs">{inv.invoice_number}</td>
                          <td className="px-3 py-2 text-gray-300 text-xs">{shop?.shop_number || '?'} — {shop?.shop_name || 'Unknown'}</td>
                          <td className="px-3 py-2 text-gray-400 text-xs">{new Date(inv.period_start).toLocaleDateString()} — {new Date(inv.period_end).toLocaleDateString()}</td>
                          <td className="px-3 py-2 text-right text-gray-300 text-xs">{fmtUSDshort(inv.rent_amount)}</td>
                          <td className="px-3 py-2 text-right text-xs">{inv.late_fee > 0 ? <span className="text-red-400">{fmtUSDshort(inv.late_fee)}</span> : '-'}</td>
                          <td className="px-3 py-2 text-right text-white font-medium text-xs">{fmtUSDshort(inv.total_amount)}</td>
                          <td className="px-3 py-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              inv.status === 'paid' ? 'bg-green-400/10 text-green-400' :
                              inv.status === 'overdue' ? 'bg-red-400/10 text-red-400' :
                              inv.status === 'cancelled' ? 'bg-gray-500/10 text-gray-400' :
                              'bg-amber-400/10 text-amber-400'
                            }`}>
                              {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {rentInvoices.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-gray-500 text-xs">No invoices generated yet. Click "Generate Invoices" to create invoices for the current month.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

      {/* ─── SHOP FORM MODAL ─── */}
      {showShopForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg border border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Shop Category</label>
                  <select
                    value={shopForm.shop_category}
                    onChange={(e) => setShopForm({ ...shopForm, shop_category: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Select category</option>
                    {SHOP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer mt-6">
                    <input
                      type="checkbox"
                      checked={shopForm.is_occupied}
                      onChange={(e) => setShopForm({ ...shopForm, is_occupied: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-white text-sm font-medium">Occupied</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Position X (px)</label>
                  <input type="number" value={shopForm.pos_x} onChange={(e) => setShopForm({ ...shopForm, pos_x: parseInt(e.target.value) || 0 })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Position Y (px)</label>
                  <input type="number" value={shopForm.pos_y} onChange={(e) => setShopForm({ ...shopForm, pos_y: parseInt(e.target.value) || 0 })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Width (px)</label>
                  <input type="number" min={20} value={shopForm.width} onChange={(e) => setShopForm({ ...shopForm, width: parseInt(e.target.value) || 20 })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1">Height (px)</label>
                  <input type="number" min={20} value={shopForm.height} onChange={(e) => setShopForm({ ...shopForm, height: parseInt(e.target.value) || 20 })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <h4 className="text-gray-300 text-sm font-medium mb-3">Tenant Information</h4>
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
                <div className="mt-3">
                  <label className="text-gray-400 text-xs font-medium block mb-1">Email</label>
                  <input value={shopForm.email} onChange={(e) => setShopForm({ ...shopForm, email: e.target.value })} placeholder="tenant@email.com" type="email" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <h4 className="text-gray-300 text-sm font-medium mb-3">Lease & Financial Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Monthly Rent ($)</label>
                    <input value={shopForm.monthly_rent} onChange={(e) => setShopForm({ ...shopForm, monthly_rent: e.target.value })} placeholder="e.g. 1500" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Deposit Amount ($)</label>
                    <input value={shopForm.deposit_amount} onChange={(e) => setShopForm({ ...shopForm, deposit_amount: e.target.value })} placeholder="e.g. 3000" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Lease Start Date</label>
                    <input type="date" value={shopForm.lease_start_date} onChange={(e) => setShopForm({ ...shopForm, lease_start_date: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-medium block mb-1">Lease End Date</label>
                    <input type="date" value={shopForm.lease_end_date} onChange={(e) => setShopForm({ ...shopForm, lease_end_date: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1">Notes</label>
                <textarea value={shopForm.notes} onChange={(e) => setShopForm({ ...shopForm, notes: e.target.value })} placeholder="Additional notes about this shop or tenant" rows={3} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-800 flex gap-2 justify-end sticky bottom-0 bg-gray-900">
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
              <div><label className="text-gray-400 text-xs font-medium block mb-1">Amount Paid ($) *</label><input value={rentForm.amount_paid} onChange={(e) => setRentForm({ ...rentForm, amount_paid: e.target.value })} placeholder="e.g. 1500" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" /></div>
              <div><label className="text-gray-400 text-xs font-medium block mb-1">Recorded By</label><input value={profile?.full_name || ''} disabled className="w-full bg-gray-800/50 border border-gray-700 text-gray-400 rounded-xl px-3 py-2 text-sm cursor-not-allowed" /></div>
              <div><label className="text-gray-400 text-xs font-medium block mb-1">Notes</label><textarea value={rentForm.notes} onChange={(e) => setRentForm({ ...rentForm, notes: e.target.value })} placeholder="Optional notes" rows={2} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" /></div>
            </div>
            <div className="p-5 border-t border-gray-800 flex gap-2 justify-end">
              <button onClick={() => { setShowRentForm(false); setRentShop(null) }} className="px-4 py-2 text-sm text-gray-400 hover:text-white font-medium">Cancel</button>
              <button onClick={saveRent} disabled={savingRent} className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors">{savingRent ? 'Saving...' : 'Record Payment'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MAINTENANCE REQUEST MODAL ─── */}
      {showMaintenanceForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-800">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">New Maintenance Request</h3>
              <button onClick={() => setShowMaintenanceForm(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1">Shop *</label>
                <select
                  value={maintenanceForm.shop_id}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, shop_id: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select a shop</option>
                  {shops.filter(s => s.is_occupied).map(shop => (
                    <option key={shop.id} value={shop.id}>{shop.shop_number} — {shop.shop_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1">Title *</label>
                <input
                  value={maintenanceForm.title}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, title: e.target.value })}
                  placeholder="e.g. AC not working"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1">Description</label>
                <textarea
                  value={maintenanceForm.description}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                  placeholder="Describe the issue..."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1">Priority</label>
                <select
                  value={maintenanceForm.priority}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, priority: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1">Requested By</label>
                <input value={profile?.full_name || ''} disabled className="w-full bg-gray-800/50 border border-gray-700 text-gray-400 rounded-xl px-3 py-2 text-sm cursor-not-allowed" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-800 flex gap-2 justify-end">
              <button onClick={() => setShowMaintenanceForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white font-medium">Cancel</button>
              <button onClick={saveMaintenanceRequest} disabled={savingMaintenance} className="bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors">
                {savingMaintenance ? 'Saving...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TENANT DETAIL MODAL ─── */}
      {showTenantDetail && tenantDetailShop && (() => {
        const shop = tenantDetailShop
        const payments = rentPayments[shop.id] || []
        const status = calcRentStatus(shop, payments)
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl w-full max-w-lg border border-gray-800 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
                <h3 className="text-white font-bold">Tenant Details</h3>
                <button onClick={() => { setShowTenantDetail(false); setTenantDetailShop(null) }} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-5 space-y-5">
                {/* Shop & Tenant Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Shop</p>
                    <p className="text-white font-semibold">{shop.shop_number} — {shop.shop_name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{floors.find(f => f.id === shop.floor_id)?.name || 'Unknown'}</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${status.color}`} />
                      <span className="text-white font-medium text-sm">{shop.is_occupied ? 'Occupied' : 'Vacant'} — {status.label}</span>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div>
                  <h4 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">Contact Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-gray-500 text-xs">Tenant Name</p>
                      <p className="text-white text-sm font-medium mt-0.5">{shop.tenant_name || '-'}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-gray-500 text-xs">Phone</p>
                      <p className="text-white text-sm font-medium mt-0.5">{shop.tenant_phone || '-'}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-gray-500 text-xs">Email</p>
                      <p className="text-white text-sm font-medium mt-0.5">{shop.email || '-'}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-gray-500 text-xs">Category</p>
                      <p className="text-white text-sm font-medium mt-0.5">{shop.shop_category || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Lease & Financial */}
                <div>
                  <h4 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">Lease & Financial</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-gray-500 text-xs">Monthly Rent</p>
                      <p className="text-white text-sm font-medium mt-0.5">{fmtUSDshort(shop.monthly_rent)}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-gray-500 text-xs">Deposit</p>
                      <p className="text-white text-sm font-medium mt-0.5">{shop.deposit_amount > 0 ? fmtUSDshort(shop.deposit_amount) : '-'}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-gray-500 text-xs">Lease Start</p>
                      <p className="text-white text-sm font-medium mt-0.5">{shop.lease_start_date ? new Date(shop.lease_start_date).toLocaleDateString() : '-'}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-gray-500 text-xs">Lease End</p>
                      <p className="text-white text-sm font-medium mt-0.5">{shop.lease_end_date ? new Date(shop.lease_end_date).toLocaleDateString() : '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {shop.notes && (
                  <div>
                    <h4 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">Notes</h4>
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-gray-300 text-sm whitespace-pre-wrap">{shop.notes}</p>
                    </div>
                  </div>
                )}

                {/* Payment History */}
                <div>
                  <h4 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">Payment History</h4>
                  {payments.length === 0 ? (
                    <p className="text-gray-600 text-sm">No payments recorded yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {[...payments].reverse().map(p => (
                        <div key={p.id} className="bg-gray-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
                          <div>
                            <p className="text-white text-sm font-medium">{p.months_paid} month{p.months_paid > 1 ? 's' : ''}</p>
                            {p.notes && <p className="text-gray-500 text-xs mt-0.5">{p.notes}</p>}
                            {p.recorded_by_name && <p className="text-gray-600 text-xs mt-0.5">by {p.recorded_by_name}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-amber-400 font-medium text-sm">{fmtUSD(p.amount_paid)}</p>
                            <p className="text-gray-500 text-xs">{new Date(p.paid_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => { setShowTenantDetail(false); setTenantDetailShop(null); openEditShop(shop) }}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                  >
                    <Edit3 size={14} /> Edit Shop
                  </button>
                  <button
                    onClick={() => { setShowTenantDetail(false); setTenantDetailShop(null); openAddRent(shop) }}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl text-sm transition-colors"
                  >
                    <CalendarDays size={14} /> Record Payment
                  </button>
                  <button
                    onClick={() => { setShowTenantDetail(false); setTenantDetailShop(null) }}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
      </div>
    </div>
  )
}
