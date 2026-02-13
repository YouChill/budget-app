import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Brak konfiguracji Supabase!\n' +
    'Utwórz plik .env.local z:\n' +
    'VITE_SUPABASE_URL=https://twoj-projekt.supabase.co\n' +
    'VITE_SUPABASE_ANON_KEY=twoj-anon-key'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
