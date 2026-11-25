import { createClient } from '@supabase/supabase-js';

// Default Supabase credentials (Cloud 24/7 Serverless DB)
const ENV_URL = import.meta.env.VITE_SUPABASE_URL || 'https://cxkkxmpdefgfkjapwmpx.supabase.co';
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_iLlGy0KdogDmyXr3-tMoRA_x7br_OVm';

let clientInstance = null;

export function getSupabaseConfig() {
  const storedUrl = localStorage.getItem('nmart_supabase_url');
  const storedKey = localStorage.getItem('nmart_supabase_key');

  const url = (storedUrl && storedUrl.trim()) ? storedUrl.trim() : ENV_URL;
  const key = (storedKey && storedKey.trim()) ? storedKey.trim() : ENV_KEY;

  return { url, key, isConfigured: Boolean(url && key) };
}

export function setSupabaseConfig(url, key) {
  if (url && key) {
    localStorage.setItem('nmart_supabase_url', url.trim());
    localStorage.setItem('nmart_supabase_key', key.trim());
    clientInstance = createClient(url.trim(), key.trim(), {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } }
    });
  } else {
    localStorage.removeItem('nmart_supabase_url');
    localStorage.removeItem('nmart_supabase_key');
    clientInstance = null;
  }
}

export function getSupabaseClient() {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  if (!clientInstance) {
    clientInstance = createClient(url, key, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } }
    });
  }
  return clientInstance;
}

export async function testSupabaseConnection(urlToTest, keyToTest) {
  try {
    const testClient = createClient(urlToTest, keyToTest, {
      auth: { persistSession: false }
    });
    const { data, error } = await testClient.from('settings').select('*').limit(1);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Could not connect to Supabase project' };
  }
}
