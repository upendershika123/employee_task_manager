-- Create task_input_history table
CREATE TABLE IF NOT EXISTS public.task_input_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL,
  input_text TEXT NOT NULL,
  progress INTEGER NOT NULL CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_task_input_history_task_id ON public.task_input_history(task_id);

-- Add RLS policies
ALTER TABLE public.task_input_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own task input history" ON public.task_input_history;
DROP POLICY IF EXISTS "Users can manage their own task input history" ON public.task_input_history;

-- Allow users to view their own task input history
CREATE POLICY "Users can view their own task input history"
  ON public.task_input_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_input_history.task_id
      AND tasks.assigned_to = auth.uid()::text
    )
  );

-- Allow users to insert/update their own task input history
CREATE POLICY "Users can manage their own task input history"
  ON public.task_input_history
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_input_history.task_id
      AND tasks.assigned_to = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_input_history.task_id
      AND tasks.assigned_to = auth.uid()::text
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_task_input_history_updated_at ON public.task_input_history;
CREATE TRIGGER update_task_input_history_updated_at
  BEFORE UPDATE ON public.task_input_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 