import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { reprintJob, isPrintServiceAvailable } from '../../../lib/printService'
import { useAuth } from '../../../context/AuthContext'
import { Printer, RefreshCw, CheckCircle2, AlertCircle, Search, X } from 'lucide-react'
import { useToast } from '../../../context/ToastContext'
import type { PrintJob } from '../../../types'

export default function PrintQueueTab() {
  const { profile } = useAuth()
  const toast = useToast()
  const [jobs, setJobs] = useState<PrintJob[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'failed' | 'pending' | 'printed'>('all')
  const [search, setSearch] = useState('')
  const [retrying, setRetrying] = useState<string | null>(null)
  const [printServiceOnline, setPrintServiceOnline] = useState(false)

  const fetchJobs = async () => {
    setLoading(true)
    let query = supabase
      .from('print_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query
    setJobs((data || []) as PrintJob[])
    setLoading(false)
  }

  useEffect(() => {
    isPrintServiceAvailable().then(setPrintServiceOnline)
    fetchJobs()
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [filter])

  const handleReprint = async (job: PrintJob) => {
    setRetrying(job.id)
    const result = await reprintJob(job.id)
    setRetrying(null)

    if (result.success) {
      toast.success('Reprinted', `${job.receipt_number} — ${job.type} copy sent to printer`)
      fetchJobs()
    } else {
      toast.error('Reprint Failed', result.error || 'Could not reach print service')
    }
  }

  const handleCancel = async (jobId: string) => {
    await supabase.from('print_jobs').update({ status: 'cancelled' }).eq('id', jobId)
    fetchJobs()
  }

  const handleRetryAll = async () => {
    const failed = jobs.filter((j) => j.status === 'failed')
    let successCount = 0

    for (const job of failed) {
      const result = await reprintJob(job.id)
      if (result.success) successCount++
    }

    toast.success('Retry Complete', `${successCount}/${failed.length} failed jobs reprinted`)
    fetchJobs()
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'printed':
        return (
          <span className="flex items-center gap-1 text-green-400 text-xs">
            <CheckCircle2 size={12} /> Printed
          </span>
        )
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-red-400 text-xs">
            <AlertCircle size={12} /> Failed
          </span>
        )
      case 'pending':
        return (
          <span className="flex items-center gap-1 text-amber-400 text-xs">
            <RefreshCw size={12} /> Pending
          </span>
        )
      case 'printing':
        return (
          <span className="flex items-center gap-1 text-blue-400 text-xs">
            <RefreshCw size={12} className="animate-spin" /> Printing
          </span>
        )
      case 'cancelled':
        return (
          <span className="flex items-center gap-1 text-gray-500 text-xs">
            <X size={12} /> Cancelled
          </span>
        )
      default:
        return <span className="text-gray-500 text-xs">{status}</span>
    }
  }

  const filtered = jobs.filter(
    (j) =>
      !search ||
      j.receipt_number.toLowerCase().includes(search.toLowerCase()) ||
      j.type.toLowerCase().includes(search.toLowerCase())
  )

  const failedCount = jobs.filter((j) => j.status === 'failed').length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-bold text-lg">Print Queue</h2>
          <p className="text-gray-400 text-sm">
            {jobs.length} jobs · {failedCount} failed
            {printServiceOnline ? (
              <span className="text-green-400 ml-2">· Print service online</span>
            ) : (
              <span className="text-red-400 ml-2">· Print service offline</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {failedCount > 0 && (
            <button
              onClick={handleRetryAll}
              className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-3 py-2 rounded-xl transition-colors"
            >
              <RefreshCw size={13} /> Retry All ({failedCount})
            </button>
          )}
          <button
            onClick={fetchJobs}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 p-2 rounded-xl transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(['all', 'failed', 'pending', 'printed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-amber-500 text-black'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div className="flex items-center gap-2 flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 ml-auto max-w-xs focus-within:border-amber-500 transition-colors">
          <Search size={14} className="text-gray-500 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ref or type..."
            className="flex-1 bg-transparent text-white text-xs placeholder-gray-500 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-500 hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Job list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Printer size={32} className="mx-auto mb-3 text-gray-600" />
          <p>No print jobs found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((job) => (
            <div
              key={job.id}
              className={`bg-gray-900 border rounded-xl p-4 flex items-center justify-between gap-4 ${
                job.status === 'failed'
                  ? 'border-red-500/20'
                  : job.status === 'printed'
                    ? 'border-green-500/10'
                    : job.status === 'cancelled'
                      ? 'border-gray-800'
                      : 'border-gray-800'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-bold text-sm">{job.receipt_number}</span>
                  <span className="text-gray-500 text-xs uppercase">· {job.type}</span>
                  {job.printer_ip && (
                    <span className="text-gray-600 text-xs">· {job.printer_ip}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(job.status)}
                  <span className="text-gray-600 text-xs">
                    {new Date(job.created_at).toLocaleString('en-NG', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {job.retry_count > 0 && (
                    <span className="text-gray-600 text-xs">
                      Retries: {job.retry_count}/{job.max_retries}
                    </span>
                  )}
                  {job.error_message && (
                    <span
                      className="text-gray-500 text-xs truncate max-w-[200px]"
                      title={job.error_message}
                    >
                      Error: {job.error_message}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(job.status === 'failed' || job.status === 'printed') && (
                  <button
                    onClick={() => handleReprint(job)}
                    disabled={retrying === job.id}
                    className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Printer size={12} />
                    {retrying === job.id ? '...' : 'Reprint'}
                  </button>
                )}
                {job.status === 'failed' && (
                  <button
                    onClick={() => handleCancel(job.id)}
                    className="text-gray-500 hover:text-white p-1.5"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
