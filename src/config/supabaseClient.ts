// ============================================================
// Orivay — Supabase Client (Web)
// ============================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bmvkhnucztxkesoimnfa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdmtobnVjenR4a2Vzb2ltbmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzQyMTMsImV4cCI6MjA5NTQxMDIxM30.Yuqctu_Tot54yuNOQ9-AstUxQagM3pSA9dtuE8S4d10';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
