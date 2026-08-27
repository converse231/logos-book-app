import { supabase } from '@/lib/supabase';
import type { CurioSetId, OwnedCurio, PouchResult } from '@/services/types';

// Curios: read your shelf, and open a pouch.
//
// There is deliberately no "grant curio" method. public.user_curios has RLS with
// a SELECT policy and nothing else, so the ONLY writer is the SECURITY DEFINER
// open_pouch RPC — the same rule that keeps streak and XP off the client.

export const curioApi = {
  async getCurios(): Promise<OwnedCurio[]> {
    const { data, error } = await supabase
      .from('user_curios')
      .select('curio_key, count, first_found_at')
      .order('first_found_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      key: r.curio_key as string,
      count: r.count as number,
      firstFoundAt: r.first_found_at as string,
    }));
  },

  async openPouch(set: CurioSetId): Promise<PouchResult> {
    // p_set has no default server-side on purpose (it would make the legacy
    // zero-arg overload ambiguous), so it is always sent.
    const { data, error } = await supabase.rpc('open_pouch', { p_set: set });
    if (error) throw error;
    // The RPC returns jsonb; it reports "can't afford it" as a value rather than
    // an error, so the UI can say so without a try/catch.
    return data as PouchResult;
  },
};
