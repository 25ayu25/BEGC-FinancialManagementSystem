import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

export function RefreshButton() {
  const queryClient = useQueryClient()

  const handleRefresh = () => {
    // Invalidate all Supabase queries to force refetch
    queryClient.invalidateQueries({ queryKey: ['supabase-dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['supabase-transactions'] })
    queryClient.invalidateQueries({ queryKey: ['supabase-departments'] })
    queryClient.invalidateQueries({ queryKey: ['supabase-income-trends'] })
  }

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleRefresh}
      className="flex items-center gap-2"
      data-testid="button-refresh-data"
    >
      <RefreshCw className="w-4 h-4" />
      Refresh Data
    </Button>
  )
}