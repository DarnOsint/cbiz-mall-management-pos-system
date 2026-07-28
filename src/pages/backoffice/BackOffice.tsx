import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  Users,
  ShoppingBag,
  Package,
  Lock,
  Building2,
  Tag,
  Percent,
  RotateCcw,
  DollarSign,
  Printer,
  Upload,
  ArrowLeftRight,
  Bell,
} from 'lucide-react'
import { HelpTooltip } from '../../components/HelpTooltip'
import StaffManagement from './StaffManagement'
import MenuManagement from './MenuManagement'
import Inventory from './Inventory'
import ChangePassword from './ChangePassword'
import MallManagement from './MallManagement'
import DiscountManagement from './DiscountManagement'
import TaxManagement from './TaxManagement'
import RefundManagement from './RefundManagement'
import ExpenseManagement from './ExpenseManagement'
import ReceiptSettings from './ReceiptSettings'
import BulkImport from './BulkImport'
import StockTransfers from './StockTransfers'
import StockAlerts from './StockAlerts'
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
      label: 'Item Management',
      desc: 'Add and edit items, prices, availability',
      icon: ShoppingBag,
      color: 'bg-green-500',
      roles: ['owner', 'manager'],
    },
    {
      id: 'stock_transfers',
      label: 'Stock Transfers',
      desc: 'Transfer stock between shop locations',
      icon: ArrowLeftRight,
      color: 'bg-cyan-500',
      roles: ['owner', 'manager'],
    },
    {
      id: 'inventory',
      label: 'Inventory',
      desc: 'Stock levels, restocking, supplier logs',
      icon: Package,
      color: 'bg-blue-600',
      roles: ['owner', 'manager'],
    },
    {
      id: 'bulk-import',
      label: 'Bulk Import',
      desc: 'Import items in bulk from CSV',
      icon: Upload,
      color: 'bg-teal-500',
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
      id: 'discounts',
      label: 'Discounts',
      desc: 'Create and manage discounts and promo codes',
      icon: Tag,
      color: 'bg-amber-500',
      roles: ['owner', 'manager'],
    },
    {
      id: 'refunds',
      label: 'Refunds',
      desc: 'Approve and manage refund requests',
      icon: RotateCcw,
      color: 'bg-red-500',
      roles: ['owner', 'manager'],
    },
    {
      id: 'expenses',
      label: 'Expenses',
      desc: 'Record and manage business expenses',
      icon: DollarSign,
      color: 'bg-red-500',
      roles: ['owner', 'manager'],
    },
    {
      id: 'tax',
      label: 'Tax Rates',
      desc: 'Manage tax rates and VAT settings',
      icon: Percent,
      color: 'bg-orange-500',
      roles: ['owner', 'manager'],
    },
    {
      id: 'receipt',
      label: 'Receipt Settings',
      desc: 'Customize receipt layout, logo, footer & terms',
      icon: Printer,
      color: 'bg-indigo-500',
      roles: ['owner', 'manager'],
    },
    {
      id: 'stockalerts',
      label: 'Stock Alerts',
      desc: 'Monitor low stock and out-of-stock items',
      icon: Bell,
      color: 'bg-amber-500',
      roles: ['owner', 'manager'],
    },
    {
      id: 'changepassword',
      label: 'Change Password',
      desc: 'Update your account login password',
      icon: Lock,
      color: 'bg-gray-600',
      roles: ['owner', 'manager', 'cashier'],
    },
  ]

  void signOut

  if (!profile)
    return (
      <div className="min-h-full bg-gray-950 flex items-center justify-center">
        <div className="text-amber-500">Loading...</div>
      </div>
    )

  const allowed = sections.filter((s) => s.roles.includes(profile.role as Role))

  if (activeSection === 'staff') return <StaffManagement onBack={() => setActiveSection(null)} />
  if (activeSection === 'menu') return <MenuManagement onBack={() => setActiveSection(null)} />
  if (activeSection === 'changepassword')
    return <ChangePassword onBack={() => setActiveSection(null)} />
  if (activeSection === 'stock_transfers')
    return <StockTransfers onBack={() => setActiveSection(null)} />
  if (activeSection === 'inventory') return <Inventory onBack={() => setActiveSection(null)} />
  if (activeSection === 'mall')
    return <MallManagement onBack={() => setActiveSection(null)} />
  if (activeSection === 'discounts')
    return <DiscountManagement onBack={() => setActiveSection(null)} />
  if (activeSection === 'tax')
    return <TaxManagement onBack={() => setActiveSection(null)} />
  if (activeSection === 'refunds')
    return <RefundManagement onBack={() => setActiveSection(null)} />
  if (activeSection === 'expenses')
    return <ExpenseManagement onBack={() => setActiveSection(null)} />
  if (activeSection === 'receipt')
    return <ReceiptSettings onBack={() => setActiveSection(null)} />
  if (activeSection === 'bulk-import')
    return <BulkImport onBack={() => setActiveSection(null)} />
  if (activeSection === 'stockalerts')
    return <StockAlerts onBack={() => setActiveSection(null)} />

  return (
    <div className="min-h-full bg-gray-950">
      <div className="p-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-white text-2xl font-bold">Back Office</h2>
            <p className="text-gray-400 mt-1">Manage your store settings</p>
          </div>
          <HelpTooltip
            storageKey="backoffice"
            tips={[
              {
                id: 'bo-staff',
                title: 'Staff Management',
                description:
                  'Add and manage staff accounts. Assign each person a role (owner, manager, cashier) and a 4-digit PIN. A staff member cannot log in until they have an active account.',
              },
              {
                id: 'bo-items',
                title: 'Item Management',
                description:
                  'Add, edit, or disable items. Each item must have a category. Items can be searched by name and filtered by category.',
              },
              {
                id: 'bo-inventory',
                title: 'Inventory',
                description:
                  'Track stock levels for all items. Set a minimum threshold per item — when stock drops to or below that level, a low stock alert appears on the Executive Dashboard.',
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
