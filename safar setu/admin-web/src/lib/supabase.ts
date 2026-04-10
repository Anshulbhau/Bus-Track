import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rpqeavqoidtwfxzmdplb.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwcWVhdnFvaWR0d2Z4em1kcGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4ODQ1MzMsImV4cCI6MjA4ODQ2MDUzM30.oi6zQgYc3MEs3-glB_aOfMCgTvBOikNzPZjyVqoRiho'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const shadowSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
})
