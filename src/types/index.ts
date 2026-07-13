// ─── Core domain types ────────────────────────────────────────────────────

export type Role = 'owner' | 'manager' | 'waitron' | 'kitchen' | 'bar'

export type OrderStatus = 'open' | 'paid' | 'voided' | 'pending'
export type OrderType = 'table' | 'cash_sale' | 'takeaway'
export type DeliveryStatus = 'pending_delivery' | 'out_for_delivery' | 'delivered' | 'paid'
export type PaymentMethod =
  | 'cash'
  | 'bank_pos'
  | 'bank_transfer'
  | 'credit'
  | 'card'
  | 'transfer'
  | 'split'
export type ItemDestination = 'kitchen' | 'bar'
export type ItemStatus = 'pending' | 'preparing' | 'ready' | 'delivered'
export type TableStatus = 'available' | 'occupied' | 'reserved'
// ─── Database row types ────────────────────────────────────────────────────

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

export interface MenuCategory {
  id: string
  name: string
  destination: ItemDestination
}

export interface MenuItem {
  id: string
  name: string
  price: number
  is_available: boolean
  category_id: string
  menu_categories?: MenuCategory
  current_stock?: number | null
  hasZonePrice?: boolean
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  quantity: number
  unit_price: number
  total_price: number
  status?: ItemStatus
  destination?: ItemDestination
  modifier_notes?: string | null
  extra_charge?: number
  created_at: string
  menu_items?:
    | (Pick<MenuItem, 'name' | 'price'> & { menu_categories?: MenuCategory })
    | { name: string; price?: number; menu_categories?: MenuCategory }
    | null
}

export interface BodaOperator {
  id: string
  name: string
  phone: string
  service_area?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  table_id?: string | null
  staff_id?: string | null
  order_type: OrderType
  status: OrderStatus
  total_amount: number
  notes?: string | null
  covers?: number | null
  payment_method?: PaymentMethod | null
  customer_name?: string | null
  customer_phone?: string | null
  boda_operator_id?: string | null
  delivery_area?: string | null
  delivery_status?: DeliveryStatus | null
  delivery_fee?: number
  payment_received_at?: string | null
  created_at: string
  closed_at?: string | null
  updated_at?: string | null
  tables?:
    | Pick<Table, 'id' | 'name'>
    | { name: string; table_categories?: { name: string } | null }
    | null
  order_items?: OrderItem[]
  boda_operators?: Pick<BodaOperator, 'id' | 'name' | 'phone'> | null
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
  menu_item_id?: string | null
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

// ─── Print queue types ──────────────────────────────────────────────────────

export type PrintJobType = 'customer' | 'waiter' | 'kitchen' | 'bar'
export type PrintJobStatus = 'pending' | 'printing' | 'printed' | 'failed' | 'cancelled'

export interface PrinterConfig {
  id: string
  name: string
  ip: string
  port: number
  copies: number
  types: PrintJobType[]
}

export interface PrintJob {
  id: string
  order_id: string | null
  receipt_number: string
  type: PrintJobType
  status: PrintJobStatus
  copies: number
  printer_ip: string | null
  receipt_data: Record<string, unknown>
  error_message: string | null
  retry_count: number
  max_retries: number
  next_retry_at: string | null
  created_at: string
  started_at: string | null
  printed_at: string | null
}

export interface ReceiptLine {
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  double?: boolean
  text: string
}

export interface ReceiptSection {
  lines: ReceiptLine[]
  divider?: boolean
  spaceBefore?: number
  spaceAfter?: number
}

export interface ReceiptData {
  title: string
  subtitle?: string
  header: { label: string; value: string }[]
  items: { name: string; qty: number; price: string; total: string }[]
  totals: { label: string; value: string; bold?: boolean; double?: boolean }[]
  footer: string[]
  barcode?: string
  qrUrl?: string
}

// ─── Audit helper params ──────────────────────────────────────────────────

export interface MallFloor {
  id: string
  name: string
  floor_number: number
  created_at: string
}

export interface MallShop {
  id: string
  shop_number: string
  shop_name: string
  floor_id: string
  pos_x: number
  pos_y: number
  width: number
  height: number
  tenant_name: string | null
  tenant_phone: string | null
  monthly_rent: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MallRentPayment {
  id: string
  shop_id: string
  months_paid: number
  amount_paid: number
  paid_at: string
  notes: string | null
  created_at: string
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
