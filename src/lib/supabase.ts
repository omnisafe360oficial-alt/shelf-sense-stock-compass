import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  "https://qyaepiuqiljskgfwtnhm.supabase.co";

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5YWVwaXVxaWxqc2tnZnd0bmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3Mjk0MjcsImV4cCI6MjEwODMwNTQyN30.OgtjFH8EWrdl8kYf-uSznlNbDZyfFJEtb9u9TmNlfKc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
