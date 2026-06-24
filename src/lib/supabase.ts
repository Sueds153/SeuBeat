import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from environment variables
// Supports: VITE_ prefix (Vite frontend), plain vars (server), and new publishable key format
const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  process.env.SUPABASE_URL || 
  process.env.VITE_SUPABASE_URL || '';

const supabaseKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY || 
  process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Key is missing. Check your .env file.');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseKey);
