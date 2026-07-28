import { useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { audit } from '../../lib/audit'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { ArrowLeft, Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import Papa from 'papaparse'

interface CsvRow {
  name: string
  price: string
  cost: string
  barcode: string
  category_name: string
  stock_quantity: string
  min_stock_level: string
  tax_inclusive: string
}

interface RowResult {
  row: number
  name: string
  status: 'imported' | 'skipped' | 'error'
  message: string
}

interface Props {
  onBack: () => void
}

function generateTemplate(): string {
  const headers = ['name', 'price', 'cost', 'barcode', 'category_name', 'stock_quantity', 'min_stock_level', 'tax_inclusive']
  const sample = ['Sample Item', '10.00', '5.00', '1234567890', 'Food', '100', '10', 'yes']
  return Papa.unparse([headers, sample])
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export default function BulkImport({ onBack }: Props) {
  const toast = useToast()
  const { profile } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [parsed, setParsed] = useState<CsvRow[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<RowResult[] | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.CSV')) {
      toast.error('Invalid file', 'Please upload a CSV file')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (res) => {
          const rows = res.data as CsvRow[]
          if (rows.length === 0) {
            toast.error('Empty file', 'The CSV file has no data rows')
            return
          }
          setParsed(rows)
          setResults(null)
        },
        error: () => {
          toast.error('Parse error', 'Failed to parse the CSV file')
        },
      })
    }
    reader.readAsText(file)
  }, [toast])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.currentTarget.value = ''
  }

  const importAll = async () => {
    if (!parsed || parsed.length === 0) return
    setImporting(true)
    setResults([])
    setProgress({ current: 0, total: parsed.length })

    const resultsArr: RowResult[] = []

    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i]
      const rowNum = i + 1
      setProgress({ current: i + 1, total: parsed.length })

      try {
        if (!row.name?.trim()) {
          resultsArr.push({ row: rowNum, name: row.name || 'Unnamed', status: 'error', message: 'Name is required' })
          continue
        }

        const price = parseFloat(row.price)
        if (isNaN(price) || price < 0) {
          resultsArr.push({ row: rowNum, name: row.name, status: 'error', message: 'Invalid price' })
          continue
        }

        const cost = row.cost ? parseFloat(row.cost) : 0
        const stockQty = row.stock_quantity ? parseInt(row.stock_quantity, 10) : 0
        const minStock = row.min_stock_level ? parseInt(row.min_stock_level, 10) : 0
        const taxInclusive = row.tax_inclusive?.toLowerCase() === 'yes' || row.tax_inclusive?.toLowerCase() === 'true'

        let categoryId: string | null = null
        if (row.category_name?.trim()) {
          const catName = row.category_name.trim()
          const { data: existingCat } = await supabase
            .from('item_categories')
            .select('id')
            .eq('name', catName)
            .maybeSingle()

          if (existingCat) {
            categoryId = existingCat.id
          } else {
            const { data: newCat, error: catErr } = await supabase
              .from('item_categories')
              .insert({ name: catName })
              .select('id')
              .single()
            if (catErr || !newCat) {
              resultsArr.push({ row: rowNum, name: row.name, status: 'error', message: `Failed to create category: ${catErr?.message || 'unknown'}` })
              continue
            }
            categoryId = newCat.id
          }
        }

        const barcode = row.barcode?.trim() || ''
        let duplicate = false

        if (barcode) {
          const { data: existingBc } = await supabase
            .from('item_barcodes')
            .select('item_id')
            .eq('barcode', barcode)
            .maybeSingle()
          if (existingBc) {
            duplicate = true
          }
        }

        if (!duplicate) {
          const { data: existingItem } = await supabase
            .from('item')
            .select('id')
            .eq('name', row.name.trim())
            .maybeSingle()
          if (existingItem) {
            duplicate = true
          }
        }

        if (duplicate) {
          resultsArr.push({ row: rowNum, name: row.name, status: 'skipped', message: 'Duplicate item' })
          continue
        }

        const { data: inserted, error: itemErr } = await supabase
          .from('item')
          .insert({
            name: row.name.trim(),
            category_id: categoryId,
            price,
            cost,
            barcode: barcode || null,
            tax_inclusive: taxInclusive,
            stock_quantity: stockQty,
            min_stock_level: minStock,
            active: true,
          })
          .select('id')
          .single()

        if (itemErr || !inserted) {
          resultsArr.push({ row: rowNum, name: row.name, status: 'error', message: itemErr?.message || 'Insert failed' })
          continue
        }

        if (barcode) {
          await supabase
            .from('item_barcodes')
            .upsert({
              item_id: inserted.id,
              barcode,
              is_primary: true,
            }, { onConflict: 'barcode' })
        }

        audit({
          action: 'BULK_ITEM_IMPORTED',
          entity: 'item',
          entityId: inserted.id,
          entityName: row.name.trim(),
          newValue: { name: row.name.trim(), category_id: categoryId, price, cost, barcode },
          performer: profile as any,
        })

        resultsArr.push({ row: rowNum, name: row.name, status: 'imported', message: 'Imported successfully' })
      } catch (err) {
        resultsArr.push({ row: rowNum, name: row.name, status: 'error', message: (err as Error).message || 'Unexpected error' })
      }
    }

    setResults(resultsArr)
    setImporting(false)
  }

  const importedCount = results?.filter((r) => r.status === 'imported').length || 0
  const skippedCount = results?.filter((r) => r.status === 'skipped').length || 0
  const errorCount = results?.filter((r) => r.status === 'error').length || 0

  return (
    <div className="min-h-full bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-white font-bold">Bulk Import Items</h1>
            <p className="text-gray-400 text-xs">Import items from CSV file</p>
          </div>
        </div>
        <button
          onClick={() => downloadCsv(generateTemplate(), 'import-template.csv')}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-xl text-xs"
        >
          <Download size={14} /> Template
        </button>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        {!parsed && !importing && !results && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-amber-500 bg-amber-500/5'
                : 'border-gray-700 hover:border-gray-500 bg-gray-900'
            }`}
          >
            <Upload size={40} className="mx-auto mb-4 text-gray-500" />
            <p className="text-white font-semibold text-lg mb-1">
              Drop your CSV file here
            </p>
            <p className="text-gray-500 text-sm">or click to browse</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        )}

        {parsed && !importing && !results && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-amber-400" />
                <span className="text-white font-semibold">{parsed.length} rows parsed</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setParsed(null); setResults(null) }}
                  className="px-3 py-1.5 rounded-xl text-xs bg-gray-800 text-gray-300 hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={importAll}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-1.5 rounded-xl text-xs"
                >
                  <Upload size={14} /> Import {parsed.length} Items
                </button>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="text-left p-3">#</th>
                      <th className="text-left p-3">Name</th>
                      <th className="text-right p-3">Price</th>
                      <th className="text-left p-3">Category</th>
                      <th className="text-left p-3">Barcode</th>
                      <th className="text-right p-3">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((row, idx) => (
                      <tr key={idx} className="border-t border-gray-800 text-white">
                        <td className="p-3 text-gray-500">{idx + 1}</td>
                        <td className="p-3 font-medium">{row.name || <span className="text-gray-600">—</span>}</td>
                        <td className="p-3 text-right text-amber-400">{row.price || '0'}</td>
                        <td className="p-3">
                          <span className={`text-xs px-2 py-0.5 rounded-lg ${
                            row.category_name
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-gray-700 text-gray-500'
                          }`}>
                            {row.category_name || 'None'}
                          </span>
                        </td>
                        <td className="p-3 text-gray-400 font-mono text-xs">{row.barcode || '—'}</td>
                        <td className="p-3 text-right">{row.stock_quantity || '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {importing && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <Loader2 size={32} className="mx-auto mb-4 text-amber-400 animate-spin" />
            <p className="text-white font-semibold mb-2">Importing items...</p>
            <p className="text-gray-400 text-sm mb-4">
              {progress.current} / {progress.total}
            </p>
            <div className="max-w-md mx-auto bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-500 h-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {results && !importing && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-2">
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-green-400 text-sm font-semibold">{importedCount} imported</span>
              </div>
              {skippedCount > 0 && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2">
                  <AlertTriangle size={16} className="text-amber-400" />
                  <span className="text-amber-400 text-sm font-semibold">{skippedCount} skipped</span>
                </div>
              )}
              {errorCount > 0 && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2">
                  <XCircle size={16} className="text-red-400" />
                  <span className="text-red-400 text-sm font-semibold">{errorCount} errors</span>
                </div>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wide sticky top-0">
                      <th className="text-left p-3">#</th>
                      <th className="text-left p-3">Name</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, idx) => (
                      <tr key={idx} className="border-t border-gray-800 text-white">
                        <td className="p-3 text-gray-500">{r.row}</td>
                        <td className="p-3">{r.name}</td>
                        <td className="p-3">
                          {r.status === 'imported' && (
                            <span className="flex items-center gap-1 text-green-400 text-xs">
                              <CheckCircle size={12} /> Imported
                            </span>
                          )}
                          {r.status === 'skipped' && (
                            <span className="flex items-center gap-1 text-amber-400 text-xs">
                              <AlertTriangle size={12} /> Skipped
                            </span>
                          )}
                          {r.status === 'error' && (
                            <span className="flex items-center gap-1 text-red-400 text-xs">
                              <XCircle size={12} /> Error
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-gray-400 text-xs">{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={onBack}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm"
              >
                Done
              </button>
              <button
                onClick={() => { setParsed(null); setResults(null) }}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm"
              >
                Import Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
