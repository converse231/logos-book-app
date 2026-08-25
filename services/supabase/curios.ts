import { supabase } from '@/lib/supabase';
import type { OwnedCurio, PouchResult } from '@/services/types';

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

  async openPouch(): Promise<PouchResult> {
    const { data, error } = await supabase.rpc('open_pouch');
    if (error) throw error;
    // The RPC returns jsonb; it reports "can't afford it" as a value rather than
    // an error, so the UI can say so without a try/catch.
    return data as PouchResult;
  },
};
