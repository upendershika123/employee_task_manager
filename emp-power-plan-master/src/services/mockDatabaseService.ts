import { DatabaseService } from './types';
import { User, Task, Team, Performance, AutomaticTask, TaskAssignmentLog, TaskPriority, AutomaticTaskStatus } from '../types';
import { mockUsers, mockTasks, mockTeams } from '../utils/mockData';

class MockDatabaseService implements DatabaseService {
  private users: User[] = [...mockUsers];
  private tasks: Task[] = [...mockTasks];
  private teams: Team[] = [...mockTeams];
  private performances: Performance[] = [];
  private automaticTasks: AutomaticTask[] = [];
  private taskAssignmentLogs: TaskAssignmentLog[] = [];

  // User operations
  async getUsers(): Promise<User[]> {
    return [...this.users];
  }

  async getUserById(id: string): Promise<User | null> {
    const user = this.users.find(u => u.id === id);
    return user ? { ...user } : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    return user ? { ...user } : null;
  }

  async createUser(userData: Partial<User>): Promise<User> {
    // Ensure we always have an ID for new users
    if (!userData.id) {
      userData.id = `user-${Date.now()}`;
    }
    
    console.log('Creating user with data:', userData);
    
    const newUser: User = {
      id: userData.id,
      name: userData.name || '',
      email: userData.email || '',
      role: userData.role || 'team_member',
      teamId: userData.teamId,
      avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'User')}`,
    };
    
    // Log the created user before adding to the database
    console.log('New user being added to database:', newUser);
    
    this.users.push(newUser);
    return { ...newUser };
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const index = this.users.findIndex(u => u.id === id);
    if (index === -1) {
      throw new Error(`User with id ${id} not found`);
    }
    
    const updatedUser = {
      ...this.users[index],
      ...updates,
    };
    
    this.users[index] = updatedUser;
    return { ...updatedUser };
  }

  // Team operations
  async getTeams(): Promise<Team[]> {
    return [...this.teams];
  }

  async getTeamById(id: string): Promise<Team | null> {
    const team = this.teams.find(t => t.id === id);
    return team ? { ...team } : null;
  }

  async createTeam(teamData: Partial<Team>): Promise<Team> {
    if (!teamData.id) {
      teamData.id = `team-${Date.now()}`;
    }
    
    const newTeam: Team = {
      id: teamData.id,
      name: teamData.name || '',
      leadId: teamData.leadId || '',
    };
    
    this.teams.push(newTeam);
    return { ...newTeam };
  }

  async updateTeam(id: string, updates: Partial<Team>): Promise<Team> {
    const index = this.teams.findIndex(t => t.id === id);
    if (index === -1) {
      throw new Error(`Team with id ${id} not found`);
    }
    
    const updatedTeam = {
      ...this.teams[index],
      ...updates,
    };
    
    this.teams[index] = updatedTeam;
    return { ...updatedTeam };
  }

  // Task operations
  async getTasks(): Promise<Task[]> {
    return [...this.tasks];
  }

  async getTaskById(id: string): Promise<Task | null> {
    const task = this.tasks.find(t => t.id === id);
    return task ? { ...task } : null;
  }

  async getTasksByUserId(userId: string): Promise<Task[]> {
    return this.tasks.filter(t => t.assigned_to === userId).map(t => ({ ...t }));
  }

  async getTasksByTeamId(teamId: string): Promise<Task[]> {
    return this.tasks.filter(t => t.teamId === teamId).map(t => ({ ...t }));
  }

  async createTask(taskData: Partial<Task>): Promise<Task> {
    if (!taskData.id) {
      taskData.id = `task-${Date.now()}`;
    }
    
    const newTask: Task = {
      id: taskData.id,
      title: taskData.title || '',
      description: taskData.description || null,
      assigned_to: taskData.assigned_to || '',
      assigned_by: taskData.assigned_by || '',
      priority: taskData.priority || 'medium',
      status: taskData.status || 'pending',
      review_status: taskData.review_status || 'pending',
      due_date: taskData.due_date || new Date().toISOString(),
      created_at: taskData.created_at || new Date().toISOString(),
      updated_at: taskData.updated_at || new Date().toISOString(),
      completed_at: taskData.completed_at,
      team_id: taskData.team_id || '',
    };
    
    this.tasks.push(newTask);
    return { ...newTask };
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) {
      throw new Error(`Task with id ${id} not found`);
    }
    
    // If task is being marked as completed, set completedAt
    if (updates.status === 'completed' && this.tasks[index].status !== 'completed') {
      updates.completed_at = new Date().toISOString();
    }
    
    // Always update the updatedAt timestamp
    updates.updated_at = new Date().toISOString();
    
    const updatedTask = {
      ...this.tasks[index],
      ...updates,
    };
    
    this.tasks[index] = updatedTask;
    return { ...updatedTask };
  }

  // Performance operations
  async getPerformanceMetrics(): Promise<Performance[]> {
    return [...this.performances];
  }

  async getPerformanceByUserId(userId: string): Promise<Performance | null> {
    const performance = this.performances.find(p => p.userId === userId);
    return performance ? { ...performance } : null;
  }

  // Automatic Task operations
  async getAutomaticTasks(): Promise<AutomaticTask[]> {
    return [...this.automaticTasks];
  }

  async getAutomaticTaskById(id: string): Promise<AutomaticTask | null> {
    return this.automaticTasks.find(task => task.taskId === id) || null;
  }

  async getPendingAutomaticTasks(): Promise<AutomaticTask[]> {
    return this.automaticTasks
      .filter(task => task.status === 'pending')
      .sort((a, b) => {
        // Sort by priority (high > medium > low)
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        // Then by creation date (oldest first)
        return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime();
      });
  }

  async createAutomaticTask(task: Partial<AutomaticTask>): Promise<AutomaticTask> {
    const taskId = `task-${Date.now()}`;
    const now = new Date().toISOString();
    
    const newTask: AutomaticTask = {
      taskId,
      taskTitle: task.taskTitle || '',
      taskDescription: task.taskDescription,
      priority: task.priority || 'medium',
      estimatedTime: task.estimatedTime || 1,
      created_at: now,
      status: task.status || 'pending',
      assignedTo: task.assignedTo,
      assignedBy: task.assignedBy,
      assignedAt: task.assignedAt,
      teamId: task.teamId || null,
      dueDate: task.dueDate,
    };
    
    this.automaticTasks.push(newTask);
    return { ...newTask };
  }

  async updateAutomaticTask(id: string, updates: Partial<AutomaticTask>): Promise<AutomaticTask> {
    const index = this.automaticTasks.findIndex(task => task.taskId === id);
    if (index === -1) {
      throw new Error('Task not found');
    }
    
    const updatedTask = {
      ...this.automaticTasks[index],
      ...updates,
    };
    
    this.automaticTasks[index] = updatedTask;
    return { ...updatedTask };
  }

  async assignAutomaticTask(taskId: string, userId: string, assignedBy: string): Promise<AutomaticTask> {
    // First, get the task to check its status and team
    const task = await this.getAutomaticTaskById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    
    if (task.status !== 'pending') {
      throw new Error('Task is not in pending status');
    }
    
    if (!task.teamId) {
      throw new Error('Task has no team assigned');
    }
    
    // If userId is empty, we'll use the automatic assignment logic
    if (!userId) {
      // Get team members for the task's team
      const teamMembers = this.users.filter(user => user.teamId === task.teamId);
      
      // Filter out team leads and admins
      const availableMembers = teamMembers.filter(
        member => member.role === 'team_member'
      );
      
      if (availableMembers.length === 0) {
        // No team members available, assign to team lead
        const team = await this.getTeamById(task.teamId);
        if (!team || !team.leadId) {
          throw new Error('Team lead not found');
        }
        
        // Assign to team lead
        return this.updateAutomaticTask(taskId, {
          status: 'assigned',
          assignedTo: team.leadId,
          assignedBy,
          assignedAt: new Date().toISOString(),
        });
      }
      
      // Sort by priority and find the least busy team member
      // For simplicity, we'll just pick the first available member
      const selectedMember = availableMembers[0];
      
      // Assign to the selected team member
      return this.updateAutomaticTask(taskId, {
        status: 'assigned',
        assignedTo: selectedMember.id,
        assignedBy,
        assignedAt: new Date().toISOString(),
      });
    } else {
      // Manual assignment to a specific user
      return this.updateAutomaticTask(taskId, {
        status: 'assigned',
        assignedTo: userId,
        assignedBy,
        assignedAt: new Date().toISOString(),
      });
    }
  }

  async getTaskAssignmentLogs(): Promise<TaskAssignmentLog[]> {
    return [...this.taskAssignmentLogs];
  }

  // Add testConnection method
  async testConnection(): Promise<boolean> {
    return true; // Mock service always returns true
  }
}

export const mockDatabaseService = new MockDatabaseService();
