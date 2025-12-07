import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Temporary check so we see what’s going on
console.log('SUPABASE URL FROM ENV:', supabaseUrl);
console.log('SUPABASE ANON KEY FROM ENV:', supabaseAnonKey?.slice(0, 8) + '...');

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing. Check frontend/.env.local and restart `npm run dev`.');
}

if (!supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Check frontend/.env.local and restart `npm run dev`.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
