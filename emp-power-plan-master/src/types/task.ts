export interface Task {
  id: string;
  title: string;
  description: string;
  assigned_to: string;
  assigned_by: string;
  team_id: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'needs_improvement' | 'rejected';
  review_status: 'pending' | 'needs_improvement' | 'accepted' | 'rejected';
  due_date: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  work_done?: string;
  progress?: TaskProgress;
}

export interface CompletedTask extends Omit<Task, 'status' | 'review_status' | 'progress'> {
  status: 'completed';
  review_status: 'accepted';
  accepted_at: string;
  accepted_by: string;
  progress?: TaskProgress;
}

export interface TaskProgress {
  id: string;
  task_id: string;
  user_id: string;
  text: string;
  created_at: string;
  updated_at: string;
  taskId?: string;
  userId?: string;
  currentText?: string;
  lastUpdated?: Date;
  progressPercentage?: number;
}

export interface TaskInputHistory {
  id: string;
  task_id: string;
  user_id: string;
  input_text: string;
  progress: number;
  created_at: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'task_assigned' | 'task_updated' | 'task_completed' | 'task_review_accepted' | 'task_review_rejected' | 'task_review_needs_improvement';
  read: boolean;
  createdAt: string;
  taskId?: string;
} 