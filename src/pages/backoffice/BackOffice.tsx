import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Users, Package, Lock, Store } from 'lucide-react'
import { HelpTooltip } from '../../components/HelpTooltip'
import StaffManagement from './StaffManagement'
import TableConfig from './TableConfig'
import Inventory from './Inventory'
import ChangePassword from './ChangePassword'
import { useNavigate } from 'react-router-dom'
import type { Role } from '../../types'

interface Section {
  id: string
  label: string
  desc: string
  icon: React.ComponentType<{ size?: number; className?: string }>
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
      id: 'tables',
      label: 'Shop Configuration',
      desc: 'Edit shop names, sizes, assign to floors',
      icon: Store,
      color: 'bg-amber-500',
      roles: ['owner', 'manager'],
    },
    {
      id: 'inventory',
      label: 'Inventory',
      desc: 'Stock levels, restocking, supplier management',
      icon: Package,
      color: 'bg-blue-600',
      roles: ['owner', 'manager'],
    },
    {
      id: 'changepassword',
      label: 'Change Password',
      desc: 'Update your account login password',
      icon: Lock,
      color: 'bg-gray-600',
      roles: ['owner', 'manager'],
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
  if (activeSection === 'tables') return <TableConfig onBack={() => setActiveSection(null)} />
  if (activeSection === 'changepassword')
    return <ChangePassword onBack={() => setActiveSection(null)} />
  if (activeSection === 'inventory') return <Inventory onBack={() => setActiveSection(null)} />

  return (
    <div className="min-h-full bg-gray-950">
      <div className="p-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-white text-2xl font-bold">Back Office</h2>
            <p className="text-gray-400 mt-1">Manage system settings</p>
          </div>
          <HelpTooltip
            storageKey="backoffice"
            tips={[
              {
                id: 'bo-staff',
                title: 'Staff Management',
                description:
                  'Add and manage staff accounts. Assign each person a role (owner, manager, or staff) and a 4-digit PIN. A staff member cannot log in until they have an active account.',
              },
              {
                id: 'bo-tables',
                title: 'Shop Configuration',
                description:
                  'Edit shop names, assign them to floors, and set sizes. The Zone Settings section lets you configure hire fees per floor.',
              },
              {
                id: 'bo-inventory',
                title: 'Inventory',
                description:
                  'Track stock levels for all items. Set a minimum threshold per item and manage suppliers.',
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
