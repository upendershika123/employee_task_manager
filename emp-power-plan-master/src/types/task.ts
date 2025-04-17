export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string;
  team_id: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  due_date: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface TaskInputHistory {
  id: string;
  task_id: string;
  input_text: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'task_assigned' | 'task_updated' | 'task_completed' | 'task_review_accepted' | 'task_review_rejected' | 'task_review_needs_improvement';
  task_id?: string;
  created_at: string;
  read: boolean;
} 