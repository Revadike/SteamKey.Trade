import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with Auth context of the user that called the function.
 * This way your row-level-security (RLS) policies are applied.
 *
 * @param {Request} req - The incoming HTTP request
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 */
export const createAuthenticatedClient = (req) => {
  const authHeader = req.headers.get('Authorization');
  return createClient(
    (Deno.env.get('SUPABASE_URL') ?? '').trim(),
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined
  );
};

export const supabaseClient = createClient(
  (Deno.env.get('SUPABASE_URL') ?? '').trim(),
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

export const supabaseAdmin = createClient(
  (Deno.env.get('SUPABASE_URL') ?? '').trim(),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
