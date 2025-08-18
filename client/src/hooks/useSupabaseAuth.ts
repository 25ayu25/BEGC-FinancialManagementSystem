import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Simple profile type
type Profile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  username: string | null
  role: string | null
  location: string | null
  created_at: string
  updated_at: string
}

interface AuthState {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useSupabaseAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false
  })

  // Temp bypass check
  const tempBypass = localStorage.getItem('temp-auth-bypass') === 'true'
  if (tempBypass) {
    return {
      user: { id: 'temp-user', email: 'ayuudlls@gmail.com' } as any,
      profile: { 
        id: 'temp-user', 
        email: 'ayuudlls@gmail.com',
        first_name: 'Ayu',
        last_name: 'T',
        username: 'ayuu',
        role: 'admin',
        location: 'usa',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      isLoading: false,
      isAuthenticated: true,
      signIn: async () => ({ data: null, error: null }),
      signOut: async () => {
        localStorage.removeItem('temp-auth-bypass')
        window.location.reload()
        return { error: null }
      },
      signUp: async () => ({ data: null, error: null })
    }
  }

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        console.log('Initializing Supabase auth...')
        
        // Test Supabase connection first
        const { data, error } = await supabase.from('departments').select('count').limit(1)
        if (error) {
          console.error('Supabase connection test failed:', error)
        } else {
          console.log('Supabase connection successful')
        }

        // Get initial session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
        }
        
        console.log('Session data:', { hasSession: !!session, hasUser: !!session?.user })
        
        if (!mounted) return

        if (session?.user) {
          console.log('User found, setting authenticated state')
          
          // Don't require profile for auth to work
          let profile = null
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()
            
            profile = profileData
            console.log('Profile loaded:', !!profile)
          } catch (err) {
            console.warn('Profile fetch failed, but continuing with auth:', err)
          }

          if (mounted) {
            setAuthState({
              user: session.user,
              profile,
              isLoading: false,
              isAuthenticated: true
            })
          }
        } else {
          console.log('No session found, setting unauthenticated state')
          if (mounted) {
            setAuthState({
              user: null,
              profile: null,
              isLoading: false,
              isAuthenticated: false
            })
          }
        }
      } catch (error) {
        console.error('Auth initialization failed:', error)
        if (mounted) {
          setAuthState({
            user: null,
            profile: null,
            isLoading: false,
            isAuthenticated: false
          })
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, !!session)
        
        if (!mounted) return
        
        if (session?.user) {
          let profile = null
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()
            
            profile = profileData
          } catch (err) {
            console.warn('Profile fetch failed during auth change:', err)
          }

          setAuthState({
            user: session.user,
            profile,
            isLoading: false,
            isAuthenticated: true
          })
        } else {
          setAuthState({
            user: null,
            profile: null,
            isLoading: false,
            isAuthenticated: false
          })
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    console.log('Attempting sign in for:', email)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      console.error('Sign in error:', error)
    } else {
      console.log('Sign in successful')
    }
    
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const signUp = async (email: string, password: string, userData: any) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })

    if (data.user && !error) {
      // Try to create profile, but don't fail if it doesn't work
      try {
        await supabase
          .from('profiles')
          .insert([{
            id: data.user.id,
            email,
            ...userData
          }])
      } catch (profileError) {
        console.warn('Profile creation failed:', profileError)
      }
    }

    return { data, error }
  }

  return {
    ...authState,
    signIn,
    signOut,
    signUp
  }
}