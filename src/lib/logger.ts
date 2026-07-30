type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLevel: LogLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'info'

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel]
}

function sendToRemote(level: LogLevel, message: string, data?: unknown) {
  if (level !== 'error' && level !== 'warn') return
  try {
    const payload = {
      level,
      message,
      data: data ? JSON.stringify(data).slice(0, 2000) : undefined,
      url: location.href,
      userAgent: navigator.userAgent.slice(0, 200),
      timestamp: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    navigator.sendBeacon('/api/log', blob)
  } catch {
    // silently fail — logging should never break the app
  }
}

export const logger = {
  debug(message: string, data?: unknown) {
    if (!shouldLog('debug')) return
    console.debug(`[C.Biz POS] ${message}`, data)
  },

  info(message: string, data?: unknown) {
    if (!shouldLog('info')) return
    console.info(`[C.Biz POS] ${message}`, data)
  },

  warn(message: string, data?: unknown) {
    if (!shouldLog('warn')) return
    console.warn(`[C.Biz POS] ${message}`, data)
    sendToRemote('warn', message, data)
  },

  error(message: string, data?: unknown) {
    if (!shouldLog('error')) return
    console.error(`[C.Biz POS] ${message}`, data)
    sendToRemote('error', message, data)
  },
}
