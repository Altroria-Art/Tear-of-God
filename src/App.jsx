import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'

const STATUS_STYLES = {
  ok: 'text-emerald-600',
  connected: 'text-emerald-600',
  checking: 'text-amber-600',
  error: 'text-red-600',
}

function Row({ label, value, status }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <dt className="text-stone-500">{label}</dt>
      <dd className={STATUS_STYLES[status] ?? 'text-stone-600'}>{value}</dd>
    </div>
  )
}

function App() {
  const [supabaseStatus, setSupabaseStatus] = useState('checking')

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(() => setSupabaseStatus('connected'))
      .catch(() => setSupabaseStatus('error'))
  }, [])

  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 px-5 py-3">
          <p className="font-mono text-xs uppercase tracking-wider text-stone-400">
            Tear of God — stack status
          </p>
        </div>

        <dl className="divide-y divide-stone-100 font-mono text-sm">
          <Row label="React" value="ok" status="ok" />
          <Row label="Tailwind CSS" value="ok" status="ok" />
          <Row label="Supabase" value={supabaseStatus} status={supabaseStatus} />
        </dl>

        <div className="border-t border-stone-200 px-5 py-3">
          <p className="text-xs text-stone-400">
            Set <code className="text-stone-600">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-stone-600">VITE_SUPABASE_ANON_KEY</code> in{' '}
            <code className="text-stone-600">.env</code> to clear the Supabase check.
          </p>
        </div>
      </div>
    </main>
  )
}

export default App
