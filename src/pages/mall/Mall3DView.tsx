import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import * as THREE from 'three'
import { X, Edit3, Eye } from 'lucide-react'

interface MallFloor {
  id: string
  name: string
  floor_number: number
}

interface ShopFeature {
  id: string
  shop_id: string
  feature_type: 'door' | 'window'
  face: 'front' | 'back' | 'left' | 'right'
  offset_x: number
  offset_y: number
  width: number
  height: number
}

interface Shop3D {
  id: string
  shop_number: string
  shop_name: string
  floor_id: string
  pos_x: number
  pos_y: number
  width: number
  height: number
  tenant_name: string | null
  is_occupied: boolean
  shop_category: string | null
  features: ShopFeature[]
}

const FLOOR_NAMES: Record<string, string> = {
  'Ground Floor': 'Ground Floor',
  'First Floor': 'First Floor',
  'Second Floor': 'Second Floor',
}

const FLOOR_COLORS: Record<string, string> = {
  'Ground Floor': '#3b82f6',
  'First Floor': '#22c55e',
  'Second Floor': '#eab308',
}

const FLOOR_H = 0.2
const FLOOR_GAP = 2.5

function FaceFeature({ feature, shopW, shopD, shopH }: { feature: ShopFeature; shopW: number; shopD: number; shopH: number }) {
  const w = feature.width
  const h = feature.height
  const ox = feature.offset_x - 0.5
  const oy = feature.offset_y - 0.5
  const color = feature.feature_type === 'door' ? '#8B4513' : '#87CEEB'

  let pos: [number, number, number]
  let rot: [number, number, number]

  switch (feature.face) {
    case 'front':
      pos = [ox * shopW, oy * shopH, shopD / 2 + 0.01]
      rot = [0, 0, 0]
      break
    case 'back':
      pos = [ox * shopW, oy * shopH, -shopD / 2 - 0.01]
      rot = [0, Math.PI, 0]
      break
    case 'left':
      pos = [-shopW / 2 - 0.01, oy * shopH, ox * shopD]
      rot = [0, -Math.PI / 2, 0]
      break
    case 'right':
      pos = [shopW / 2 + 0.01, oy * shopH, ox * shopD]
      rot = [0, Math.PI / 2, 0]
      break
    default:
      pos = [0, 0, 0]
      rot = [0, 0, 0]
  }

  return (
    <mesh position={pos} rotation={rot as unknown as THREE.Euler}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial color={color} opacity={0.9} transparent />
    </mesh>
  )
}

function ShopBox({
  shop, position, selected, onClick, floorColor
}: {
  shop: Shop3D; position: [number, number, number]; selected: boolean
  onClick: () => void; floorColor: string
}) {
  const shopW = shop.width / 10
  const shopD = shop.height / 10
  const shopH = 1.8
  const color = selected ? '#f59e0b' : shop.is_occupied ? '#ef4444' : floorColor

  return (
    <group position={position}>
      <mesh onClick={onClick}>
        <boxGeometry args={[shopW, shopH, shopD]} />
        <meshStandardMaterial color={color} opacity={selected ? 1 : 0.8} transparent />
      </mesh>
      <Text position={[0, shopH / 2 + 0.2, 0]} fontSize={0.15} color="white" anchorX="center" anchorY="middle">
        {shop.shop_number}
      </Text>
      {shop.features.map((f) => (
        <FaceFeature key={f.id} feature={f} shopW={shopW} shopD={shopD} shopH={shopH} />
      ))}
    </group>
  )
}

function FloorLevel({
  floor, shops, yOffset, selectedId, onShopClick, floorColor
}: {
  floor: MallFloor; shops: Shop3D[]; yOffset: number
  selectedId: string | null; onShopClick: (id: string) => void; floorColor: string
}) {
  return (
    <group>
      <mesh position={[0, yOffset, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 30]} />
        <meshStandardMaterial color={floorColor} opacity={0.1} transparent />
      </mesh>
      {shops.map((shop) => {
        const x = (shop.pos_x - 15) / 5
        const z = (shop.pos_y - 10) / 5
        return (
          <ShopBox
            key={shop.id}
            shop={shop}
            position={[x, yOffset + FLOOR_H / 2 + 0.9, z]}
            selected={shop.id === selectedId}
            onClick={() => onShopClick(shop.id)}
            floorColor={floorColor}
          />
        )
      })}
    </group>
  )
}

function Scene({
  floors, shops, selectedId, onShopClick, editMode, onPlaceFeature, onRemoveFeature
}: {
  floors: MallFloor[]; shops: Shop3D[]; selectedId: string | null
  onShopClick: (id: string) => void; editMode: boolean
  onPlaceFeature: (shopId: string, face: string) => void
  onRemoveFeature: (featureId: string) => void
}) {
  const [hoveredShopId, setHoveredShopId] = useState<string | null>(null)

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <directionalLight position={[-10, 10, -10]} intensity={0.3} />
      <hemisphereLight args={['#ffffff', '#444444', 0.3]} />
      {floors.map((floor, fi) => (
        <FloorLevel
          key={floor.id}
          floor={floor}
          shops={shops.filter((s) => s.floor_id === floor.id)}
          yOffset={fi * FLOOR_GAP}
          selectedId={selectedId}
          onShopClick={onShopClick}
          floorColor={FLOOR_COLORS[floor.name] || '#6b7280'}
        />
      ))}
      <OrbitControls
        target={[0, FLOOR_GAP, 0]}
        minDistance={5}
        maxDistance={40}
        maxPolarAngle={Math.PI / 2.1}
      />
      <gridHelper args={[50, 30, '#444444', '#333333']} position={[0, -0.1, 0]} />
    </>
  )
}

const FACE_OPTIONS = ['front', 'back', 'left', 'right'] as const

export default function Mall3DView() {
  const toast = useToast()
  const [floors, setFloors] = useState<MallFloor[]>([])
  const [shops, setShops] = useState<Shop3D[]>([])
  const [features, setFeatures] = useState<ShopFeature[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [placingFace, setPlacingFace] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const [{ data: floorsData }, { data: shopsData }, { data: featuresData }] = await Promise.all([
      supabase.from('mall_floors').select('*').order('floor_number'),
      supabase.from('mall_shops').select('*').order('shop_number'),
      supabase.from('mall_shop_features').select('*'),
    ])
    setFloors(floorsData || [])
    setShops(shopsData || [])
    setFeatures(featuresData || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const selectedShop = shops.find((s) => s.id === selectedShopId) || null

  const shopsWithFeatures: Shop3D[] = shops.map((s) => ({
    ...s,
    features: features.filter((f) => f.shop_id === s.id),
  }))

  const handleShopClick = (id: string) => {
    if (editMode) {
      setSelectedShopId(id)
      setPlacingFace('front')
    } else {
      setSelectedShopId(selectedShopId === id ? null : id)
    }
  }

  const handlePlaceFeature = async (shopId: string, face: string) => {
    const { error } = await supabase.from('mall_shop_features').insert({
      shop_id: shopId,
      feature_type: 'door',
      face,
      offset_x: 0.5,
      offset_y: 0.5,
      width: 0.8,
      height: 2.0,
    })
    if (error) {
      toast.error('Error', error.message)
    } else {
      await fetchData()
      setPlacingFace(null)
    }
  }

  const handleRemoveFeature = async (featureId: string) => {
    const { error } = await supabase.from('mall_shop_features').delete().eq('id', featureId)
    if (error) {
      toast.error('Error', error.message)
    } else {
      await fetchData()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading 3D view...
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        <button
          onClick={() => setEditMode(!editMode)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
            editMode
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-gray-900/90 border border-gray-700 text-gray-300 hover:text-white'
          }`}
        >
          {editMode ? <Eye size={14} /> : <Edit3 size={14} />}
          {editMode ? 'View Mode' : 'Edit Mode'}
        </button>
        <div className="bg-gray-900/90 border border-gray-700 rounded-xl p-3 text-xs space-y-1.5">
          {floors.map((floor) => {
            const count = shops.filter((s) => s.floor_id === floor.id).length
            return (
              <div key={floor.id} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: FLOOR_COLORS[floor.name] || '#6b7280' }} />
                <span className="text-gray-300">
                  {floor.name} ({count} shop{count !== 1 ? 's' : ''})
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {editMode && selectedShop && placingFace && (
        <div className="absolute top-3 right-3 z-10 bg-gray-900/95 border border-gray-700 rounded-xl p-3 text-xs space-y-2">
          <p className="text-white font-medium">Add Door to {selectedShop.shop_number}</p>
          <div className="flex gap-1.5">
            {FACE_OPTIONS.map((face) => (
              <button
                key={face}
                onClick={() => handlePlaceFeature(selectedShop.id, face)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1.5 rounded-lg text-xs capitalize"
              >
                {face}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPlacingFace(null)}
            className="text-gray-500 hover:text-white text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      <Canvas
        camera={{ position: [15, 10, 15], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => { gl.setClearColor('#1a1a2e') }}
      >
        <Scene
          floors={floors}
          shops={shopsWithFeatures}
          selectedId={selectedShopId}
          onShopClick={handleShopClick}
          editMode={editMode}
          onPlaceFeature={handlePlaceFeature}
          onRemoveFeature={handleRemoveFeature}
        />
      </Canvas>

      {selectedShop && !editMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-gray-900/95 border border-gray-700 rounded-xl p-3 text-xs min-w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-white font-bold text-sm">{selectedShop.shop_name}</p>
              <p className="text-gray-400">{selectedShop.shop_number}</p>
            </div>
            <button onClick={() => setSelectedShopId(null)} className="text-gray-400 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <div className="flex items-center gap-3 text-gray-400">
            <span>{selectedShop.is_occupied ? `Tenant: ${selectedShop.tenant_name || 'N/A'}` : 'Vacant'}</span>
            <span>{selectedShop.shop_category || '—'}</span>
          </div>
          {selectedShop.features.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-gray-500">Features:</span>
              {selectedShop.features.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1 bg-gray-800 px-2 py-0.5 rounded-full text-gray-300">
                  <span className={`w-2 h-2 rounded-sm ${f.feature_type === 'door' ? 'bg-amber-600' : 'bg-sky-400'}`} />
                  {f.face}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
