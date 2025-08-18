import { Button } from "@/components/ui/button"

export function TempAuthBypass() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Bahr El Ghazal Clinic</h1>
          <p className="mt-2 text-sm text-gray-600">Financial Management System</p>
          <p className="mt-4 text-sm text-blue-600">Supabase Migration In Progress</p>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="font-semibold text-blue-800 mb-2">Status Update</h2>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>✅ Phase 1: Database migration to Supabase complete</li>
            <li>✅ Authentication system implemented</li>
            <li>⏳ Currently troubleshooting auth connection</li>
            <li>🚀 Ready for Phase 2: Receipt uploads & Netlify deployment</li>
          </ul>
        </div>
        
        <div className="space-y-4">
          <Button 
            className="w-full bg-teal-600 hover:bg-teal-700" 
            onClick={() => {
              // Force bypass auth for now while we troubleshoot
              localStorage.setItem('temp-auth-bypass', 'true')
              window.location.reload()
            }}
            data-testid="button-temp-bypass"
          >
            Continue to Dashboard (Temp Bypass)
          </Button>
          
          <div className="text-center">
            <a 
              href="/debug" 
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              View Debug Info
            </a>
          </div>
        </div>
        
        <div className="text-xs text-gray-400 text-center">
          Once Supabase is fully configured, normal login will work with ayuudlls@gmail.com
        </div>
      </div>
    </div>
  )
}