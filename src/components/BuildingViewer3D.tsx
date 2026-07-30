import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { MallFloor, MallShop, MallRentPayment } from '../types'

interface Props {
  shops: MallShop[]
  rentPayments: Record<string, MallRentPayment[]>
  floors: MallFloor[]
  activeFloor: string | null
  onShopClick: (shop: MallShop) => void
}

const SCALE = 0.008

function getRentColor(shop: MallShop, payments: MallRentPayment[]): number {
  if (!shop.is_occupied) return 0x6b7280
  if (payments.length === 0) return 0xef4444
  const totalMonthsPaid = payments.reduce((sum, p) => sum + p.months_paid, 0)
  if (totalMonthsPaid <= 0) return 0xef4444
  const now = new Date()
  const lastPayment = payments.reduce((latest, p) =>
    new Date(p.paid_at) > new Date(latest.paid_at) ? p : latest
  , payments[0])
  const lastPaidDate = new Date(lastPayment.paid_at)
  const monthsPassed = (now.getFullYear() - lastPaidDate.getFullYear()) * 12 +
    (now.getMonth() - lastPaidDate.getMonth())
  const daysIntoCurrentMonth = now.getDate() - lastPaidDate.getDate()
  const remainingMonths = totalMonthsPaid - monthsPassed - 1
  const daysUntilDue = remainingMonths * 30 + (30 - daysIntoCurrentMonth)
  if (remainingMonths >= 1) return 0x22c55e
  if (daysUntilDue >= 14) return 0xeab308
  if (daysUntilDue >= 7) return 0xf97316
  if (daysUntilDue >= 0) return 0xef4444
  return 0xef4444
}

function makeTextSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.beginPath()
  ctx.roundRect(0, 0, 256, 64, 8)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'Bold 32px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 128, 34)
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, sizeAttenuation: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(2, 0.5, 1)
  return sprite
}

export default function BuildingViewer3D({ shops, rentPayments, activeFloor, onShopClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneDataRef = useRef<{
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer
    controls: OrbitControls
    raycaster: THREE.Raycaster
    mouse: THREE.Vector2
    shopObjects: Map<string, { mesh: THREE.Mesh; sprite: THREE.Sprite }>
    animId: number
  } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111827)

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(6, 8, 6)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.1
    controls.minDistance = 2
    controls.maxDistance = 50
    controls.target.set(0, 1, 0)

    const ambientLight = new THREE.AmbientLight(0x404060, 0.5)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
    dirLight.position.set(10, 20, 10)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 1024
    dirLight.shadow.mapSize.height = 1024
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 50
    dirLight.shadow.camera.left = -15
    dirLight.shadow.camera.right = 15
    dirLight.shadow.camera.top = 15
    dirLight.shadow.camera.bottom = -15
    scene.add(dirLight)

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3)
    fillLight.position.set(-10, 5, -10)
    scene.add(fillLight)

    const floorGeo = new THREE.PlaneGeometry(20, 20)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.8,
      metalness: 0.2,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.05
    floor.receiveShadow = true
    scene.add(floor)

    const gridHelper = new THREE.GridHelper(20, 20, 0x374151, 0x374151)
    gridHelper.position.y = 0
    scene.add(gridHelper)

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const shopObjects = new Map<string, { mesh: THREE.Mesh; sprite: THREE.Sprite }>()

    function buildShops() {
      shopObjects.forEach(({ mesh, sprite }) => {
        scene.remove(mesh)
        scene.remove(sprite)
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
        sprite.material.map?.dispose()
        sprite.material.dispose()
      })
      shopObjects.clear()

      const floorShops = shops.filter(s => s.floor_id === activeFloor)

      floorShops.forEach(shop => {
        const w = Math.max(shop.width * SCALE, 0.3)
        const h = Math.max(shop.height * SCALE, 0.3)
        const depth = 2
        const geo = new THREE.BoxGeometry(w, depth, h)
        const color = getRentColor(shop, rentPayments[shop.id] || [])
        const mat = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.4,
          metalness: 0.1,
          transparent: true,
          opacity: 0.9,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.castShadow = true
        mesh.receiveShadow = true
        const cx = shop.pos_x * SCALE + w / 2
        const cz = shop.pos_y * SCALE + h / 2
        mesh.position.set(cx, depth / 2, cz)
        mesh.userData.shopId = shop.id
        scene.add(mesh)

        const sprite = makeTextSprite(shop.shop_number)
        sprite.position.set(cx, depth + 0.4, cz)
        scene.add(sprite)

        shopObjects.set(shop.id, { mesh, sprite })
      })
    }

    buildShops()

    function onClick(event: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const meshes = Array.from(shopObjects.values()).map(o => o.mesh)
      const intersects = raycaster.intersectObjects(meshes)
      if (intersects.length > 0) {
        const hit = intersects[0].object
        const shopId = hit.userData.shopId as string | undefined
        if (shopId) {
          const shop = shops.find(s => s.id === shopId)
          if (shop) onShopClick(shop)
        }
      }
    }

    renderer.domElement.addEventListener('click', onClick)

    let animId: number
    function animate() {
      controls.update()
      renderer.render(scene, camera)
      animId = requestAnimationFrame(animate)
    }
    animId = requestAnimationFrame(animate)

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w > 0 && h > 0) {
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
    })
    resizeObserver.observe(container)

    sceneDataRef.current = { scene, camera, renderer, controls, raycaster, mouse, shopObjects, animId }

    return () => {
      cancelAnimationFrame(animId)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener('click', onClick)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  useEffect(() => {
    const sd = sceneDataRef.current
    if (!sd || !containerRef.current) return

    const container = containerRef.current
    const w = container.clientWidth
    const h = container.clientHeight
    if (w > 0 && h > 0) {
      sd.camera.aspect = w / h
      sd.camera.updateProjectionMatrix()
      sd.renderer.setSize(w, h)
    }

    sd.shopObjects.forEach(({ mesh, sprite }) => {
      sd.scene.remove(mesh)
      sd.scene.remove(sprite)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
      sprite.material.map?.dispose()
      sprite.material.dispose()
    })
    sd.shopObjects.clear()

    const floorShops = shops.filter(s => s.floor_id === activeFloor)

    floorShops.forEach(shop => {
      const ww = Math.max(shop.width * SCALE, 0.3)
      const hh = Math.max(shop.height * SCALE, 0.3)
      const depth = 2
      const geo = new THREE.BoxGeometry(ww, depth, hh)
      const color = getRentColor(shop, rentPayments[shop.id] || [])
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        metalness: 0.1,
        transparent: true,
        opacity: 0.9,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      mesh.receiveShadow = true
      const cx = shop.pos_x * SCALE + ww / 2
      const cz = shop.pos_y * SCALE + hh / 2
      mesh.position.set(cx, depth / 2, cz)
      mesh.userData.shopId = shop.id
      sd.scene.add(mesh)

      const sprite = makeTextSprite(shop.shop_number)
      sprite.position.set(cx, depth + 0.4, cz)
      sd.scene.add(sprite)

      sd.shopObjects.set(shop.id, { mesh, sprite })
    })
  }, [shops, rentPayments, activeFloor])

  return <div ref={containerRef} className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden" />
}
