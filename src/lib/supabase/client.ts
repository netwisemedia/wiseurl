import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Handle missing env vars during build time
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client that throws on usage but allows build
    return {
      auth: {
        signInWithPassword: async () => { throw new Error('Supabase not configured') },
        signUp: async () => { throw new Error('Supabase not configured') },
        signOut: async () => { throw new Error('Supabase not configured') },
        getUser: async () => ({ data: { user: null }, error: null }),
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: new Error('Supabase not configured') }) }) }),
        insert: async () => ({ error: new Error('Supabase not configured') }),
      }),
    } as ReturnType<typeof createBrowserClient>
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
