import { formatPrice, formatSSP } from '../lib/currency'

interface Props {
  amount: number
  className?: string
  sspClassName?: string
  showSSP?: boolean
}

export default function PriceDisplay({
  amount,
  className = '',
  sspClassName = '',
  showSSP = true,
}: Props) {
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className={className}>{formatPrice(amount)}</span>
      {showSSP && (
        <span className={`text-[10px] text-gray-500 ${sspClassName}`}>{formatSSP(amount)}</span>
      )}
    </span>
  )
}
