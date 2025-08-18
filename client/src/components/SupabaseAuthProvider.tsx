import { ReactNode } from 'react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { Switch, Route } from 'wouter'
import Login from '@/pages/login'
import Loading from '@/components/Loading'

interface SupabaseAuthProviderProps {
  children: ReactNode
}

export function SupabaseAuthProvider({ children }: SupabaseAuthProviderProps) {
  const { isAuthenticated, isLoading } = useSupabaseAuth()

  if (isLoading) {
    return <Loading />
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="*" component={Login} />
      ) : (
        <Route path="*">{children}</Route>
      )}
    </Switch>
  )
}