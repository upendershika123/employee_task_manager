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
      // Check if entry exists
      const { data: existing } = await this.supabase
        .from('task_input_history')
        .select('id')
        .eq('task_id', taskId)
        .single();

      if (existing) {
        // Update existing entry
        const { error } = await this.supabase
          .from('task_input_history')
          .update({
            input_text: inputText,
            progress: progress,
            created_at: new Date().toISOString()
          })
          .eq('task_id', taskId);

        if (error) throw error;
      } else {
        // Insert new entry
        const { error } = await this.supabase
          .from('task_input_history')
          .insert({
            task_id: taskId,
            input_text: inputText,
            progress: progress,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving task progress:', error);
      throw error;
    }
  }
} 