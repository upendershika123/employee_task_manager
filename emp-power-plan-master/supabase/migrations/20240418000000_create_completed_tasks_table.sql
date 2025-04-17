-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own completed tasks" ON public.completed_tasks;
DROP POLICY IF EXISTS "Team leads can view their team's completed tasks" ON public.completed_tasks;
DROP POLICY IF EXISTS "Admins can view all completed tasks" ON public.completed_tasks;

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.completed_tasks;

-- Create completed_tasks table
CREATE TABLE public.completed_tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to TEXT NOT NULL,
    assigned_by TEXT NOT NULL,
    team_id TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    accepted_by TEXT NOT NULL,
    work_done TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_completed_tasks_task_id ON public.completed_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_completed_tasks_assigned_to ON public.completed_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_completed_tasks_team_id ON public.completed_tasks(team_id);

-- Add RLS policies
ALTER TABLE public.completed_tasks ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own completed tasks
CREATE POLICY "Users can view their own completed tasks"
    ON public.completed_tasks
    FOR SELECT
    TO authenticated
    USING (assigned_to = auth.uid()::text);

-- Allow team leads to view their team's completed tasks
CREATE POLICY "Team leads can view their team's completed tasks"
    ON public.completed_tasks
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()::text
            AND role = 'team_lead'
            AND team_id = completed_tasks.team_id
        )
    );

-- Allow admins to view all completed tasks
CREATE POLICY "Admins can view all completed tasks"
    ON public.completed_tasks
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()::text
            AND role = 'admin'
        )
    );

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS move_task_to_completed_trigger ON public.tasks;
DROP FUNCTION IF EXISTS move_task_to_completed();

-- Create function to move task to completed_tasks
CREATE OR REPLACE FUNCTION move_task_to_completed()
RETURNS TRIGGER AS $$
DECLARE
    v_work_done TEXT;
BEGIN
    -- Debug log
    RAISE NOTICE 'Trigger fired. Old review_status: %, New review_status: %', OLD.review_status, NEW.review_status;
    
    IF NEW.review_status = 'accepted' AND (OLD.review_status IS NULL OR OLD.review_status != 'accepted') THEN
        -- Debug log
        RAISE NOTICE 'Moving task % to completed_tasks', NEW.id;
        
        -- Get the latest work done from task_input_history
        SELECT input_text INTO v_work_done
        FROM task_input_history
        WHERE task_id = NEW.id
        ORDER BY created_at DESC
        LIMIT 1;
        
        -- Debug log
        RAISE NOTICE 'Found work done: %', v_work_done;
        
        -- Insert into completed_tasks
        INSERT INTO public.completed_tasks (
            task_id,
            title,
            description,
            assigned_to,
            assigned_by,
            team_id,
            priority,
            status,
            due_date,
            completed_at,
            accepted_by,
            work_done,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            NEW.title,
            NEW.description,
            NEW.assigned_to,
            NEW.assigned_by,
            NEW.team_id,
            NEW.priority,
            NEW.status,
            NEW.due_date,
            COALESCE(NEW.completed_at, NOW()),
            auth.uid()::text,
            v_work_done,
            NEW.created_at,
            NEW.updated_at
        );

        -- Debug log
        RAISE NOTICE 'Task moved to completed_tasks successfully';
        
        -- Delete from tasks table
        DELETE FROM public.tasks WHERE id = NEW.id;
        
        -- Debug log
        RAISE NOTICE 'Task deleted from tasks table';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to move task when accepted
CREATE TRIGGER move_task_to_completed_trigger
    AFTER UPDATE OF review_status ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION move_task_to_completed(); 