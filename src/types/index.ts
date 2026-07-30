export type Role =
  | 'owner'
  | 'manager'
  | 'staff'
  | 'accountant'
  | 'waitron'
  | 'bar'
  | 'kitchen'
  | 'griller'
  | 'mixologist'
  | 'games_master'
  | 'shisha_attendant'
  | 'auditor'

export type OrderStatus = 'open' | 'paid' | 'voided' | 'pending'
export type OrderType = 'direct' | 'cash_sale' | 'table' | 'takeaway'
export type PaymentMethod =
  | 'cash'
  | 'bank_pos'
  | 'bank_transfer'
  | 'credit'
  | 'card'
  | 'transfer'
  | 'split'
export type ItemStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
export type TableStatus = 'available' | 'occupied' | 'reserved'
export type ItemDestination = 'kitchen' | 'bar' | 'mixologist' | 'griller' | 'shisha' | 'games'

export interface Profile {
  id: string
  full_name: string
  role: Role
  email?: string
  phone?: string
  pin?: string
  is_active: boolean
  created_at: string
}

export interface TableCategory {
  id: string
  name: string
  hire_fee?: number | null
}

export interface Table {
  id: string
  name: string
  status: TableStatus
  category_id: string
  assigned_staff?: string | null
  capacity?: number
  table_categories?: TableCategory
}

export interface MenuItem {
  id: string
  name: string
  price: number
  description?: string | null
  image_url?: string | null
  is_available?: boolean
  category_id?: string | null
  menu_categories?: { name?: string; destination?: string } | null
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id?: string | null
  item_name: string
  quantity: number
  unit_price: number
  total_price: number
  status?: ItemStatus
  destination?: string | null
  modifier_notes?: string | null
  extra_charge?: number
  return_requested?: boolean
  return_accepted?: boolean
  return_reason?: string | null
  created_at: string
  menu_items?: {
    name: string
    price?: number
    menu_categories?: { name?: string; destination?: string } | null
  } | null
}

export interface Order {
  id: string
  staff_id?: string | null
  table_id?: string | null
  order_type: OrderType
  status: OrderStatus
  total_amount: number
  notes?: string | null
  payment_method?: PaymentMethod | string | null
  customer_name?: string | null
  customer_phone?: string | null
  created_at: string
  closed_at?: string | null
  updated_at?: string | null
  order_items?: OrderItem[]
  tables?: { name: string; assigned_staff?: string | null } | null
  profiles?: { full_name: string } | null
}

export interface TillSession {
  id: string
  staff_id: string
  opening_float: number
  closing_float?: number | null
  total_sales: number
  total_payouts: number
  expected_cash: number
  shortfall?: number
  surplus?: number
  opened_at: string
  closed_at?: string | null
  status: 'open' | 'closed'
  notes?: string | null
}

export interface Payout {
  id: string
  till_session_id: string
  amount: number
  reason: string
  category: string
  staff_id: string
  created_at: string
}

export interface InventoryItem {
  id: string
  item_name: string
  category: string
  unit: string
  current_stock: number
  minimum_stock: number
  cost_price?: number
  selling_price?: number
  is_active: boolean
}

export interface AuditEntry {
  id: string
  action: string
  entity: string
  entity_id?: string
  entity_name?: string
  old_value?: unknown
  new_value?: unknown
  performed_by?: string
  performed_by_name?: string
  performed_by_role?: Role
  created_at: string
}

export interface Setting {
  id: string
  value: string
  updated_at: string
}

export interface SyncStatus {
  status: 'online' | 'offline' | 'syncing' | 'partial'
  pending: number
}

export interface AuditParams {
  action: string
  entity: string
  entityId?: string
  entityName?: string
  oldValue?: unknown
  newValue?: unknown
  performer?: Pick<Profile, 'id' | 'full_name' | 'role'> | null
}
