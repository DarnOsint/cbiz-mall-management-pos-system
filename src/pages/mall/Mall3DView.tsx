import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Html } from '@react-three/drei'
import * as THREE from 'three'

const FLOORS = ['Ground Floor', 'First Floor', 'Second Floor'] as const

interface Shop {
  id: string
  shop_number: string
  name: string
  floor: string
  status: string
  tenant_name?: string | null
  category?: string | null
}

const FLOOR_COLORS: Record<string, string> = {
  'Ground Floor': '#3b82f6',
  'First Floor': '#22c55e',
  'Second Floor': '#eab308',
}

const SHOP_W = 1.8
const SHOP_D = 1.8
const FLOOR_H = 0.2
const FLOOR_GAP = 2.2

function ShopBox({ shop, position }: { shop: Shop; position: [number, number, number] }) {
  const color = shop.status === 'occupied' ? '#ef4444' : FLOOR_COLORS[shop.floor] || '#6b7280'
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[SHOP_W * 0.85, 1.8, SHOP_D * 0.85]} />
        <meshStandardMaterial color={color} opacity={0.85} transparent />
      </mesh>
      <Text position={[0, 1.1, 0]} fontSize={0.15} color="white" anchorX="center" anchorY="middle">
        {shop.shop_number}
      </Text>
    </group>
  )
}

function FloorLevel({ floor, shops, yOffset }: { floor: string; shops: Shop[]; yOffset: number }) {
  const color = FLOOR_COLORS[floor] || '#6b7280'
  const shopPositions: { shop: Shop; pos: [number, number, number] }[] = []

  const perRow = 10
  shops.forEach((shop, i) => {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    const xBase = col * SHOP_W - (perRow * SHOP_W) / 2
    const zBase = row * SHOP_D - 2 * SHOP_D

    let x = xBase
    let z = zBase

    // L-shape: after row 1, shift back and create second arm
    if (row > 1) {
      x = col * SHOP_W - (perRow * SHOP_W) / 2 + 4
      z = row * SHOP_D - SHOP_D
    }
    // Third arm of L
    if (row > 3) {
      x = col * SHOP_W - (perRow * SHOP_W) / 2 + 8
      z = row * SHOP_D
    }

    shopPositions.push({ shop, pos: [x, yOffset + FLOOR_H / 2 + 0.9, z] })
  })

  return (
    <group>
      <mesh position={[0, yOffset, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[22, 14]} />
        <meshStandardMaterial color={color} opacity={0.15} transparent />
      </mesh>
      {shopPositions.map(({ shop, pos }) => (
        <ShopBox key={shop.id} shop={shop} position={pos} />
      ))}
    </group>
  )
}

function Scene({ shops }: { shops: Shop[] }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <directionalLight position={[-10, 10, -10]} intensity={0.3} />
      <hemisphereLight args={['#ffffff', '#444444', 0.3]} />
      {FLOORS.map((floor, fi) => (
        <FloorLevel
          key={floor}
          floor={floor}
          shops={shops.filter((s) => s.floor === floor)}
          yOffset={fi * FLOOR_GAP}
        />
      ))}
      <OrbitControls
        target={[0, FLOOR_GAP, 0]}
        minDistance={5}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.1}
      />
      <gridHelper args={[30, 20, '#444444', '#333333']} position={[0, -0.1, 0]} />
    </>
  )
}

export default function Mall3DView() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredShop, setHoveredShop] = useState<Shop | null>(null)

  useEffect(() => {
    supabase
      .from('shops')
      .select('*')
      .order('floor')
      .order('shop_number')
      .then(({ data }) => {
        if (data) setShops(data as Shop[])
        setLoading(false)
      })
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading 3D view...
      </div>
    )

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: [15, 10, 15], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#1a1a2e')
        }}
      >
        <Scene shops={shops} />
      </Canvas>
      <div className="absolute top-3 left-3 bg-gray-900/90 border border-gray-700 rounded-xl p-3 text-xs space-y-1.5">
        {FLOORS.map((floor) => (
          <div key={floor} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: FLOOR_COLORS[floor] }} />
            <span className="text-gray-300">
              {floor} ({shops.filter((s) => s.floor === floor).length} shops)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
