export function getCurrencySymbol(): string {
  return 'SSP'
}

export function getCurrencyCode(): string {
  return 'SSP'
}

export function formatPrice(amount: number): string {
  const formatted = Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `SSP ${formatted}`
}

export function formatSSP(amount: number): string {
  const formatted = Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `SSP ${formatted}`
}
