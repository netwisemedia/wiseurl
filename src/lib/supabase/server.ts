import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Handle missing env vars during build time
    if (!supabaseUrl || !supabaseAnonKey) {
        // Return a mock client that throws on usage but allows build
        return {
            auth: {
                getUser: async () => ({ data: { user: null }, error: null }),
            },
            from: () => ({
                select: () => ({
                    eq: () => ({
                        eq: () => ({ single: async () => ({ data: null, error: new Error('Supabase not configured') }) }),
                        order: () => ({ data: [], error: null }),
                        single: async () => ({ data: null, error: new Error('Supabase not configured') })
                    }),
                    in: () => ({
                        eq: () => ({
                            order: () => ({ data: [], error: null })
                        })
                    }),
                    order: () => ({ data: [], error: null })
                }),
                insert: async () => ({ error: null }),
            }),
        } as unknown as ReturnType<typeof createServerClient>
    }

    const cookieStore = await cookies()

    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    )
                } catch {
                    // Server Component - ignore
                }
            },
        },
    })
}
