import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rpqeavqoidtwfxzmdplb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwcWVhdnFvaWR0d2Z4em1kcGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4ODQ1MzMsImV4cCI6MjA4ODQ2MDUzM30.oi6zQgYc3MEs3-glB_aOfMCgTvBOikNzPZjyVqoRiho'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
