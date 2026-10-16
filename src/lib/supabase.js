import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if credentials are placeholders or missing
export const isSupabaseConfigured = 
  Boolean(supabaseUrl) && 
  Boolean(supabaseAnonKey) && 
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-anon-key');

if (!isSupabaseConfigured) {
  console.warn(
    'Dental Clinic Queue System: Supabase credentials are missing or default placeholders. Please update your .env file with your project URL and Anon Key.'
  );
}

// Storage keys for isolated authentication
export const ADMIN_AUTH_STORAGE_KEY = 'dentalcare_admin_auth_token';
export const PATIENT_AUTH_STORAGE_KEY = 'dentalcare_patient_auth_token';

// Dedicated Supabase client for Administrator Portal
export const adminSupabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storageKey: ADMIN_AUTH_STORAGE_KEY,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

// Dedicated Supabase client for Patient / Public Portal
export const patientSupabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storageKey: PATIENT_AUTH_STORAGE_KEY,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

// Helper to determine the active Supabase client based on the current portal route
export const getActiveSupabase = () => {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path.startsWith('/admin') || path.startsWith('/staff')) {
      return adminSupabase;
    }
  }
  return patientSupabase;
};

// Unified proxy that forwards all calls to the active client for the current portal
export const supabase = new Proxy({}, {
  get(_target, prop) {
    const client = getActiveSupabase();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

