-- First, let's add an archived column to the performance table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'performance' 
    AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE performance ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
    ALTER TABLE performance ADD COLUMN archived_user_name TEXT;
    ALTER TABLE performance ADD COLUMN archived_user_email TEXT;
  END IF;
END $$;

-- First, let's modify the task_assignment_log table to use TEXT instead of UUID for task_id
DO $$ 
BEGIN
  -- Check if we need to modify the column type
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'task_assignment_log' 
    AND column_name = 'task_id'
    AND data_type = 'uuid'
  ) THEN
    -- Drop any existing foreign key constraints
    DO $inner$ 
    BEGIN
      EXECUTE (
        SELECT 'ALTER TABLE task_assignment_log DROP CONSTRAINT ' || conname
        FROM pg_constraint 
        WHERE conrelid = 'task_assignment_log'::regclass 
        AND conname LIKE '%task_id%'
        LIMIT 1
      );
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END $inner$;
    
    -- Alter the column type
    ALTER TABLE task_assignment_log 
    ALTER COLUMN task_id TYPE TEXT USING task_id::TEXT;
  END IF;
END $$;

-- Drop the existing function first
DROP FUNCTION IF EXISTS delete_user_transaction(TEXT, TEXT, TEXT);

-- Create a function to handle user deletion and task reassignment
CREATE OR REPLACE FUNCTION delete_user_transaction(
  p_user_id TEXT,
  p_user_role TEXT,
  p_team_id TEXT
)
RETURNS TABLE (
  new_team_lead_id TEXT,
  new_team_lead_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_members_count INTEGER;
  v_random_team_member TEXT;
  v_new_team_lead_id TEXT;
  v_new_team_lead_email TEXT;
  v_team_name TEXT;
  v_admin_user_id TEXT;
BEGIN
  -- Initialize variables
  v_new_team_lead_id := NULL;
  v_new_team_lead_email := NULL;

  -- Get an admin user ID to reassign tasks (simplified selection)
  SELECT id INTO v_admin_user_id
  FROM users
  WHERE role = 'admin'
  AND id != p_user_id  -- Don't select the user being deleted
  LIMIT 1;

  -- If no admin found, use the system ID
  IF v_admin_user_id IS NULL THEN
    -- Try to find any other user that's not being deleted
    SELECT id INTO v_admin_user_id
    FROM users
    WHERE id != p_user_id
    LIMIT 1;

    -- If still no user found, use 'system'
    IF v_admin_user_id IS NULL THEN
      v_admin_user_id := 'system';
    END IF;
  END IF;

  -- If user is a team lead and has a team
  IF p_user_role = 'team_lead' AND p_team_id IS NOT NULL THEN
    -- Get team name for logging
    SELECT name INTO v_team_name FROM teams WHERE id = p_team_id;
    
    -- First, check if there are other team leads for this team
    SELECT u.id, u.email 
    INTO v_new_team_lead_id, v_new_team_lead_email
    FROM users u
    WHERE u.team_id = p_team_id 
      AND u.role = 'team_lead'
      AND u.id != p_user_id
    ORDER BY RANDOM()
    LIMIT 1;

    IF v_new_team_lead_id IS NOT NULL THEN
      -- Another team lead exists
      RAISE NOTICE 'Found existing team lead % for team %', v_new_team_lead_email, v_team_name;
      
      -- Transfer team members to the existing team lead
      UPDATE users
      SET team_id = p_team_id  -- Keep the same team_id as they're staying in the same team
      WHERE team_id = p_team_id
        AND id != p_user_id;   -- Don't update the user being deleted

      -- Update tasks where user is the assigner to the new team lead
      UPDATE tasks
      SET assigned_by = v_new_team_lead_id
      WHERE assigned_by = p_user_id;
      
      -- Reassign the deleted team lead's personal tasks to the new team lead
      UPDATE tasks
      SET 
        assigned_to = v_new_team_lead_id,
        team_id = p_team_id    -- Ensure tasks stay with the same team
      WHERE assigned_to = p_user_id;

      -- Log the reassignment
      INSERT INTO task_assignment_log (
        task_id,
        assigned_to,
        assigned_by,
        assigned_at,
        automatic_assignment
      )
      SELECT 
        id,
        v_new_team_lead_id,
        p_user_id,
        NOW(),
        TRUE
      FROM tasks
      WHERE assigned_to = v_new_team_lead_id;

    ELSE
      -- No other team lead exists, proceed with original logic
      RAISE NOTICE 'No other team lead found for team %. Will reassign or delete tasks.', v_team_name;
      
      -- Count team members
      SELECT COUNT(*) INTO v_team_members_count
      FROM users
      WHERE team_id = p_team_id AND role = 'team_member';

      IF v_team_members_count > 0 THEN
        -- Select a random team member to reassign tasks to
        SELECT id INTO v_random_team_member
        FROM users
        WHERE team_id = p_team_id AND role = 'team_member'
        ORDER BY RANDOM()
        LIMIT 1;

        -- Update tasks where user is the assigner to admin or system
        UPDATE tasks
        SET assigned_by = v_admin_user_id
        WHERE assigned_by = p_user_id;

        -- Reassign team lead's personal tasks to the random team member
        UPDATE tasks
        SET assigned_to = v_random_team_member
        WHERE assigned_to = p_user_id;

        -- Update team members to have no team since no team lead exists
        UPDATE users
        SET team_id = NULL
        WHERE team_id = p_team_id;

        -- Delete all tasks associated with this team
        DELETE FROM tasks
        WHERE team_id = p_team_id;

        -- Delete the team since no team lead exists
        DELETE FROM teams
        WHERE id = p_team_id;
      ELSE
        -- No team members, just delete tasks and team
        -- Update tasks where user is the assigner to admin or system
        UPDATE tasks
        SET assigned_by = v_admin_user_id
        WHERE assigned_by = p_user_id;

        -- Delete all tasks associated with this team
        DELETE FROM tasks
        WHERE team_id = p_team_id;

        -- Delete the team since no members or leads remain
        DELETE FROM teams
        WHERE id = p_team_id;
      END IF;
    END IF;
  ELSE
    -- For team members or users without a team
    IF p_team_id IS NOT NULL THEN
      -- Select a random team member (excluding the one being deleted)
      SELECT id INTO v_random_team_member
      FROM users
      WHERE team_id = p_team_id 
        AND role = 'team_member'
        AND id != p_user_id
      ORDER BY RANDOM()
      LIMIT 1;

      -- Update tasks where user is the assigner to admin or system
      UPDATE tasks
      SET assigned_by = v_admin_user_id
      WHERE assigned_by = p_user_id;

      -- Reassign tasks if there's another team member
      IF v_random_team_member IS NOT NULL THEN
        UPDATE tasks
        SET assigned_to = v_random_team_member
        WHERE assigned_to = p_user_id;

        -- Log the reassignment
        INSERT INTO task_assignment_log (
          task_id,
          assigned_to,
          assigned_by,
          assigned_at,
          automatic_assignment
        )
        SELECT 
          id,
          v_random_team_member,
          p_user_id,
          NOW(),
          TRUE
        FROM tasks
        WHERE assigned_to = v_random_team_member;
      END IF;
    END IF;
  END IF;

  -- Update any remaining tasks where user is the assigner
  UPDATE tasks
  SET assigned_by = v_admin_user_id
  WHERE assigned_by = p_user_id;

  -- Delete user's remaining tasks if they weren't reassigned
  DELETE FROM tasks
  WHERE assigned_to = p_user_id;

  -- Delete user's notifications
  DELETE FROM notifications
  WHERE user_id = p_user_id;

  -- Delete user's performance records
  DELETE FROM performance
  WHERE user_id = p_user_id;

  -- Delete completed tasks records if they exist
  DELETE FROM completed_tasks
  WHERE assigned_to = p_user_id;

  -- Delete task assignment logs where user was assigned to or assigned by
  DELETE FROM task_assignment_log
  WHERE assigned_to = p_user_id OR assigned_by = p_user_id;

  -- Finally, delete the user
  DELETE FROM users
  WHERE id = p_user_id;

  -- Return the new team lead's information (if any)
  RETURN QUERY
  SELECT 
    v_new_team_lead_id::TEXT,
    v_new_team_lead_email::TEXT;
END;
$$; 