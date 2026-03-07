import { createClient } from '@supabase/supabase-js'

function getServiceEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return { supabaseUrl, serviceRoleKey }
}

export function hasSupabaseServiceEnv() {
  const { supabaseUrl, serviceRoleKey } = getServiceEnv()
  return Boolean(supabaseUrl && serviceRoleKey)
}

export function getSupabaseServiceClient() {
  const { supabaseUrl, serviceRoleKey } = getServiceEnv()
  if (!supabaseUrl || !serviceRoleKey) return null

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
