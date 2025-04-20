export interface DatabaseService {
  // ... existing methods ...

  // Task Progress Methods
  getTaskProgress(taskId: string): Promise<TaskProgress | null>;
  saveTaskProgress(taskId: string, inputText: string, progress: number): Promise<void>;
}

export class DatabaseServiceImpl implements DatabaseService {
  // ... existing methods ...

  async getTaskProgress(taskId: string): Promise<TaskProgress | null> {
    try {
      console.log('Fetching task progress for:', taskId);
      
      const { data, error } = await this.supabase
        .from('task_input_history')
        .select('*')
        .eq('task_id', taskId)
        .single();

      if (error) {
        console.error('Error fetching task progress:', {
          error,
          taskId,
          errorCode: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log('Task progress data:', data);

      if (!data) return null;

      return {
        taskId: data.task_id,
        userId: data.user_id,
        currentText: data.input_text,
        lastUpdated: new Date(data.created_at),
        progressPercentage: data.progress
      };
    } catch (error) {
      console.error('Error in getTaskProgress:', error);
      return null;
    }
  }

  async saveTaskProgress(taskId: string, inputText: string, progress: number): Promise<void> {
    try {
      console.log('Saving task progress:', { taskId, progress });
      
      // Test database connection first
      const isConnected = await this.testConnection();
      if (!isConnected) {
        throw new Error('Database connection failed');
      }

      // Check if entry exists
      const { data: existing, error: fetchError } = await this.supabase
        .from('task_input_history')
        .select('id')
        .eq('task_id', taskId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error fetching existing progress:', {
          error: fetchError,
          taskId,
          errorCode: fetchError.code,
          details: fetchError.details,
          hint: fetchError.hint
        });
        throw fetchError;
      }

      const timestamp = new Date().toISOString();
      
      if (existing) {
        // Update existing entry
        const { error: updateError } = await this.supabase
          .from('task_input_history')
          .update({
            input_text: inputText,
            progress: progress,
            updated_at: timestamp
          })
          .eq('task_id', taskId);

        if (updateError) {
          console.error('Error updating progress:', {
            error: updateError,
            taskId,
            errorCode: updateError.code,
            details: updateError.details,
            hint: updateError.hint
          });
          throw updateError;
        }
      } else {
        // Insert new entry
        const { error: insertError } = await this.supabase
          .from('task_input_history')
          .insert({
            task_id: taskId,
            input_text: inputText,
            progress: progress,
            created_at: timestamp,
            updated_at: timestamp
          });

        if (insertError) {
          console.error('Error inserting progress:', {
            error: insertError,
            taskId,
            errorCode: insertError.code,
            details: insertError.details,
            hint: insertError.hint
          });
          throw insertError;
        }
      }
      
      console.log('Task progress saved successfully');
    } catch (error) {
      console.error('Error in saveTaskProgress:', {
        error,
        taskId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.from('task_input_history').select('count').limit(1);
      
      // Log connection details for debugging
      console.log('Supabase Connection Test:', {
        url: this.supabase.getUrl(),
        isConnected: !error,
        origin: window.location.origin,
        error: error || 'None'
      });

      return !error;
    } catch (err) {
      console.error('Connection test failed:', err);
      return false;
    }
  }
} 