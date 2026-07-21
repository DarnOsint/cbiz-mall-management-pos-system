// ─── Core domain types ────────────────────────────────────────────────────

export type Role = 'owner' | 'manager' | 'cashier'

export type SaleStatus = 'open' | 'paid' | 'voided' | 'cancelled'
export type SaleType = 'sale' | 'return'
export type OrderStatus = SaleStatus
export type OrderType = SaleType
export type PaymentMethod =
  | 'cash'
  | 'bank_pos'
  | 'bank_transfer'
  | 'credit'
  | 'card'
  | 'transfer'
  | 'split'
export type ItemStatus = 'pending' | 'completed' | 'cancelled'

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

export interface ItemCategory {
  id: string
  name: string
  sort_order?: number
  is_active?: boolean
  created_at?: string
}

export interface Item {
  id: string
  name: string
  description?: string | null
  sku?: string | null
  price: number
  cost_price?: number | null
  category_id?: string | null
  image_url?: string | null
  is_active: boolean
  is_available: boolean
  stock_quantity: number
  low_stock_threshold: number
  sort_order?: number
  created_at?: string
  updated_at?: string
  item_categories?: ItemCategory
}

export interface SaleItem {
  id: string
  order_id: string
  item_id: string
  name: string
  quantity: number
  unit_price: number
  total_price: number
  status?: ItemStatus
  modifier_notes?: string | null
  created_at: string
  items?: Pick<Item, 'name' | 'price'> | null
}

export interface Sale {
  id: string
  staff_id?: string | null
  order_type: SaleType
  status: SaleStatus
  total_amount: number
  notes?: string | null
  payment_method?: PaymentMethod | null
  customer_name?: string | null
  created_at: string
  closed_at?: string | null
  updated_at?: string | null
  order_items?: SaleItem[]
}

export type Order = Sale
export type OrderItem = SaleItem

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
  category?: string
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

// ─── Print queue types ──────────────────────────────────────────────────────

export type PrintJobType = 'customer' | 'internal'
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

// ─── Mall management types ──────────────────────────────────────────────────

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
  is_occupied: boolean
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

// ─── Audit helper params ──────────────────────────────────────────────────

export interface AuditParams {
  action: string
  entity: string
  entityId?: string
  entityName?: string
  oldValue?: unknown
  newValue?: unknown
  performer?: Pick<Profile, 'id' | 'full_name' | 'role'> | null
}
