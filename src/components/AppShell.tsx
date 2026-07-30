import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { requestPushPermission } from '../hooks/usePushNotifications'
import {
  LayoutDashboard,
  ShoppingBag,
  TrendingUp,
  Package,
  Settings,
  LogOut,
  Store,
  BellOff,
  Bell,
  CalendarDays,
  Users,
  Menu,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  label: string
  icon: LucideIcon
  path: string
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  owner: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/executive' },
    { label: 'Reports', icon: TrendingUp, path: '/reports' },
    { label: 'Back Office', icon: Settings, path: '/backoffice' },
    { label: 'Mall', icon: Store, path: '/mallmanagement' },
    { label: 'Month End', icon: CalendarDays, path: '/month-end' },
  ],
  manager: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/management' },
    { label: 'POS', icon: ShoppingBag, path: '/pos' },
    { label: 'Reports', icon: TrendingUp, path: '/reports' },
    { label: 'Inventory', icon: Package, path: '/backoffice' },
    { label: 'Mall', icon: Store, path: '/mallmanagement' },
    { label: 'Month End', icon: CalendarDays, path: '/month-end' },
  ],
  staff: [{ label: 'POS', icon: ShoppingBag, path: '/pos' }],
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem
  active: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left
        ${active ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
    >
      <Icon size={16} className="flex-shrink-0" />
      <span>{item.label}</span>
    </button>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const role = profile?.role || ''
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )

  const handleEnableNotifications = async () => {
    if (!profile?.id) return
    const granted = await requestPushPermission(profile.id)
    setNotifPermission(granted ? 'granted' : 'denied')
  }

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  if (!profile) return <>{children}</>

  const navItems = NAV_ITEMS[role] || []

  if (navItems.length === 0)
    return (
      <div className="flex flex-col min-h-screen bg-gray-950">
        <div className="flex-1">{children}</div>
      </div>
    )

  return (
    <div className="app-shell-root flex flex-col h-screen bg-gray-950 overflow-hidden">
      <div className="app-shell-body flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="app-shell-sidebar hidden lg:flex flex-col w-56 xl:w-64 bg-gray-900 border-r border-gray-800 flex-shrink-0">
          <div className="px-4 py-4 border-b border-gray-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <Store size={16} className="text-black" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate">C.Biz</p>
              <p className="text-gray-400 text-xs">POS & Mall</p>
            </div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavButton
                key={item.path}
                item={item}
                active={location.pathname === item.path}
                onClick={() => navigate(item.path)}
              />
            ))}
          </nav>
          <div className="px-3 py-3 border-t border-gray-800 space-y-2">
            {notifPermission !== 'granted' && (
              <button
                onClick={handleEnableNotifications}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors text-xs"
              >
                <BellOff size={13} />
                <span>Enable notifications</span>
              </button>
            )}
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                <Users size={14} className="text-gray-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{profile.full_name}</p>
                <p className="text-amber-500 text-xs capitalize">{profile.role}</p>
              </div>
              <div className="flex items-center gap-1">
                <StockAlertBell />
                {notifPermission === 'granted' && (
                  <Bell size={12} className="text-green-400" aria-label="Notifications enabled" />
                )}
                <button onClick={signOut} className="text-gray-500 hover:text-white p-1">
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Tablet icon sidebar */}
        <aside className="app-shell-sidebar hidden md:flex lg:hidden flex-col w-16 bg-gray-900 border-r border-gray-800 flex-shrink-0 items-center py-4 gap-2">
          <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center mb-2">
            <Store size={16} className="text-black" />
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={item.label}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${active ? 'bg-amber-500/10 text-amber-400' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
              >
                <Icon size={18} />
              </button>
            )
          })}
          <div className="flex-1" />
          <button
            onClick={signOut}
            title="Sign out"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-800"
          >
            <LogOut size={16} />
          </button>
        </aside>

        {/* Main content */}
        <main id="main-scroll" className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="app-shell-topbar md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
                <Store size={13} className="text-black" />
              </div>
              <span className="text-white font-bold text-sm">C.Biz POS</span>
            </div>
            <div className="flex items-center gap-2">
              <StockAlertBell />
              {navItems.length > 1 && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <Menu size={18} />
                </button>
              )}
            </div>
          </div>
          <div className="app-shell-main h-full">{children}</div>
        </main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="relative bg-gray-900 rounded-t-2xl border-t border-gray-800 max-h-[85vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-700" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-800 flex-shrink-0">
              <div>
                <p className="text-white font-semibold">{profile.full_name}</p>
                <p className="text-amber-500 text-xs capitalize">{profile.role}</p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-400"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <nav className="px-3 py-3 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const active = location.pathname === item.path
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium transition-colors text-left ${active ? 'bg-amber-500/10 text-amber-400' : 'text-gray-300 active:bg-gray-800'}`}
                    >
                      <Icon size={20} className="flex-shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
            <div className="px-3 pb-6 space-y-2 flex-shrink-0 border-t border-gray-800 pt-3">
              {notifPermission !== 'granted' && (
                <button
                  onClick={async () => {
                    setDrawerOpen(false)
                    await handleEnableNotifications()
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 active:bg-amber-500/20"
                >
                  <BellOff size={20} className="flex-shrink-0" />
                  <span className="font-medium">Enable notifications</span>
                </button>
              )}
              {notifPermission === 'granted' && (
                <div className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-green-500/10 border border-green-500/20">
                  <Bell size={20} className="text-green-400 flex-shrink-0" />
                  <span className="text-green-400 font-medium text-sm">Notifications enabled</span>
                </div>
              )}
              <button
                onClick={signOut}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-red-400 active:bg-red-950/30"
              >
                <LogOut size={20} />
                <span className="font-medium">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
