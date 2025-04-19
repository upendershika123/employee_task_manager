import { createClient } from '@supabase/supabase-js'

// Debug: Log environment variable status
console.log('Environment Variables Debug:', {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'Not Set',
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Not Set',
  MODE: import.meta.env.MODE // This will show if we're in development or production
})

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Environment Variables Status:', {
    VITE_SUPABASE_URL: supabaseUrl ? 'Present' : 'Missing',
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? 'Present' : 'Missing'
  })
  throw new Error('Missing Supabase environment variables. Please check your .env file and ensure it is in the project root.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Create a separate client with the service key for admin operations
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase 