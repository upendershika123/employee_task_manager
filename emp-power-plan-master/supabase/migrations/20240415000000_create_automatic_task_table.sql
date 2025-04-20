-- Create automatic_task table
CREATE TABLE IF NOT EXISTS public.automatic_task (
  task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_title TEXT NOT NULL,
  task_description TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'assigned')) DEFAULT 'pending',
  team_id TEXT REFERENCES public.teams(id),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_automatic_task_status ON public.automatic_task(status);
CREATE INDEX IF NOT EXISTS idx_automatic_task_priority ON public.automatic_task(priority);

-- Add RLS policies
ALTER TABLE public.automatic_task ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can do everything with automatic tasks" ON public.automatic_task;
DROP POLICY IF EXISTS "Team leads can manage automatic tasks for their team" ON public.automatic_task;
DROP POLICY IF EXISTS "Team members can view automatic tasks for their team" ON public.automatic_task;

-- Create new policies with proper admin check
CREATE POLICY "Admins can do everything with automatic tasks" 
  ON public.automatic_task 
  FOR ALL 
  TO authenticated 
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()::text) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()::text) = 'admin'
  );

-- Allow team leads to manage tasks for their team
CREATE POLICY "Team leads can manage automatic tasks for their team" 
  ON public.automatic_task 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()::text 
      AND role = 'team_lead' 
      AND team_id = automatic_task.team_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()::text 
      AND role = 'team_lead' 
      AND team_id = automatic_task.team_id
    )
  );

-- Allow team members to view tasks for their team
CREATE POLICY "Team members can view automatic tasks for their team" 
  ON public.automatic_task 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()::text 
      AND team_id = automatic_task.team_id
    )
  );

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.log_automatic_task_assignment() CASCADE;

-- Create a function to log task assignments
CREATE OR REPLACE FUNCTION public.log_automatic_task_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'assigned' AND OLD.status = 'pending' THEN
    INSERT INTO public.task_assignment_log (
      task_id,
      assigned_to,
      assigned_by,
      assigned_at,
      automatic_assignment
    ) VALUES (
      NEW.task_id,
      NEW.assigned_to,
      NEW.assigned_by,
      NEW.assigned_at,
      TRUE
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create task_assignment_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.task_assignment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  assigned_to TEXT NOT NULL REFERENCES public.users(id),
  assigned_by TEXT NOT NULL REFERENCES public.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL,
  automatic_assignment BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create trigger for logging task assignments
DROP TRIGGER IF EXISTS log_automatic_task_assignment_trigger ON public.automatic_task;
CREATE TRIGGER log_automatic_task_assignment_trigger
  AFTER UPDATE ON public.automatic_task
  FOR EACH ROW
  EXECUTE FUNCTION public.log_automatic_task_assignment();

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.assign_automatic_task(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE);

-- Create stored procedure for assigning automatic tasks
CREATE OR REPLACE FUNCTION public.assign_automatic_task(
  p_task_id UUID,
  p_user_id TEXT,
  p_task_title TEXT,
  p_task_description TEXT,
  p_priority TEXT,
  p_team_id TEXT,
  p_due_date TIMESTAMP WITH TIME ZONE
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_task_id UUID;
  v_admin_id TEXT;
  v_auth_user_id UUID;
BEGIN
  -- Verify user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found with ID: %', p_user_id;
  END IF;

  -- Get the auth.users UUID for the user
  SELECT id::UUID INTO v_auth_user_id
  FROM auth.users
  WHERE id::text = p_user_id;

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found in auth.users with ID: %', p_user_id;
  END IF;

  -- Get an admin user ID to use as assigned_by
  SELECT id INTO v_admin_id FROM public.users WHERE role = 'admin' LIMIT 1;
  
  -- If no admin found, use the team lead's ID
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM public.users WHERE role = 'team_lead' AND team_id = p_team_id LIMIT 1;
  END IF;
  
  -- If still no user found, use the assigned user's ID (self-assignment)
  IF v_admin_id IS NULL THEN
    v_admin_id := p_user_id;
  END IF;

  -- Generate a new UUID for the task
  v_new_task_id := gen_random_uuid();

  -- Insert into tasks table
  INSERT INTO public.tasks (
    id,
    title,
    description,
    assigned_to,
    assigned_by,
    priority,
    status,
    due_date,
    team_id,
    created_at,
    updated_at
  ) VALUES (
    v_new_task_id,
    p_task_title,
    p_task_description,
    p_user_id,
    v_admin_id,
    p_priority::task_priority,
    'pending',
    p_due_date,
    p_team_id,
    NOW(),
    NOW()
  );

  -- Delete from automatic_task table
  DELETE FROM public.automatic_task
  WHERE task_id = p_task_id;

  -- Insert into task_assignment_log
  INSERT INTO public.task_assignment_log (
    task_id,
    assigned_to,
    assigned_by,
    assigned_at,
    automatic_assignment
  ) VALUES (
    v_new_task_id,
    p_user_id,
    v_admin_id,
    NOW(),
    TRUE
  );

  -- Create notification for the user
  INSERT INTO public.notifications (
    id,
    user_id,
    title,
    message,
    type,
    task_id,
    created_at,
    read
  ) VALUES (
    gen_random_uuid(),
    v_auth_user_id,
    'New Task Assigned',
    'You have been automatically assigned a new task: ' || p_task_title,
    'task_assignment',
    v_new_task_id::text,
    NOW(),
    FALSE
  );
END;
$$;

-- Create performance table if it doesn't exist
CREATE TABLE IF NOT EXISTS performance (
  user_id TEXT REFERENCES users(id),
  completed_tasks INTEGER DEFAULT 0,
  on_time_completion FLOAT DEFAULT 0,
  average_task_duration FLOAT DEFAULT 0,
  period TEXT NOT NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  archived_user_name TEXT,
  archived_user_email TEXT,
  PRIMARY KEY (user_id, period)
);

-- Add indexes for performance queries
CREATE INDEX IF NOT EXISTS idx_performance_user_id ON performance(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_period ON performance(period);

-- Add RLS policies for performance table
ALTER TABLE performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own performance"
  ON performance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Team leads can view their team's performance"
  ON performance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'team_lead'
      AND u.team_id = (
        SELECT team_id FROM users
        WHERE id = performance.user_id
      )
    )
  );

CREATE POLICY "Admins can view all performance"
  ON performance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "System can update performance"
  ON performance FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to calculate and update performance metrics
CREATE OR REPLACE FUNCTION calculate_performance_metrics(p_user_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed_tasks INTEGER;
  v_on_time_tasks INTEGER;
  v_total_duration FLOAT;
  v_period TEXT;
BEGIN
  -- Get current period (YYYY-MM)
  v_period := to_char(CURRENT_DATE, 'YYYY-MM');
  
  -- Calculate metrics from completed tasks
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE completed_at <= due_date),
    COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))), 0)
  INTO 
    v_completed_tasks,
    v_on_time_tasks,
    v_total_duration
  FROM completed_tasks
  WHERE assigned_to = p_user_id
  AND to_char(completed_at, 'YYYY-MM') = v_period;

  -- Insert or update performance record
  INSERT INTO performance (
    user_id,
    completed_tasks,
    on_time_completion,
    average_task_duration,
    period
  ) VALUES (
    p_user_id,
    v_completed_tasks,
    CASE WHEN v_completed_tasks > 0 
      THEN (v_on_time_tasks::FLOAT / v_completed_tasks::FLOAT) * 100 
      ELSE 0 
    END,
    v_total_duration,
    v_period
  )
  ON CONFLICT (user_id, period) 
  DO UPDATE SET
    completed_tasks = EXCLUDED.completed_tasks,
    on_time_completion = EXCLUDED.on_time_completion,
    average_task_duration = EXCLUDED.average_task_duration;
END;
$$; 