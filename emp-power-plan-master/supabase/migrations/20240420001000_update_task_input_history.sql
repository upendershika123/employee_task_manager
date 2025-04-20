-- First, drop the foreign key constraint if it exists
ALTER TABLE IF EXISTS task_input_history 
DROP CONSTRAINT IF EXISTS task_input_history_task_id_fkey;

-- Modify the task_id column to accept text
ALTER TABLE task_input_history 
ALTER COLUMN task_id TYPE TEXT,
ALTER COLUMN user_id TYPE TEXT;

-- Update the indexes
DROP INDEX IF EXISTS idx_task_input_history_task_id;
DROP INDEX IF EXISTS idx_task_input_history_user_id;
CREATE INDEX IF NOT EXISTS idx_task_input_history_task_id ON task_input_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_input_history_user_id ON task_input_history(user_id);

-- Update RLS policies to use text comparison
DROP POLICY IF EXISTS "Users can view their own task progress" ON task_input_history;
DROP POLICY IF EXISTS "Users can insert their own task progress" ON task_input_history;
DROP POLICY IF EXISTS "Users can update their own task progress" ON task_input_history;

CREATE POLICY "Users can view their own task progress"
    ON task_input_history
    FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own task progress"
    ON task_input_history
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own task progress"
    ON task_input_history
    FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id); 