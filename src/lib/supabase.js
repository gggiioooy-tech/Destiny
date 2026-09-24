import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = "https://kqygrszkbuzxmmfndhye.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxeWdyc3prYnV6eG1tZm5kaHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MjI2OTUsImV4cCI6MjA5NzQ5ODY5NX0.SDIjG-rrBt4apIxTYT-qg9vyJuVgzN9uxiwpQ_QkOLs";
const ID_KEY = '15month_remembered_id';
// Discard all legacy password and client-trusted session data on this origin.
for (const key of ['destiny_guild_saved_login_pw', 'destiny_guild_saved_login_id', 'destiny_guild_remember_login', 'seori_guild_current_user_id', 'seori_guild_session_expires_at']) {
  try { localStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
}
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: sessionStorage, storageKey: '15month_secure_auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
export function readRememberedId() { try { return localStorage.getItem(ID_KEY) || ''; } catch { return ''; } }
export function rememberId(id) { try { if (id) localStorage.setItem(ID_KEY, id); else localStorage.removeItem(ID_KEY); } catch { /* Optional preference. */ } }
export async function requestAuth(payload) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/site-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${data.session?.access_token || SUPABASE_ANON_KEY}` },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error) throw new Error(result.error || '인증 서버에 연결하지 못했습니다.');
  return result;
}
