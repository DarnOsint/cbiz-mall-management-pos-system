import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import {
  Search,
  Plus,
  ChevronRight,
  Users,
  X,
  UserCheck,
  UserX,
  Edit2,
} from 'lucide-react'
import type { Customer } from '../../types'

export default function CustomerList() {
  const toast = useToast()
  const navigate = useNavigate()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Error', 'Failed to load customers')
      console.error(error)
    } else {
      setCustomers(data || [])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const filtered = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  )

  const toggleActive = async (customer: Customer) => {
    const { error } = await supabase
      .from('customers')
      .update({ is_active: !customer.is_active })
      .eq('id', customer.id)

    if (error) {
      toast.error('Error', 'Failed to update customer status')
    } else {
      setCustomers((prev) =>
        prev.map((c) => (c.id === customer.id ? { ...c, is_active: !c.is_active } : c))
      )
      toast.success('Updated', `Customer ${customer.is_active ? 'deactivated' : 'activated'}`)
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">Customers</h1>
          <p className="text-gray-400 text-sm">{customers.length} total customers</p>
        </div>
        <button
          onClick={() => {
            setEditingCustomer(null)
            setShowAddModal(true)
          }}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          <Plus size={16} />
          Add Customer
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-amber-500 text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 text-sm mt-3">Loading customers...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={40} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              {search ? 'No customers match your search' : 'No customers yet. Add your first customer.'}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider px-5 py-3">Name</th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider px-5 py-3">Phone</th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider px-5 py-3">Points</th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider px-5 py-3">Total Spent</th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider px-5 py-3">Visits</th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((customer) => (
                    <tr
                      key={customer.id}
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      className="border-b border-gray-800/50 hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <p className="text-white font-medium text-sm">{customer.name}</p>
                        {customer.email && (
                          <p className="text-gray-500 text-xs">{customer.email}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-300 text-sm">{customer.phone || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-amber-400 font-bold text-sm">{customer.loyalty_points || 0}</span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-300 text-sm">
                        SSP {(customer.total_spent || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-gray-300 text-sm">{customer.visit_count || 0}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${
                            customer.is_active
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          {customer.is_active ? <UserCheck size={11} /> : <UserX size={11} />}
                          {customer.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setEditingCustomer(customer)
                              setShowAddModal(true)
                            }}
                            className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => toggleActive(customer)}
                            className={`p-2 rounded-lg transition-colors ${
                              customer.is_active
                                ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'
                                : 'text-gray-500 hover:text-green-400 hover:bg-green-500/10'
                            }`}
                            title={customer.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {customer.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                          <button
                            onClick={() => navigate(`/customers/${customer.id}`)}
                            className="p-2 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                            title="View profile"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-gray-800/50">
              {filtered.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  className="p-4 hover:bg-gray-800/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium text-sm truncate">{customer.name}</p>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            customer.is_active
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {customer.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {customer.phone && (
                        <p className="text-gray-400 text-xs mt-1">{customer.phone}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-gray-600 flex-shrink-0 mt-1" />
                  </div>
                  <div className="flex gap-4 mt-2">
                    <div>
                      <p className="text-gray-500 text-[10px] uppercase">Points</p>
                      <p className="text-amber-400 text-sm font-bold">{customer.loyalty_points || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-[10px] uppercase">Spent</p>
                      <p className="text-gray-300 text-sm">
                        SSP {(customer.total_spent || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-[10px] uppercase">Visits</p>
                      <p className="text-gray-300 text-sm">{customer.visit_count || 0}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showAddModal && (
        <CustomerModal
          customer={editingCustomer}
          onClose={() => {
            setShowAddModal(false)
            setEditingCustomer(null)
          }}
          onSave={() => {
            setShowAddModal(false)
            setEditingCustomer(null)
            fetchCustomers()
          }}
        />
      )}
    </div>
  )
}

function CustomerModal({
  customer,
  onClose,
  onSave,
}: {
  customer: Customer | null
  onClose: () => void
  onSave: () => void
}) {
  const toast = useToast()

  const [name, setName] = useState(customer?.name || '')
  const [phone, setPhone] = useState(customer?.phone || '')
  const [email, setEmail] = useState(customer?.email || '')
  const [address, setAddress] = useState(customer?.address || '')
  const [notes, setNotes] = useState(customer?.notes || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      toast.warning('Required', 'Customer name is required')
      return
    }

    setSaving(true)
    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    }

    if (customer) {
      const { error } = await supabase.from('customers').update(payload).eq('id', customer.id)
      if (error) {
        toast.error('Error', 'Failed to update customer')
        console.error(error)
      } else {
        toast.success('Updated', 'Customer updated successfully')
        onSave()
      }
    } else {
      const { error } = await supabase.from('customers').insert({
        ...payload,
        loyalty_points: 0,
        total_spent: 0,
        visit_count: 0,
        is_active: true,
      })
      if (error) {
        toast.error('Error', 'Failed to create customer')
        console.error(error)
      } else {
        toast.success('Created', 'Customer added successfully')
        onSave()
      }
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h3 className="text-white font-bold text-lg">
            {customer ? 'Edit Customer' : 'Add Customer'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
              Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
              Phone
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xxxxxxxxx"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
              Address
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wide mb-2 block">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this customer..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 text-sm resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl py-3 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-800 disabled:text-gray-600 text-black font-bold rounded-xl py-3 text-sm transition-colors"
            >
              {saving ? 'Saving...' : customer ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
