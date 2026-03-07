import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseEnv, hasSupabaseEnv } from './env'

let browserClient: SupabaseClient | null = null

export function getSupabaseBrowserClient() {
  if (typeof window === 'undefined') return null
  if (!hasSupabaseEnv()) return null
  if (browserClient) return browserClient

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()
  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return browserClient
}
