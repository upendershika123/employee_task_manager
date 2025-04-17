import { User, Task, Team, Performance, AutomaticTask, TaskAssignmentLog } from '../types';

// Database service interface
export interface DatabaseService {
  // Connection test
  testConnection(): Promise<boolean>;

  // User operations
  getUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: Partial<User>): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  
  // Team operations
  getTeams(): Promise<Team[]>;
  getTeamById(id: string): Promise<Team | null>;
  createTeam(team: Partial<Team>): Promise<Team>;
  updateTeam(id: string, updates: Partial<Team>): Promise<Team>;
  
  // Task operations
  getTasks(): Promise<Task[]>;
  getTaskById(id: string): Promise<Task | null>;
  getTasksByUserId(userId: string): Promise<Task[]>;
  getTasksByTeamId(teamId: string): Promise<Task[]>;
  createTask(task: Partial<Task>): Promise<Task>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task>;
  
  // Automatic Task operations
  getAutomaticTasks(): Promise<AutomaticTask[]>;
  getAutomaticTaskById(id: string): Promise<AutomaticTask | null>;
  getPendingAutomaticTasks(): Promise<AutomaticTask[]>;
  createAutomaticTask(task: Partial<AutomaticTask>): Promise<AutomaticTask>;
  updateAutomaticTask(id: string, updates: Partial<AutomaticTask>): Promise<AutomaticTask>;
  assignAutomaticTask(taskId: string, userId: string, assignedBy: string): Promise<AutomaticTask>;
  getTaskAssignmentLogs(): Promise<TaskAssignmentLog[]>;
  checkAndAssignAutomaticTasks(): Promise<void>;
  
  // Performance operations
  getPerformanceMetrics(): Promise<Performance[]>;
  getPerformanceByUserId(userId: string): Promise<Performance | null>;
  
  // Email operations
  sendVerificationEmail(email: string): Promise<void>;
}

// Auth service interface
export interface AuthService {
  login(email: string, password: string): Promise<User | null>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
}
