type SaleItemWithReturns = {
  id?: string
  quantity?: number
  total_price?: number
  extra_charge?: number
  status?: string
  destination?: string
  modifier_notes?: string
  item?: {
    name?: string
    item_categories?: {
      name?: string
    } | null
  } | null
  return_requested?: boolean
  return_accepted?: boolean
}

type SaleLike = {
  order_items?: Array<SaleItemWithReturns | undefined> | undefined
}

export function getValidSaleItems(order: SaleLike) {
  return (order.order_items || []).filter((item) => {
    const orderItem = item as SaleItemWithReturns | undefined
    if (!orderItem) return false
    return (
      !orderItem.return_requested &&
      !orderItem.return_accepted &&
      (orderItem.status || '').toLowerCase() !== 'cancelled'
    )
  })
}

export function getNetSaleAmount(order: SaleLike) {
  return getValidSaleItems(order).reduce(
    (sum, item) => sum + (item.total_price || 0) + (item.extra_charge || 0),
    0
  )
}

export function getValidSaleItemCount(order: SaleLike) {
  return getValidSaleItems(order).reduce((sum, item) => sum + (item.quantity || 0), 0)
}

export const getValidOrderItems = getValidSaleItems
export const getNetOrderAmount = getNetSaleAmount
export const getValidOrderItemCount = getValidSaleItemCount
type OrderItemWithReturns = SaleItemWithReturns
type OrderLike = SaleLike
