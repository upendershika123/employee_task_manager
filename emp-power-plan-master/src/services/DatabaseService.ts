import { SupabaseClient } from '@supabase/supabase-js';

export interface TaskProgress {
  taskId: string;
  userId: string;
  currentText: string;
  lastUpdated: Date;
  progressPercentage: number;
}

export interface DatabaseService {
  // ... existing methods ...

  // Task Progress Methods
  getTaskProgress(taskId: string): Promise<TaskProgress | null>;
  saveTaskProgress(taskId: string, inputText: string, progress: number): Promise<void>;
  testConnection(): Promise<boolean>;
}

export class DatabaseServiceImpl implements DatabaseService {
  private supabase: SupabaseClient;
  private isConnected: boolean = false;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.initializeConnection();
  }

  private async initializeConnection() {
    this.isConnected = await this.testConnection();
    console.log('Database connection initialized:', {
      isConnected: this.isConnected,
      url: process.env.VITE_SUPABASE_URL || 'URL not available',
      origin: typeof window !== 'undefined' ? window.location.origin : 'server'
    });
  }

  async getTaskProgress(taskId: string): Promise<TaskProgress | null> {
    if (!this.isConnected) {
      console.warn('Database connection not established. Attempting to reconnect...');
      await this.initializeConnection();
      if (!this.isConnected) {
        throw new Error('Failed to establish database connection');
      }
    }

    try {
      console.log('Fetching task progress for:', taskId);
      
      const { data, error } = await this.supabase
        .from('task_input_history')
        .select('*')
        .eq('task_id', taskId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching task progress:', {
          error,
          taskId,
          errorCode: error.code,
          details: error.details,
          hint: error.hint,
          environment: process.env.NODE_ENV
        });
        throw error;
      }

      console.log('Task progress data:', data);

      if (!data) return null;

      return {
        taskId: data.task_id,
        userId: data.user_id,
        currentText: data.input_text || '',
        lastUpdated: new Date(data.updated_at || data.created_at),
        progressPercentage: data.progress || 0
      };
    } catch (error) {
      console.error('Error in getTaskProgress:', {
        error,
        taskId,
        environment: process.env.NODE_ENV,
        connectionStatus: this.isConnected
      });
      return null;
    }
  }

  async saveTaskProgress(taskId: string, inputText: string, progress: number): Promise<void> {
    if (!this.isConnected) {
      console.warn('Database connection not established. Attempting to reconnect...');
      await this.initializeConnection();
      if (!this.isConnected) {
        throw new Error('Failed to establish database connection');
      }
    }

    try {
      console.log('Saving task progress:', { 
        taskId, 
        progress,
        environment: process.env.NODE_ENV,
        origin: typeof window !== 'undefined' ? window.location.origin : 'server'
      });
      
      // Get current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('User authentication error:', {
          error: userError,
          environment: process.env.NODE_ENV
        });
        throw new Error('User not authenticated');
      }

      const timestamp = new Date().toISOString();

      // Check if entry exists
      const { data: existing, error: fetchError } = await this.supabase
        .from('task_input_history')
        .select('id')
        .eq('task_id', taskId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching existing progress:', {
          error: fetchError,
          taskId,
          errorCode: fetchError.code,
          details: fetchError.details,
          hint: fetchError.hint,
          environment: process.env.NODE_ENV
        });
        throw fetchError;
      }

      if (existing?.id) {
        // Update existing entry
        console.log('Updating existing progress entry:', existing.id);
        const { error: updateError } = await this.supabase
          .from('task_input_history')
          .update({
            input_text: inputText,
            progress: progress,
            updated_at: timestamp
          })
          .eq('id', existing.id)
          .eq('task_id', taskId);

        if (updateError) {
          console.error('Error updating progress:', {
            error: updateError,
            taskId,
            errorCode: updateError.code,
            details: updateError.details,
            hint: updateError.hint,
            environment: process.env.NODE_ENV
          });
          throw updateError;
        }
      } else {
        // Insert new entry
        console.log('Creating new progress entry');
        const { error: insertError } = await this.supabase
          .from('task_input_history')
          .insert({
            task_id: taskId,
            user_id: user.id,
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
            hint: insertError.hint,
            environment: process.env.NODE_ENV
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
        stack: error instanceof Error ? error.stack : undefined,
        environment: process.env.NODE_ENV,
        connectionStatus: this.isConnected
      });
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('task_input_history')
        .select('id')
        .limit(1);
      
      const isConnected = !error;
      
      console.log('Supabase Connection Test:', {
        url: process.env.VITE_SUPABASE_URL || 'URL not available',
        isConnected,
        origin: typeof window !== 'undefined' ? window.location.origin : 'server',
        environment: process.env.NODE_ENV,
        error: error || 'None'
      });

      return isConnected;
    } catch (err) {
      console.error('Connection test failed:', {
        error: err,
        environment: process.env.NODE_ENV,
        origin: typeof window !== 'undefined' ? window.location.origin : 'server'
      });
      return false;
    }
  }
} 