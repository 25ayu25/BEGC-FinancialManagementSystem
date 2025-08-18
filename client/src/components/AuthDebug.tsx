import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export function AuthDebug() {
  const [logs, setLogs] = useState<string[]>([])
  
  const addLog = (message: string) => {
    console.log(message)
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testConnection = async () => {
    try {
      addLog('Testing Supabase connection...')
      
      // Test basic connection
      const { data, error } = await supabase.from('departments').select('count').limit(1)
      if (error) {
        addLog(`Connection test failed: ${error.message}`)
      } else {
        addLog('Supabase connection successful!')
      }
      
      // Test auth
      const { data: { session }, error: authError } = await supabase.auth.getSession()
      if (authError) {
        addLog(`Auth error: ${authError.message}`)
      } else {
        addLog(`Session status: ${session ? 'Active session found' : 'No active session'}`)
      }
      
    } catch (err) {
      addLog(`Test failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const directLogin = async () => {
    try {
      addLog('Attempting direct login...')
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'ayuudlls@gmail.com',
        password: 'password123'
      })
      
      if (error) {
        addLog(`Login failed: ${error.message}`)
      } else {
        addLog('Login successful!')
      }
    } catch (err) {
      addLog(`Login error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  useEffect(() => {
    testConnection()
  }, [])

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Supabase Auth Debug</h2>
      
      <div className="space-y-2 mb-4">
        <Button onClick={testConnection} variant="outline">
          Test Connection
        </Button>
        <Button onClick={directLogin} variant="default">
          Try Direct Login
        </Button>
      </div>
      
      <div className="bg-gray-100 p-4 rounded max-h-96 overflow-y-auto">
        <h3 className="font-semibold mb-2">Debug Log:</h3>
        {logs.map((log, i) => (
          <div key={i} className="text-sm font-mono mb-1">
            {log}
          </div>
        ))}
      </div>
    </div>
  )
}