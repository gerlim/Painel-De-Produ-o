export function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return { supabaseUrl, supabaseAnonKey }
}

export function hasSupabaseEnv() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()
  return Boolean(supabaseUrl && supabaseAnonKey)
}
