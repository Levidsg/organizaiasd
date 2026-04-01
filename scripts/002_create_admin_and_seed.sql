-- Allow anyone to update the 'responsible' field on program_items (for public fill-in)
DROP POLICY IF EXISTS "program_items_update_auth" ON public.program_items;
CREATE POLICY "program_items_update_all" ON public.program_items FOR UPDATE USING (true);

-- Allow anyone to update the 'leader' field on programs (for public fill-in of dirigentes)
DROP POLICY IF EXISTS "programs_update_auth" ON public.programs;
CREATE POLICY "programs_update_all" ON public.programs FOR UPDATE USING (true);
