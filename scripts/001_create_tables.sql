-- Departments table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departments_select_all" ON public.departments FOR SELECT USING (true);
CREATE POLICY "departments_insert_auth" ON public.departments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "departments_update_auth" ON public.departments FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "departments_delete_auth" ON public.departments FOR DELETE USING (auth.uid() IS NOT NULL);

-- Events/Agenda table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  event_date DATE NOT NULL,
  activity TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select_all" ON public.events FOR SELECT USING (true);
CREATE POLICY "events_insert_auth" ON public.events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "events_update_auth" ON public.events FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "events_delete_auth" ON public.events FOR DELETE USING (auth.uid() IS NOT NULL);

-- Programs (worship service templates)
CREATE TABLE IF NOT EXISTS public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  program_date DATE NOT NULL,
  leader TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programs_select_all" ON public.programs FOR SELECT USING (true);
CREATE POLICY "programs_insert_auth" ON public.programs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "programs_update_auth" ON public.programs FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "programs_delete_auth" ON public.programs FOR DELETE USING (auth.uid() IS NOT NULL);

-- Program items (individual activities in a program)
CREATE TABLE IF NOT EXISTS public.program_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  section TEXT DEFAULT 'Culto Divino',
  time TEXT NOT NULL,
  duration TEXT,
  activity TEXT NOT NULL,
  responsible TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.program_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "program_items_select_all" ON public.program_items FOR SELECT USING (true);
CREATE POLICY "program_items_insert_auth" ON public.program_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "program_items_update_auth" ON public.program_items FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "program_items_delete_auth" ON public.program_items FOR DELETE USING (auth.uid() IS NOT NULL);
