-- History table for worship programs
CREATE TABLE IF NOT EXISTS public.program_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_type TEXT NOT NULL,
  program_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.program_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "program_history_select_all" ON public.program_history FOR SELECT USING (true);
CREATE POLICY "program_history_insert_all" ON public.program_history FOR INSERT WITH CHECK (true);
CREATE POLICY "program_history_update_auth" ON public.program_history FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "program_history_delete_auth" ON public.program_history FOR DELETE USING (auth.uid() IS NOT NULL);
