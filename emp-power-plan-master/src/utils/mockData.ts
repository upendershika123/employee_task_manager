
import { User, Task, Team, Performance, UserRole, TaskPriority, TaskStatus } from '../types';

// Helper function to create a random ID
const createId = () => Math.random().toString(36).substring(2, 9);

// Helper function to create a random date within the last month
const randomDate = (start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end = new Date()) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
};

// Mock Teams
export const mockTeams: Team[] = [
  { id: 'team1', name: 'Product Development', leadId: 'user2' },
  { id: 'team2', name: 'Marketing', leadId: 'user5' },
  { id: 'team3', name: 'Customer Support', leadId: 'user8' },
];

// Mock Users
export const mockUsers: User[] = [
  { id: 'user1', name: 'Admin User', email: 'admin@example.com', role: 'admin' },
  { id: 'user2', name: 'John Lead', email: 'john@example.com', role: 'team_lead', teamId: 'team1', avatar: 'https://ui-avatars.com/api/?name=John+Lead' },
  { id: 'user3', name: 'Alice Member', email: 'alice@example.com', role: 'team_member', teamId: 'team1', avatar: 'https://ui-avatars.com/api/?name=Alice+Member' },
  { id: 'user4', name: 'Bob Member', email: 'bob@example.com', role: 'team_member', teamId: 'team1', avatar: 'https://ui-avatars.com/api/?name=Bob+Member' },
  { id: 'user5', name: 'Sarah Lead', email: 'sarah@example.com', role: 'team_lead', teamId: 'team2', avatar: 'https://ui-avatars.com/api/?name=Sarah+Lead' },
  { id: 'user6', name: 'Mike Member', email: 'mike@example.com', role: 'team_member', teamId: 'team2', avatar: 'https://ui-avatars.com/api/?name=Mike+Member' },
  { id: 'user7', name: 'Emily Member', email: 'emily@example.com', role: 'team_member', teamId: 'team2', avatar: 'https://ui-avatars.com/api/?name=Emily+Member' },
  { id: 'user8', name: 'Chris Lead', email: 'chris@example.com', role: 'team_lead', teamId: 'team3', avatar: 'https://ui-avatars.com/api/?name=Chris+Lead' },
  { id: 'user9', name: 'David Member', email: 'david@example.com', role: 'team_member', teamId: 'team3', avatar: 'https://ui-avatars.com/api/?name=David+Member' },
];

// Task priorities and statuses for random selection
const priorities: TaskPriority[] = ['high', 'medium', 'low'];
const statuses: TaskStatus[] = ['pending', 'in_progress', 'completed'];

// Generate random tasks
export const generateMockTasks = (count = 20): Task[] => {
  const tasks: Task[] = [];
  
  for (let i = 0; i < count; i++) {
    const teamIndex = Math.floor(Math.random() * mockTeams.length);
    const team = mockTeams[teamIndex];
    
    // Filter users from this team
    const teamMembers = mockUsers.filter(user => user.teamId === team.id && user.role === 'team_member');
    const assignedTo = teamMembers[Math.floor(Math.random() * teamMembers.length)].id;
    
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const createdAt = randomDate();
    const updatedAt = new Date(new Date(createdAt).getTime() + Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString();
    
    const task: Task = {
      id: createId(),
      title: `Task ${i + 1} for ${team.name}`,
      description: `This is a description for task ${i + 1}. It contains details about what needs to be done.`,
      assignedTo,
      assignedBy: team.leadId,
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      status,
      dueDate: new Date(new Date(createdAt).getTime() + (7 + Math.floor(Math.random() * 14)) * 24 * 60 * 60 * 1000).toISOString(),
      createdAt,
      updatedAt,
      completedAt: status === 'completed' ? updatedAt : undefined,
      teamId: team.id,
    };
    
    tasks.push(task);
  }
  
  return tasks;
};

export const mockTasks: Task[] = generateMockTasks();

// Generate performance metrics
export const generateMockPerformance = (): Performance[] => {
  return mockUsers
    .filter(user => user.role === 'team_member')
    .map(user => {
      const userTasks = mockTasks.filter(task => task.assignedTo === user.id);
      const completedTasks = userTasks.filter(task => task.status === 'completed').length;
      
      return {
        userId: user.id,
        completedTasks,
        onTimeCompletion: Math.floor(Math.random() * 100),
        averageTaskDuration: Math.floor(Math.random() * 5) + 2, // 2-7 days
        period: 'last30days',
      };
    });
};

export const mockPerformance: Performance[] = generateMockPerformance();

// Helper to get user by id
export const getUserById = (id: string): User | undefined => {
  return mockUsers.find(user => user.id === id);
};

// Helper to get team by id
export const getTeamById = (id: string): Team | undefined => {
  return mockTeams.find(team => team.id === id);
};

// Helper to get tasks for a user
export const getTasksForUser = (userId: string): Task[] => {
  return mockTasks.filter(task => task.assignedTo === userId);
};

// Helper to get tasks for a team
export const getTasksForTeam = (teamId: string): Task[] => {
  return mockTasks.filter(task => task.teamId === teamId);
};

// Helper to get team members
export const getTeamMembers = (teamId: string): User[] => {
  return mockUsers.filter(user => user.teamId === teamId);
};

// Get team lead for a team
export const getTeamLead = (teamId: string): User | undefined => {
  const team = getTeamById(teamId);
  return team ? getUserById(team.leadId) : undefined;
};

// Get current user (simulating a logged-in user)
// You can change this to test different roles
export const getCurrentUser = (): User => {
  return mockUsers[0]; // Admin by default
};
