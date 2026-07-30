import { useState } from 'react'
import { Store, Map, Box, ArrowLeft } from 'lucide-react'
import ShopConfig from './ShopConfig'
import MallFloorPlan from './MallFloorPlan'
import Mall3DView from './Mall3DView'

const TABS = [
  { id: 'shops', label: 'Shops', icon: Store },
  { id: 'floorplan', label: 'Floor Plan 2D', icon: Map },
  { id: 'floorplan3d', label: 'Floor Plan 3D', icon: Box },
]

export default function MallManagement() {
  const [activeTab, setActiveTab] = useState('shops')

  return (
    <div className="min-h-full bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-3 shrink-0">
        <button onClick={() => window.history.back()} className="text-gray-400 hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-bold">Mall Management</h1>
          <p className="text-gray-400 text-xs">Manage shops, floor plans, and 3D mall views</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4 pb-2 border-b border-gray-800 shrink-0 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-gray-900 text-amber-400 border border-b-0 border-gray-800'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'shops' && <ShopConfig />}
        {activeTab === 'floorplan' && <MallFloorPlan />}
        {activeTab === 'floorplan3d' && <Mall3DView />}
      </div>
    </div>
  )
}
