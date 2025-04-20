-- First check if the table exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_input_history') THEN
        -- Create the table if it doesn't exist
        CREATE TABLE task_input_history (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            task_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            input_text TEXT,
            progress INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
        );
    ELSE
        -- Add user_id column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'task_input_history' AND column_name = 'user_id') THEN
            ALTER TABLE task_input_history ADD COLUMN user_id TEXT NOT NULL DEFAULT 'system';
        END IF;
    END IF;
END $$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_task_input_history_task_id ON task_input_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_input_history_user_id ON task_input_history(user_id);

-- Enable RLS if not already enabled
ALTER TABLE task_input_history ENABLE ROW LEVEL SECURITY;

-- Recreate the policies
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

-- Grant necessary permissions
GRANT ALL ON task_input_history TO authenticated;

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_task_input_history_updated_at ON task_input_history;
CREATE TRIGGER update_task_input_history_updated_at
    BEFORE UPDATE ON task_input_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 