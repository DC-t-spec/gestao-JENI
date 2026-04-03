import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'COLE_AQUI_SUPABASE_URL';
const supabaseAnonKey = 'COLE_AQUI_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
