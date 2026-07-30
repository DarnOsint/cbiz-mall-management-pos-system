import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Eye } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { formatPrice } from '../../lib/currency'

interface Props {
  onBack: () => void
}

interface ReceiptSettings {
  shopName: string
  address: string
  phone: string
  footerMessage: string
  terms: string
  logoUrl: string
}

const defaults: ReceiptSettings = {
  shopName: '',
  address: '',
  phone: '',
  footerMessage: 'Thank you for your patronage!',
  terms: '',
  logoUrl: '',
}

export default function ReceiptSettings({ onBack }: Props) {
  const toast = useToast()
  const [settings, setSettings] = useState<ReceiptSettings>({ ...defaults })
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('receiptSettings')
      if (saved) {
        const parsed = JSON.parse(saved)
        setSettings({ ...defaults, ...parsed })
      }
    } catch {
      // ignore
    }
  }, [])

  const save = () => {
    localStorage.setItem('receiptSettings', JSON.stringify(settings))
    toast.success('Saved', 'Receipt settings updated')
  }

  const update = <K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-full bg-gray-950">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={22} />
            </button>
            <div>
              <h2 className="text-white text-2xl font-bold">Receipt Settings</h2>
              <p className="text-gray-400 mt-1">Customize your receipt layout</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm transition-colors"
            >
              <Eye size={16} /> {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
            <button
              onClick={save}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
            >
              <Save size={16} /> Save Settings
            </button>
          </div>
        </div>

        <div className="flex gap-6 flex-col lg:flex-row">
          <div className="flex-1 space-y-4 max-w-xl">
            <div>
              <label className="text-gray-300 text-sm font-medium block mb-1.5">
                Shop / Business Name
              </label>
              <input
                type="text"
                value={settings.shopName}
                onChange={(e) => update('shopName', e.target.value)}
                placeholder="C.Biz POS"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-gray-300 text-sm font-medium block mb-1.5">
                Address
              </label>
              <textarea
                value={settings.address}
                onChange={(e) => update('address', e.target.value)}
                placeholder="123 Shop Street, City"
                rows={2}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none transition-colors resize-none"
              />
            </div>

            <div>
              <label className="text-gray-300 text-sm font-medium block mb-1.5">
                Phone / Contact
              </label>
              <input
                type="text"
                value={settings.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="+1 234 567 890"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-gray-300 text-sm font-medium block mb-1.5">
                Logo URL (optional)
              </label>
              <input
                type="url"
                value={settings.logoUrl}
                onChange={(e) => update('logoUrl', e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-gray-300 text-sm font-medium block mb-1.5">
                Footer Message
              </label>
              <textarea
                value={settings.footerMessage}
                onChange={(e) => update('footerMessage', e.target.value)}
                placeholder="Thank you for your patronage!"
                rows={2}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none transition-colors resize-none"
              />
            </div>

            <div>
              <label className="text-gray-300 text-sm font-medium block mb-1.5">
                Terms & Conditions (optional)
              </label>
              <textarea
                value={settings.terms}
                onChange={(e) => update('terms', e.target.value)}
                placeholder="No refunds after 7 days. Items must be in original condition."
                rows={3}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none transition-colors resize-none"
              />
            </div>
          </div>

          {showPreview && (
            <div className="w-full lg:w-[400px] shrink-0">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <div className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wide">
                  Receipt Preview
                </div>
                <div
                  style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: '12px',
                    width: '100%',
                    color: '#000',
                    background: '#fff',
                    padding: '16px',
                    borderRadius: '4px',
                  }}
                >
                  {settings.logoUrl && (
                    <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                      <img
                        src={settings.logoUrl}
                        alt="Logo"
                        style={{ maxWidth: '80px', maxHeight: '40px', display: 'block', margin: '0 auto' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px' }}>
                      {settings.shopName || 'Your Shop Name'}
                    </div>
                    {settings.address && (
                      <div style={{ fontSize: '10px', color: '#555', marginTop: '2px', whiteSpace: 'pre-wrap' }}>
                        {settings.address}
                      </div>
                    )}
                    {settings.phone && (
                      <div style={{ fontSize: '10px', color: '#555', marginTop: '1px' }}>
                        {settings.phone}
                      </div>
                    )}
                    <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                      ———————————————————
                    </div>
                  </div>
                  <div style={{ marginBottom: '6px' }}>
                    {[
                      ['Ref', 'BSP-XXXX'],
                      ['Date', '12 Jan 2026'],
                      ['Time', '02:30 PM'],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '2px 0' }}>
                        <span>{label}:</span>
                        <span style={{ fontWeight: 'bold' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>
                    <span>ITEM</span>
                    <span>TOTAL</span>
                  </div>
                  <div style={{ borderTop: '1px solid #000', margin: '3px 0' }} />
                  {[['1x Sample Item', 'SSP 5,000'], ['2x Another Item', 'SSP 8,000']].map(([name, price]) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '3px 0' }}>
                      <span>{name}</span>
                      <span>{price}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '2px 0' }}>
                    <span>Subtotal</span>
                    <span>SSP 13,000</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', margin: '4px 0' }}>
                    <span>TOTAL</span>
                    <span>SSP 13,000</span>
                  </div>
                  {settings.footerMessage && (
                    <>
                      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
                      <div style={{ textAlign: 'center', fontSize: '10px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                        {settings.footerMessage}
                      </div>
                    </>
                  )}
                  {settings.terms && (
                    <>
                      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
                      <div style={{ fontSize: '9px', color: '#666', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                        {settings.terms}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
