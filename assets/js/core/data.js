import { supabase } from './supabase-client.js';
import { state } from './state.js';

export async function fetchProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) return null;
  return data;
}

export async function fetchBatches() {
  const { data, error } = await supabase.from('batches').select('*').order('start_date', { ascending: false });
  state.batches = error ? [] : (data || []);
  return state.batches;
}
