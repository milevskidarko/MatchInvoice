import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY;

// Track if we've already warned about missing env vars
let hasWarned = false;

// Create a dummy client if env vars are missing to prevent runtime errors
// This allows the app to start, but operations will fail with clear error messages
const createSupabaseClient = (): SupabaseClient => {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Only warn once to avoid console spam
    if (!hasWarned) {
      const warningMsg = '⚠️ Missing Supabase environment variables. File uploads will not work until you set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.';
      
      if (typeof window === 'undefined') {
        // Server-side: log warning
        console.warn(warningMsg);
      } else {
        // Client-side: log warning (less intrusive than error)
        console.warn(warningMsg);
      }
      hasWarned = true;
    }
    
    // Return a client with placeholder values that will fail gracefully
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
};

export const supabase = createSupabaseClient();
