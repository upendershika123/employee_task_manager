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
      const { data, error } = await this.supabase
        .from('task_input_history')
        .select('*')
        .eq('task_id', taskId)
        .single();

      if (error) throw error;

      if (!data) return null;

      return {
        taskId: data.task_id,
        userId: data.user_id,
        currentText: data.input_text,
        lastUpdated: new Date(data.created_at),
        progressPercentage: data.progress
      };
    } catch (error) {
      console.error('Error fetching task progress:', error);
      return null;
    }
  }

  async saveTaskProgress(taskId: string, inputText: string, progress: number): Promise<void> {
    try {
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
        console.error('Error fetching existing progress:', fetchError);
        throw fetchError;
      }

      if (existing) {
        // Update existing entry
        const { error: updateError } = await this.supabase
          .from('task_input_history')
          .update({
            input_text: inputText,
            progress: progress,
            created_at: new Date().toISOString()
          })
          .eq('task_id', taskId);

        if (updateError) {
          console.error('Error updating progress:', updateError);
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
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Error inserting progress:', insertError);
          throw insertError;
        }
      }
    } catch (error) {
      console.error('Error saving task progress:', error);
      // Add more detailed error information
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
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