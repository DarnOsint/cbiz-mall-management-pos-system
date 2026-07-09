import express from 'express'
import { sendToPrinter } from './printer.js'
import { buildReceipt } from './escpos.js'

const app = express()
app.use(express.json({ limit: '1mb' }))

// CORS — allow the POS app to call this service from any origin
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (_req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

const PORT = parseInt(process.env.PRINT_SERVICE_PORT || '9101', 10)
const HOST = process.env.PRINT_SERVICE_HOST || '127.0.0.1'

// ─── Health check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

// ─── Test printer connection ──────────────────────────────────────────────
app.post('/test', async (req, res) => {
  const { ip, port } = req.body
  if (!ip) return res.status(400).json({ success: false, error: 'Missing printer IP' })

  const result = await sendToPrinter(
    ip,
    port || 9100,
    Buffer.from([0x1b, 0x40, 0x1b, 0x64, 0x03, 0x1d, 0x56, 0x00])
  )
  res.json(result)
})

// ─── Print a receipt ──────────────────────────────────────────────────────
app.post('/print', async (req, res) => {
  const { printerIp, printerPort, receipt, copies = 1, jobId } = req.body

  if (!printerIp) {
    return res.status(400).json({ success: false, error: 'Missing printerIp' })
  }
  if (!receipt) {
    return res.status(400).json({ success: false, error: 'Missing receipt data' })
  }

  try {
    const escposData = buildReceipt(receipt)
    const results = []

    for (let i = 0; i < copies; i++) {
      const result = await sendToPrinter(printerIp, printerPort || 9100, escposData)
      results.push(result)
      if (!result.success) {
        console.error(`[${jobId || 'unknown'}] Copy ${i + 1}/${copies} failed:`, result.error)
        return res.json({
          success: false,
          error: result.error,
          copy: i + 1,
          totalCopies: copies,
        })
      }
    }

    console.log(`[${jobId || 'unknown'}] Printed ${copies} copy/copies to ${printerIp}`)
    res.json({ success: true, copies })
  } catch (err) {
    console.error(`[${jobId || 'unknown'}] Print error:`, err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── Print raw ESC/POS hex data (for debugging) ──────────────────────────
app.post('/print-raw', async (req, res) => {
  const { printerIp, printerPort, hexData } = req.body

  if (!printerIp) return res.status(400).json({ success: false, error: 'Missing printerIp' })
  if (!hexData) return res.status(400).json({ success: false, error: 'Missing hexData' })

  try {
    const data = Buffer.from(hexData, 'hex')
    const result = await sendToPrinter(printerIp, printerPort || 9100, data)
    res.json(result)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── Start server ─────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log(`[cbiz-print-service] Listening on http://${HOST}:${PORT}`)
  console.log(`[cbiz-print-service] Ready to print to network thermal printers`)
})
