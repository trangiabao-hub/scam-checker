import { createClient } from '@supabase/supabase-js'

export const SUPABASE_REPORTS_TABLE = 'scam_cccd_reports'
export const SUPABASE_BUCKET = 'report-evidences'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
