/* ESC/POS Command Builder
 * Generates raw byte sequences for thermal receipt printers.
 * No external dependencies required — pure buffer construction.
 *
 * Common ESC/POS commands (Epson compatible):
 *   ESC @        — Initialize printer
 *   ESC ! n      — Print mode (font, bold, double-height, double-width)
 *   ESC a n      — Alignment (0=left, 1=center, 2=right)
 *   ESC d n      — Feed n lines
 *   ESC 2        — Set default line spacing
 *   GS V m       — Cut paper (0=full, 1=partial)
 *   GS h n       — Set barcode height
 *   GS k m d k   — Print barcode
 *   GS v 0       — Print QR code
 *   LF           — Line feed (0x0A)
 */

// ─── Text mode flags (ESC ! n) ───────────────────────────────────────────
const FONT_A = 0x00
const FONT_B = 0x01
const BOLD = 0x08
const DOUBLE_HEIGHT = 0x10
const DOUBLE_WIDTH = 0x20
const UNDERLINE = 0x80

// ─── Alignment constants ────────────────────────────────────────────────────
const ALIGN_LEFT = 0x00
const ALIGN_CENTER = 0x01
const ALIGN_RIGHT = 0x02

const LINE_WIDTH = 40

export function init() {
  return Buffer.from([0x1b, 0x40])
}

export function feed(lines = 1) {
  return Buffer.from([0x1b, 0x64, lines])
}

export function feedAndCut() {
  return Buffer.from([0x1d, 0x56, 0x00])
}

export function feedAndPartialCut() {
  return Buffer.from([0x1d, 0x56, 0x01])
}

export function setLineSpacing(spacing = 30) {
  return Buffer.from([0x1b, 0x33, spacing])
}

export function setDefaultLineSpacing() {
  return Buffer.from([0x1b, 0x32])
}

export function setAlign(align) {
  const val =
    align === 'center' ? ALIGN_CENTER : align === 'right' ? ALIGN_RIGHT : ALIGN_LEFT
  return Buffer.from([0x1b, 0x61, val])
}

export function setTextMode(flags) {
  return Buffer.from([0x1b, 0x21, flags])
}

function encodeText(text) {
  // Use simple ASCII approximation for ESC/POS compatibility
  const latin1 = []
  for (const ch of text) {
    const code = ch.codePointAt(0)
    if (code <= 0xff) latin1.push(code)
    else latin1.push(0x20) // replace non-latin1 with space
  }
  return Buffer.from(latin1)
}

export function text(text) {
  return encodeText(text)
}

export function textLine(text) {
  return Buffer.concat([encodeText(text), Buffer.from([0x0a])])
}

export function boldText(text) {
  return Buffer.concat([
    setTextMode(BOLD),
    encodeText(text),
    setTextMode(FONT_A),
  ])
}

export function boldTextLine(text) {
  return Buffer.concat([
    setTextMode(BOLD),
    encodeText(text),
    setTextMode(FONT_A),
    Buffer.from([0x0a]),
  ])
}

export function doubleText(text) {
  return Buffer.concat([
    setTextMode(DOUBLE_HEIGHT | DOUBLE_WIDTH | BOLD),
    encodeText(text),
    setTextMode(FONT_A),
  ])
}

export function doubleTextLine(text) {
  return Buffer.concat([
    setTextMode(DOUBLE_HEIGHT | DOUBLE_WIDTH | BOLD),
    encodeText(text),
    setTextMode(FONT_A),
    Buffer.from([0x0a]),
  ])
}

export function divider(char = '-') {
  return textLine(char.repeat(LINE_WIDTH))
}

export function solidDivider(char = '=') {
  return textLine(char.repeat(LINE_WIDTH))
}

export function centred(text) {
  const pad = Math.max(0, Math.floor((LINE_WIDTH - text.length) / 2))
  return ' '.repeat(pad) + text
}

export function formatRow(left, right) {
  const l = left.substring(0, LINE_WIDTH - right.length - 1)
  const spaces = LINE_WIDTH - l.length - right.length
  return l + ' '.repeat(Math.max(1, spaces)) + right
}

// ─── QR Code ──────────────────────────────────────────────────────────────
export function printQRCode(data) {
  const store = Buffer.alloc(4 + data.length)
  store[0] = 0x1d
  store[1] = 0x28
  store[2] = 0x6b
  store[3] = data.length + 3
  store.write('Q', 1)

  // Set module size
  const sizeCmd = Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06])
  // Store data
  const dataLen = data.length + 3
  const storeCmd = Buffer.alloc(dataLen + 3)
  storeCmd[0] = 0x1d
  storeCmd[1] = 0x28
  storeCmd[2] = 0x6b
  storeCmd[3] = dataLen & 0xff
  storeCmd[4] = (dataLen >> 8) & 0xff
  storeCmd[5] = 0x31
  storeCmd[6] = 0x50
  storeCmd[7] = 0x30
  storeCmd.write(data, 8, 'ascii')

  // Print QR
  const printCmd = Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30])

  return Buffer.concat([sizeCmd, storeCmd, printCmd, feed(1)])
}

// ─── Barcode ──────────────────────────────────────────────────────────────
export function printBarcode(data) {
  const cmds = [
    Buffer.from([0x1d, 0x68, 0x50]), // set height to 80 dots
    Buffer.from([0x1d, 0x77, 0x02]), // set width 2
    Buffer.from([0x1d, 0x6b, 0x02]), // UPC-A barcode
    encodeText(data),
    Buffer.from([0x00]),
    feed(1),
  ]
  return Buffer.concat(cmds)
}

// ─── Build a complete receipt ─────────────────────────────────────────────
export function buildReceipt(receipt) {
  const chunks = [init(), setDefaultLineSpacing()]

  // Title
  chunks.push(setAlign('center'))
  chunks.push(doubleTextLine(receipt.title))
  if (receipt.subtitle) chunks.push(textLine(receipt.subtitle))
  chunks.push(divider())

  // Header fields
  chunks.push(setAlign('left'))
  for (const h of receipt.header) {
    chunks.push(textLine(formatRow(h.label + ':', h.value)))
  }
  chunks.push(divider())

  // Column headers
  chunks.push(boldTextLine(formatRow('ITEM', 'TOTAL')))

  // Items
  for (const item of receipt.items) {
    chunks.push(textLine(formatRow(`${item.qty}x ${item.name}`, item.total)))
  }
  chunks.push(solidDivider())

  // Totals
  for (const t of receipt.totals) {
    const line = formatRow(t.label, t.value)
    if (t.bold) {
      chunks.push(boldTextLine(line))
    } else {
      chunks.push(textLine(line))
    }
  }

  // Footer
  chunks.push(feed(1))
  chunks.push(setAlign('center'))
  for (const line of receipt.footer) {
    chunks.push(textLine(line))
  }

  // QR code if provided
  if (receipt.qrUrl) {
    chunks.push(feed(1))
    chunks.push(printQRCode(receipt.qrUrl))
  }

  // Cut
  chunks.push(feed(3))
  chunks.push(feedAndCut())

  return Buffer.concat(chunks)
}
