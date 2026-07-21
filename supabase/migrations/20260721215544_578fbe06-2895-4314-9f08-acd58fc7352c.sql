
CREATE TABLE public.admin_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  urgency text NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','blocked','done')),
  due_date timestamptz,
  assignee text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_todos TO authenticated;
GRANT ALL ON public.admin_todos TO service_role;

ALTER TABLE public.admin_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view todos" ON public.admin_todos
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert todos" ON public.admin_todos
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update todos" ON public.admin_todos
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete todos" ON public.admin_todos
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER admin_todos_touch BEFORE UPDATE ON public.admin_todos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_admin_todos_status ON public.admin_todos(status);
CREATE INDEX idx_admin_todos_due ON public.admin_todos(due_date);
