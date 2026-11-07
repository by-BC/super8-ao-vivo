import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** A chave anon é pública por definição: o banco só aceita escrita pelas funções s8_* que conferem PIN/chave. */
export const configured = Boolean(url && key);

export const supabase = createClient(url || 'http://localhost:54321', key || 'sem-chave', {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 20 } },
});
