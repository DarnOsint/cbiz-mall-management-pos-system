export type Role =
  | 'owner'
  | 'manager'
  | 'staff'
  | 'accountant'
  | 'waitron'
  | 'bar'
  | 'kitchen'
  | 'griller'
  | 'games_master'
  | 'auditor'
  | 'cashier'

export type OrderStatus = 'open' | 'paid' | 'voided' | 'pending'
export type OrderType = 'direct' | 'cash_sale' | 'table' | 'takeaway' | 'return'
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
export type ItemDestination = 'kitchen' | 'bar' | 'griller' | 'games'

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
  hire_fee?: number | null
}

export interface Table {
  id: string
  name: string
  status: TableStatus
  category_id: string
  assigned_staff?: string | null
  capacity?: number
}

export interface MenuItem {
  id: string
  name: string
  description?: string | null
  sku?: string | null
  price: number
  image_url?: string | null
  is_available?: boolean
  category_id?: string | null
  menu_categories?: { name?: string; destination?: string } | null
}

export interface SaleItem {
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

export interface Sale {
  id: string
  staff_id?: string | null
  table_id?: string | null
  order_type: OrderType
  status: OrderStatus
  total_amount: number
  notes?: string | null
  payment_method?: PaymentMethod | string | null
  customer_name?: string | null
  created_at: string
  closed_at?: string | null
  updated_at?: string | null
  order_items?: OrderItem[]
  tables?: { name: string; assigned_staff?: string | null } | null
  profiles?: { full_name: string } | null
}

export type Order = Sale
export type OrderItem = SaleItem

export interface TillSession {
  id: string
  opened_at: string
  closed_at: string | null
  opened_by: string
  closed_by: string | null
  status: 'open' | 'closed'
  opening_cash: number
  closing_cash: number | null
  expected_cash: number | null
  cash_variance: number | null
  card_total: number
  mobile_total: number
  credit_total: number
  total_sales: number
  total_refunds: number
  total_expenses: number
  notes: string | null
}

export interface CashMovement {
  id: string
  shift_id: string
  type: 'sale' | 'refund' | 'expense' | 'payout' | 'cash_in' | 'cash_out'
  amount: number
  description: string | null
  reference_id: string | null
  performed_by: string
  performed_by_name: string
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

// ─── Customer types ─────────────────────────────────────────────────────────

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  loyalty_points: number
  total_spent: number
  visit_count: number
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CustomerPurchase {
  id: string
  customer_id: string
  order_id: string | null
  amount_spent: number
  points_earned: number
  points_redeemed: number
  created_at: string
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
  lease_start_date: string | null
  lease_end_date: string | null
  deposit_amount: number
  shop_category: string | null
  email: string | null
  notes: string | null
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
  recorded_by: string | null
  recorded_by_name: string | null
  created_at: string
}

export interface MallMaintenanceRequest {
  id: string
  shop_id: string
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  requested_by: string | null
  requested_by_name: string | null
  assigned_to: string | null
  assigned_to_name: string | null
  resolution_notes: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface MallRentInvoice {
  id: string
  shop_id: string
  invoice_number: string
  period_start: string
  period_end: string
  rent_amount: number
  late_fee: number
  total_amount: number
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  paid_at: string | null
  paid_by: string | null
  paid_by_name: string | null
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

export type DiscountType = 'percentage' | 'fixed'
export type DiscountAppliesTo = 'all' | 'item' | 'category'

export interface Discount {
  id: string
  name: string
  code: string | null
  type: DiscountType
  value: number
  min_order_amount: number | null
  max_discount_amount: number | null
  applies_to: DiscountAppliesTo
  item_id: string | null
  category_id: string | null
  starts_at: string | null
  expires_at: string | null
  usage_limit: number | null
  usage_count: number
  is_active: boolean
  created_at: string
}

export interface OrderDiscount {
  id: string
  order_id: string
  discount_id: string
  discount_name: string
  discount_type: DiscountType
  discount_value: number
  applied_amount: number
  created_at?: string
}

export type RefundMethod = 'cash' | 'card' | 'transfer' | 'mobile'
export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'completed'

export interface Refund {
  id: string
  order_id: string
  order_item_id: string
  customer_id?: string | null
  item_name: string
  quantity: number
  unit_price: number
  refund_amount: number
  refund_method: RefundMethod
  reason: string
  status: RefundStatus
  processed_by?: string | null
  processed_by_name?: string | null
  created_at: string
  processed_at?: string | null
}
