export type UserRole = 'admin' | 'team_lead' | 'team_member';

export interface User {
  id: string;           // Unique identifier for the user
  name: string;         // Full name of the user
  email: string;        // Email address used for login and notifications
  role: UserRole;       // User's role in the system, determines permissions
  team_id: string | null; // Team this user belongs to (null for admins)
  avatar?: string;      // URL to user's profile picture
}

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskReviewStatus = 'pending' | 'accepted' | 'rejected' | 'needs_improvement';
export type AutomaticTaskStatus = 'pending' | 'assigned';

export interface TaskProgress {
  taskId: string;
  userId: string;
  currentText: string;
  lastUpdated: Date;
  progressPercentage: number;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string;
  team_id: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  review_status: 'pending' | 'accepted' | 'rejected' | 'needs_improvement';
  due_date: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  progress?: TaskProgress;
}

export interface AutomaticTask {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTime?: number;
  teamId?: string;
  status: 'pending' | 'assigned';
  assignedTo?: string;
  assignedBy?: string;
  assignedAt?: string;
  createdAt: string;
  updatedAt?: string;
  dueDate?: string;
}

export interface TaskAssignmentLog {
  id: string;
  taskId: string;
  assignedTo: string;
  assignedBy: string;
  assignedAt: string;
  automaticAssignment: boolean;
}

export interface Team {
  id: string;
  name: string;
  leadId: string;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface Performance {
  userId: string;
  completedTasks: number;
  onTimeCompletion: number;
  averageTaskDuration: number;
}

export interface NormalizedPerformance extends Performance {
  normalizedScore: number;
  performanceCategory: string;
  performanceColor: string;
}

export * from './performance';
