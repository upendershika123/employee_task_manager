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
BEGIN
  -- Verify user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found with ID: %', p_user_id;
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
    p_user_id, -- Use the user's ID directly
    'New Task Assigned',
    'You have been automatically assigned a new task: ' || p_task_title,
    'task_assignment',
    v_new_task_id::text,
    NOW(),
    FALSE
  );
END;
$$; 