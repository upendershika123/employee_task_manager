-- Create task_review_status enum type
DO $$ BEGIN
    CREATE TYPE task_review_status AS ENUM ('pending', 'accepted', 'rejected', 'needs_improvement');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add review_status column to tasks table
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS review_status task_review_status DEFAULT 'pending';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_tasks_review_status ON public.tasks(review_status);

-- Update RLS policies to include review_status
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Team leads can view their team's tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins can view all tasks" ON public.tasks;

-- Allow users to view their own tasks
CREATE POLICY "Users can view their own tasks"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()::text
  );

-- Allow team leads to view their team's tasks
CREATE POLICY "Team leads can view their team's tasks"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
      AND role = 'team_lead'
      AND team_id = tasks.team_id
    )
  );

-- Allow admins to view all tasks
CREATE POLICY "Admins can view all tasks"
  ON public.tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
      AND role = 'admin'
    )
  );

-- Allow team leads to update review_status for their team's tasks
CREATE POLICY "Team leads can update review status"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
      AND role = 'team_lead'
      AND team_id = tasks.team_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
      AND role = 'team_lead'
      AND team_id = tasks.team_id
    )
  ); 