import net from 'node:net'

/**
 * Send raw ESC/POS data to a network thermal printer via TCP.
 *
 * @param {string} ip    - Printer IP address
 * @param {number} port  - Printer port (default 9100 for most Epson/Samsung/Xprinter)
 * @param {Buffer} data  - Raw ESC/POS byte buffer
 * @param {number} timeoutMs - Connection timeout in ms
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export function sendToPrinter(ip, port, data, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let resolved = false

    const done = (result) => {
      if (resolved) return
      resolved = true
      socket.destroy()
      resolve(result)
    }

    socket.setTimeout(timeoutMs)

    socket.on('connect', () => {
      socket.write(data, (err) => {
        if (err) {
          done({ success: false, error: `Write failed: ${err.message}` })
          return
        }
        // Give the printer a moment to acknowledge
        socket.end()
        done({ success: true })
      })
    })

    socket.on('error', (err) => {
      done({ success: false, error: `Connection error: ${err.message}` })
    })

    socket.on('timeout', () => {
      done({ success: false, error: `Connection timed out after ${timeoutMs}ms` })
    })

    socket.connect(port, ip)
  })
}
