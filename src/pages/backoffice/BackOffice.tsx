import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  Users,
  UtensilsCrossed,
  LayoutGrid,
  Package,
  QrCode,
  Lock,
  ChefHat,
  Map,
  Bike,
  Building2,
} from 'lucide-react'
import { HelpTooltip } from '../../components/HelpTooltip'
import StaffManagement from './StaffManagement'
import MenuManagement from './MenuManagement'
import TableConfig from './TableConfig'
import Inventory from './Inventory'
import ChangePassword from './ChangePassword'
import KitchenStock from './KitchenStock'
import FloorPlan from './FloorPlan'
import BarChillerStock from './BarChillerStock'
import DeliveryOperators from './DeliveryOperators'
import MallManagement from './MallManagement'

import { useNavigate } from 'react-router-dom'
import type { Role } from '../../types'

interface Section {
  id: string
  label: string
  desc: string
  icon: React.ElementType
  color: string
  roles: Role[]
}

export default function BackOffice() {
  const { profile, signOut } = useAuth()
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const _ms = document.getElementById('main-scroll')
    if (_ms) _ms.scrollTop = 0
  }, [activeSection])

  const sections: Section[] = [
    {
      id: 'staff',
      label: 'Staff Management',
      desc: 'Add, edit and manage staff roles and PINs',
      icon: Users,
      color: 'bg-blue-500',
      roles: ['owner', 'manager'],
    },
    {
      id: 'menu',
      label: 'Menu Management',
      desc: 'Add and edit menu items, prices, availability',
      icon: UtensilsCrossed,
      color: 'bg-green-500',
      roles: ['owner', 'manager'],
    },
    {
      id: 'tables',
      label: 'Table Configuration',
      desc: 'Edit table names and capacity',
      icon: LayoutGrid,
      color: 'bg-amber-500',
      roles: ['owner', 'manager'],
    },
    {
      id: 'floorplan',
      label: 'Floor Plan',
      desc: 'Drag-and-drop table layout — arrange tables as they are on site',
      icon: Map,
      color: 'bg-emerald-600',
      roles: ['owner', 'manager'],
    },
    {
      id: 'inventory',
      label: 'Main Store',
      desc: 'Master stock levels, restocking, supplier logs — the big store',
      icon: Package,
      color: 'bg-blue-600',
      roles: ['owner', 'manager'],
    },
    {
      id: 'barchiller',
      label: 'Bar Chiller Stock',
      desc: 'Daily bar chiller register — what was received, sold, and remaining',
      icon: UtensilsCrossed,
      color: 'bg-cyan-600',
      roles: ['owner', 'manager', 'bar'],
    },
    {
      id: 'kitchenstock',
      label: 'Kitchen Stock Register',
      desc: 'Daily food received vs sold vs remaining — variance tracking',
      icon: ChefHat,
      color: 'bg-orange-600',
      roles: ['owner', 'manager', 'kitchen'],
    },
{
      id: 'delivery',
      label: 'Delivery Operators',
      desc: 'Manage Boda Boda riders for takeaway delivery',
      icon: Bike,
      color: 'bg-cyan-500',
      roles: ['owner', 'manager'],
    },
    {
      id: 'mall',
      label: 'Mall Management',
      desc: 'Shop floor plan, rent tracking & tenant management',
      icon: Building2,
      color: 'bg-purple-600',
      roles: ['owner', 'manager'],
    },
    {
      id: 'qrcards',
      label: 'QR Zone Cards',
      desc: 'Print one QR code per zone (pricing only)',
      icon: QrCode,
      color: 'bg-rose-500',
      roles: ['owner', 'manager'],
    },

    {
      id: 'changepassword',
      label: 'Change Password',
      desc: 'Update your account login password',
      icon: Lock,
      color: 'bg-gray-600',
      roles: ['owner', 'manager', 'kitchen', 'bar'],
    },
  ]

  void signOut // referenced to satisfy linter if profile is also unused

  if (!profile)
    return (
      <div className="min-h-full bg-gray-950 flex items-center justify-center">
        <div className="text-amber-500">Loading...</div>
      </div>
    )

  const allowed = sections.filter((s) => s.roles.includes(profile.role as Role))

  if (activeSection === 'staff') return <StaffManagement onBack={() => setActiveSection(null)} />
  if (activeSection === 'menu') return <MenuManagement onBack={() => setActiveSection(null)} />
  if (activeSection === 'tables') return <TableConfig onBack={() => setActiveSection(null)} />
  if (activeSection === 'floorplan') return <FloorPlan onBack={() => setActiveSection(null)} />
  if (activeSection === 'qrcards') {
    navigate('/backoffice/qr-cards')
    return null
  }
  if (activeSection === 'changepassword')
    return <ChangePassword onBack={() => setActiveSection(null)} />
  if (activeSection === 'kitchenstock')
    return <KitchenStock onBack={() => setActiveSection(null)} />
  if (activeSection === 'inventory') return <Inventory onBack={() => setActiveSection(null)} />
  if (activeSection === 'barchiller')
    return <BarChillerStock onBack={() => setActiveSection(null)} />

  if (activeSection === 'delivery')
    return <DeliveryOperators onBack={() => setActiveSection(null)} />
  if (activeSection === 'mall')
    return <MallManagement onBack={() => setActiveSection(null)} />

  return (
    <div className="min-h-full bg-gray-950">
      <div className="p-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-white text-2xl font-bold">Back Office</h2>
            <p className="text-gray-400 mt-1">Manage your restaurant settings</p>
          </div>
          <HelpTooltip
            storageKey="backoffice"
            tips={[
              {
                id: 'bo-staff',
                title: 'Staff Management',
                description:
                  'Add and manage staff accounts. Assign each person a role (owner, manager, supervisor, accountant, waitron, kitchen, bar, griller) and a 4-digit PIN. A staff member cannot log in until they have an active account. Email + password login is available to owner, manager, and accountant roles; all other roles use PIN only.',
              },
              {
                id: 'bo-menu',
                title: 'Menu Management',
                description:
                  'Add, edit, or disable menu items. Each item must have a category and a destination — Kitchen, Bar, or Griller. The destination controls which KDS screen the order appears on. Items can be searched by name and filtered by category.',
              },
              {
                id: 'bo-tables',
                title: 'Table Configuration',
                description:
                  'Edit table names and assign zones. The Zone Settings section below the table grid lets you set a hire fee per zone — useful for bookable spaces. The hire fee is shown as a reminder banner in the POS when that zone is selected.',
              },
              {
                id: 'bo-floorplan',
                title: 'Floor Plan',
                description:
                  'Visual table layout editor. Drag tables to position them exactly as they are on site. Click a table to select it, then resize by dragging the corner handle or toggle between square and round shapes. Filter by zone to focus on specific areas. The layout is saved and can be used as a reference for staff.',
              },
              {
                id: 'bo-inventory',
                title: 'Drink Inventory',
                description:
                  'Track stock levels for all drinks. Set a minimum threshold per item — when stock drops to or below that level, a low stock alert appears on the Executive Dashboard and the manager receives a push notification. Log manual restocks here.',
              },
              {
                id: 'bo-kitchenstock',
                title: 'Kitchen Stock Register',
                description:
                  'Daily food accountability: record what was received, auto-sync what was sold from POS, and calculate what should remain. Managers can set yield benchmarks per ingredient. Variance alarms flag waste or possible theft. Managers can edit entries; kitchen staff can only add.',
              },
              {
                id: 'bo-qr',
                title: 'QR Zone Cards',
                description:
                  'Generate and print one QR code per zone. Customers scan to check zone-based prices and rate service (thumbs up/down). Orders are placed through waitrons only.',
              },
            ]}
          />
        </div>

        {allowed.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">You do not have access to any back office sections.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            {allowed.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="bg-gray-900 border border-gray-800 hover:border-amber-500/50 rounded-2xl p-6 text-left flex items-start gap-4 transition-all group"
              >
                <div
                  className={`w-12 h-12 ${section.color} rounded-xl flex items-center justify-center shrink-0`}
                >
                  <section.icon size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold group-hover:text-amber-400 transition-colors">
                    {section.label}
                  </h3>
                  <p className="text-gray-500 text-sm mt-1">{section.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
