export interface TableLayout {
  x: number
  y: number
  w: number
  h: number
  shape: 'rect' | 'circle'
}

export interface ZoneBounds {
  x: number
  y: number
  w: number
  h: number
}

export interface FloorPlanData {
  tables: Record<string, TableLayout>
  zones: Record<string, ZoneBounds | ZoneBounds[]>
}

export const ZONE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  'Ground Floor': { fill: 'rgba(59,130,246,0.08)', stroke: '#3b82f6', text: '#60a5fa' },
  'First Floor': { fill: 'rgba(34,197,94,0.08)', stroke: '#22c55e', text: '#4ade80' },
  'Second Floor': { fill: 'rgba(234,179,8,0.08)', stroke: '#eab308', text: '#facc15' },
}

export const ZONE_FILL_OCCUPIED: Record<string, string> = {
  'Ground Floor': '#3b82f6',
  'First Floor': '#22c55e',
  'Second Floor': '#eab308',
}

export const DEFAULT_ZONE_COLOR = {
  fill: 'rgba(107,114,128,0.08)',
  stroke: '#6b7280',
  text: '#9ca3af',
}

// Expanded canvas for 150 shops + L-shaped layout
export const CANVAS_W = 2000
export const CANVAS_H = 1400
export const GRID_SIZE = 20

export function getZoneColor(zone?: string) {
  return zone ? ZONE_COLORS[zone] || DEFAULT_ZONE_COLOR : DEFAULT_ZONE_COLOR
}

export function normalizeZoneBounds(z: ZoneBounds | ZoneBounds[]): ZoneBounds[] {
  return Array.isArray(z) ? z : [z]
}

export function getZoneBoundingBox(sections: ZoneBounds[]): ZoneBounds {
  if (sections.length === 0) return { x: 0, y: 0, w: 600, h: 500 }
  const minX = Math.min(...sections.map((s) => s.x))
  const minY = Math.min(...sections.map((s) => s.y))
  const maxX = Math.max(...sections.map((s) => s.x + s.w))
  const maxY = Math.max(...sections.map((s) => s.y + s.h))
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function parseFloorPlanData(raw: string | null | undefined): FloorPlanData {
  if (!raw) return { tables: {}, zones: {} }
  try {
    const parsed = JSON.parse(raw)
    if (parsed.tables) return parsed as FloorPlanData
    return { tables: parsed as Record<string, TableLayout>, zones: {} }
  } catch {
    return { tables: {}, zones: {} }
  }
}
