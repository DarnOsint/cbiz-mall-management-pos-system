import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { getPrintServiceUrl } from '../../../lib/printService'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Printer,
} from 'lucide-react'

const SETUP_SQL = `-- Run this in Supabase Dashboard → SQL Editor
CREATE TABLE IF NOT EXISTS print_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid REFERENCES orders(id) ON DELETE SET NULL,
  receipt_number  text NOT NULL,
  type            text NOT NULL CHECK (type IN ('customer', 'waiter', 'kitchen', 'bar')),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','printing','printed','failed','cancelled')),
  copies          int DEFAULT 1,
  printer_ip      text,
  receipt_data    jsonb DEFAULT '{}',
  error_message   text,
  retry_count     int DEFAULT 0,
  max_retries     int DEFAULT 5,
  next_retry_at   timestamptz,
  created_at      timestamptz DEFAULT now(),
  started_at      timestamptz,
  printed_at      timestamptz
);

ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "print_jobs_read_all" ON print_jobs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "print_jobs_insert_all" ON print_jobs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "print_jobs_update_own" ON print_jobs FOR UPDATE USING (auth.role() = 'authenticated');
CREATE INDEX IF NOT EXISTS idx_print_jobs_retry ON print_jobs (status, next_retry_at) WHERE status = 'failed';

INSERT INTO settings (id, value) VALUES ('printers', jsonb_build_array(
  jsonb_build_object('id','cashier','name','Cashier Printer','ip','192.168.1.50','port',9100,'copies',1,'types',jsonb_build_array('customer','waiter')),
  jsonb_build_object('id','kitchen','name','Kitchen Printer','ip','192.168.1.51','port',9100,'copies',1,'types',jsonb_build_array('kitchen')),
  jsonb_build_object('id','bar','name','Bar Printer','ip','192.168.1.52','port',9100,'copies',1,'types',jsonb_build_array('bar'))
)) ON CONFLICT (id) DO NOTHING;`

export default function PrintSetupTab() {
  const [tableExists, setTableExists] = useState<boolean | null>(null)
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [copied, setCopied] = useState(false)
  const [checkingTable, setCheckingTable] = useState(true)

  const checkTable = async () => {
    setCheckingTable(true)
    const { error } = await supabase
      .from('print_jobs')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    setTableExists(!error)
    setCheckingTable(false)
  }

  const checkService = async () => {
    setServiceStatus('checking')
    const online = await fetch(`${getPrintServiceUrl()}/health`, {
      signal: AbortSignal.timeout(2000),
    })
      .then((r) => r.ok)
      .catch(() => false)
    setServiceStatus(online ? 'online' : 'offline')
  }

  useEffect(() => {
    checkTable()
    checkService()
  }, [])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(SETUP_SQL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadBat = () => {
    const content = `@echo off
cd /d "%~dp0"
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed. Download from https://nodejs.org
    pause
    exit /b 1
)
if not exist "node_modules" call npm install
echo Starting Celebiz POS + Print Service...
start http://localhost:5173
npm start`
    const blob = new Blob([content], { type: 'application/bat' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'start-celebiz.bat'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Printer size={24} className="text-amber-500" />
        <h2 className="text-xl font-bold text-white">Print System Setup</h2>
      </div>

      {/* Step 1: Database table */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold flex items-center gap-2">
            Step 1 — Database Table
            {checkingTable ? (
              <RefreshCw size="14" className="text-gray-500 animate-spin" />
            ) : tableExists === true ? (
              <CheckCircle2 size="18" className="text-green-400" />
            ) : tableExists === false ? (
              <XCircle size="18" className="text-red-400" />
            ) : null}
          </h3>
          <button
            onClick={() => {
              checkTable()
              checkService()
            }}
            className="text-gray-500 hover:text-white p-1"
          >
            <RefreshCw size="14" />
          </button>
        </div>

        {tableExists === true && (
          <p className="text-green-400 text-sm">print_jobs table exists. Database is ready.</p>
        )}

        {tableExists === false && (
          <div className="space-y-3">
            <p className="text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size="14" />
              print_jobs table is missing. Run this SQL in your Supabase Dashboard:
            </p>
            <pre className="bg-gray-950 text-gray-300 text-xs p-4 rounded-xl overflow-x-auto max-h-64 border border-gray-800">
              {SETUP_SQL}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-4 py-2 rounded-xl transition-colors"
              >
                <Copy size="14" /> {copied ? 'Copied!' : 'Copy SQL'}
              </button>
              <a
                href="https://supabase.com/dashboard/project/_/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium px-4 py-2 rounded-xl transition-colors"
              >
                <ExternalLink size="14" /> Open Supabase SQL Editor
              </a>
            </div>
          </div>
        )}

        {tableExists === null && !checkingTable && (
          <p className="text-gray-400 text-sm">
            Could not check table status. Check your connection.
          </p>
        )}
      </div>

      {/* Step 2: Print service */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold flex items-center gap-2">
            Step 2 — Print Service (local)
            {serviceStatus === 'checking' ? (
              <RefreshCw size="14" className="text-gray-500 animate-spin" />
            ) : serviceStatus === 'online' ? (
              <CheckCircle2 size="18" className="text-green-400" />
            ) : (
              <XCircle size="18" className="text-red-400" />
            )}
          </h3>
        </div>

        {serviceStatus === 'online' && (
          <p className="text-green-400 text-sm">
            Print service is running on {getPrintServiceUrl()}
          </p>
        )}

        {serviceStatus === 'offline' && (
          <div className="space-y-3">
            <p className="text-amber-400 text-sm flex items-center gap-2">
              <AlertCircle size="14" />
              Print service is not running. On your POS machine:
            </p>
            <ol className="text-gray-300 text-sm space-y-2 list-decimal list-inside">
              <li>
                Install Node.js from{' '}
                <a
                  href="https://nodejs.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-500 underline"
                >
                  nodejs.org
                </a>
              </li>
              <li>Open a terminal in this project folder</li>
              <li>
                Run{' '}
                <code className="bg-gray-800 text-amber-400 px-2 py-0.5 rounded text-xs">
                  npm install
                </code>{' '}
                (one time)
              </li>
              <li>
                Run{' '}
                <code className="bg-gray-800 text-amber-400 px-2 py-0.5 rounded text-xs">
                  npm start
                </code>
              </li>
            </ol>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadBat}
                className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium px-4 py-2 rounded-xl transition-colors"
              >
                <Download size="14" /> Download start-celebiz.bat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <h3 className="text-white font-bold mb-3">Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Database table</span>
            {tableExists === true ? (
              <span className="text-green-400">Ready</span>
            ) : tableExists === false ? (
              <span className="text-red-400">Missing</span>
            ) : (
              <span className="text-gray-500">Checking...</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Print service</span>
            {serviceStatus === 'online' ? (
              <span className="text-green-400">Running</span>
            ) : serviceStatus === 'offline' ? (
              <span className="text-red-400">Offline</span>
            ) : (
              <span className="text-gray-500">Checking...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
