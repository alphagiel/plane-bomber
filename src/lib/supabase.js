import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://opztiobihdphdwpbbkyy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wenRpb2JpaGRwaGR3cGJia3l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MjA5NDcsImV4cCI6MjA4ODQ5Njk0N30.ZyyxZRIfnxh7_irafNwSQ43QVGCrMFojvGZbgPr30tU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
