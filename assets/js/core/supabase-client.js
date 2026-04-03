import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient("https://kzjgpotspojqssbgvibj.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6amdwb3RzcG9qcXNzYmd2aWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDUwODgsImV4cCI6MjA5MDgyMTA4OH0.namPqEkvICM038IUuAIbCObvQ-YpPN7ND3jh7k5HiFs");
