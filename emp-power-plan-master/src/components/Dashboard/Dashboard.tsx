import React, { useState, useEffect } from 'react';
import { useAuth } from '../Auth/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Task, User, Team } from '@/types/index';
import TaskList from '../Tasks/TaskList';
import TaskForm from '../Tasks/TaskForm';
import UserList from '../Users/UserList';
import UserForm from '../Users/UserForm';
import TeamForm from '../Teams/TeamForm';
import { CheckCircle, Clock, ClipboardList, Plus, Users, ChevronDown, RefreshCw, UserMinus } from 'lucide-react';
import { getInitials, calculateCompletionPercentage } from '@/utils/helpers';
import { toast } from 'sonner';
import { useDatabaseService } from '@/services/DatabaseServiceContext';
import UserProfile from '../Users/UserProfile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../Notifications/NotificationBell';
import { notificationService } from '@/services/notificationService';
import { sendGridService } from '@/services/sendGridService';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import UserDetailsModal from '@/components/User/UserDetailsModal';
import { format } from 'date-fns';
import DeleteUserModal from '../Users/DeleteUserModal';

const Dashboard: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const databaseService = useDatabaseService();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [showNewUserDialog, setShowNewUserDialog] = useState(false);
  const [showNewTeamDialog, setShowNewTeamDialog] = useState(false);
  const [showUserProfileDialog, setShowUserProfileDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('tasks');
  const [selectedOption, setSelectedOption] = useState<string>('home');
  const [isUserDetailsOpen, setIsUserDetailsOpen] = useState(false);
  const [showTeamSelectionDialog, setShowTeamSelectionDialog] = useState(false);
  const [showDeleteUserDialog, setShowDeleteUserDialog] = useState(false);
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const [allTasks, allUsers, allTeams] = await Promise.all([
          databaseService.getTasks(),
          databaseService.getUsers(),
          databaseService.getTeams(),
        ]);

        // Find the current user's full data from the users array
        const currentUserData = allUsers.find(u => u.id === user.id);
        
        if (currentUserData && currentUserData.team_id !== user.team_id) {
          // Update the local user state
          user.team_id = currentUserData.team_id;
        }
        
        setTasks(allTasks);
        setUsers(allUsers);
        setTeams(allTeams);
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load data');
      }
    };
    
    loadData();
  }, [databaseService, user.id]);
  
  // Add automatic task checking
  useEffect(() => {
    const checkAutomaticTasks = async () => {
      try {
        // Use the checkAndAssignAutomaticTasks method from the database service
        await databaseService.checkAndAssignAutomaticTasks();
        
        // Reload tasks after automatic assignment
        const updatedTasks = await databaseService.getTasks();
        setTasks(updatedTasks);
      } catch (error) {
        console.error('Error checking automatic tasks:', error);
      }
    };

    // Check immediately on component mount
    checkAutomaticTasks();

    // Set up interval to check every 5 minutes
    const interval = setInterval(checkAutomaticTasks, 5 * 60 * 1000);

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [databaseService]);
  
  useEffect(() => {
    // Show team selection dialog if team lead is not assigned to a team
    if (user.role === 'team_lead' && !user.team_id && teams.length > 0) {
      setShowTeamSelectionDialog(true);
    }
  }, [user.role, user.team_id, teams]);
  
  if (!user) {
    return null;
  }
  
  const userTasks = user.role === 'admin'
    ? tasks // Admin can see all tasks
    : user.role === 'team_lead'
      ? tasks.filter(task => 
          task.assigned_by === user.id || // Tasks created by this team lead
          task.assigned_to === user.id || // Tasks assigned to this team lead
          (task.team_id === user.team_id) // Tasks within their team
        )
      : tasks.filter(task => task.assigned_to === user.id); // Team members only see tasks assigned to them
      
  // Filter users for display in the UserList component
  const usersByRole = user.role === 'admin'
    ? users // Admin sees all users
    : user.role === 'team_lead'
      ? users.filter(u => {
          const isInTeam = u.team_id === user.team_id;
          return isInTeam;
        })
      : []; // Team members don't see the user list

  // Filter team members for task assignment
  const teamMembers = user.role === 'admin'
    ? users // Admin can assign to any user
    : user.role === 'team_lead' && user.team_id
      ? users.filter(u => u.team_id === user.team_id) // Team leads see their team members
      : [];
  
  const completedTasks = userTasks.filter(task => task.status === 'completed').length;
  const pendingTasks = userTasks.filter(task => task.status === 'pending').length;
  const inProgressTasks = userTasks.filter(task => task.status === 'in_progress').length;
  const completionPercentage = calculateCompletionPercentage(completedTasks, userTasks.length);
  
  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      const updatedTask = await databaseService.updateTask(taskId, updates);
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? updatedTask : task
        )
      );
      
      // If the task is being marked as completed, send an email notification
      if (updates.status === 'completed' && user) {
        try {
          const task = await databaseService.getTaskById(taskId);
          if (task && task.assigned_by) {
            // Get both the assigned by user and the completing user
            const [assignedByUser, completedByUser] = await Promise.all([
              databaseService.getUserById(task.assigned_by),
              databaseService.getUserById(task.assigned_to || '')
            ]);

            if (assignedByUser && completedByUser) {
              await sendGridService.sendTaskCompletionEmail(
                task,
                completedByUser,
                assignedByUser
              );
            }
          }
        } catch (emailError) {
          console.error('Error sending task completion email:', emailError);
          // Don't throw the error as the task update was successful
        }
      }
      
      toast.success('Task updated successfully');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };
  
  const handleCreateTask = async (taskData: Partial<Task>) => {
    try {
      // Prevent team members from creating tasks
      if (user.role === 'team_member') {
        toast.error("Team members cannot create tasks. You can only work on tasks assigned to you.");
        return;
      }
      
      // First, verify that we have an assigned user
      if (!taskData.assigned_to) {
        toast.error("Please select a team member to assign the task");
        return;
      }

      // Get the assigned user's details
      const assignedUser = users.find(u => u.id === taskData.assigned_to);
      if (!assignedUser) {
        toast.error("Selected team member not found");
        return;
      }

      // Ensure the assigned user has a team_id
      if (!assignedUser.team_id && user.role !== 'admin') {
        toast.error("Selected team member is not assigned to any team");
        return;
      }

      // Validate assignment based on user role
      if (user.role === 'team_lead') {
        // Team leads can only assign to team members in their team
        if (assignedUser.team_id !== user.team_id) {
          toast.error("You can only assign tasks to members of your team");
          return;
        }
        if (assignedUser.role === 'team_lead') {
          toast.error("Team leads can only assign tasks to team members");
          return;
        }
      }

      // Create the task with all required fields
      const now = new Date();
      const taskToCreate: Partial<Task> = {
        ...taskData,
        assigned_by: user.id,
        team_id: assignedUser.team_id,
        created_at: format(now, 'yyyy-MM-dd'),
        updated_at: format(now, 'yyyy-MM-dd'),
        status: 'pending',
        review_status: 'pending'
      };
      
      const newTask = await databaseService.createTask(taskToCreate);
      setTasks(prevTasks => [...prevTasks, newTask]);

      // Send task assignment notification
      try {
        await notificationService.sendTaskAssignmentEmail(assignedUser, newTask, user);
      } catch (notificationError) {
        console.error('Error sending task assignment notification:', notificationError);
        // Don't throw the error as the task creation was successful
      }

      setShowNewTaskDialog(false);
      toast.success('Task created successfully');
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    }
  };
  
  const handleCreateUser = async (userData: Partial<User>) => {
    try {
      // For team leads, ensure team members are assigned to their team
      if (user?.role === 'team_lead' && user?.team_id) {
        userData.team_id = user.team_id;
      }
      
      // Ensure the user has the correct team_id based on selected team
      if (userData.team_id) {
        const selectedTeam = teams.find(team => team.id === userData.team_id);
        if (!selectedTeam) {
          toast.error("Selected team not found");
          throw new Error("Selected team not found");
        }
      }
      
      const newUser = await databaseService.createUser(userData);
      setUsers(prevUsers => [...prevUsers, newUser]);
      setShowNewUserDialog(false);
      toast.success(`${userData.role === 'team_lead' ? 'Team Lead' : 'Team Member'} added successfully`);
      
      return newUser; // Return the created user
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to add user');
      throw error; // Re-throw the error to be handled by the form
    }
  };
  
  const getAvailableTeamMembers = () => {
    if (user.role === 'admin') {
      // For admins, show all team members and team leads
      return users.filter(u => 
        u.role === 'team_member' || u.role === 'team_lead'
      );
    } else if (user.role === 'team_lead' && user.team_id) {
      // For team leads, only show members from their team
      return users.filter(u => 
        u.team_id === user.team_id && u.role === 'team_member'
      );
    }
    return [];
  };

  const getAvailableTeamLeads = () => {
    // Only admins can be team leads, or users who are not already team leads
    return users.filter(u => u.role === 'admin' || (u.role !== 'team_lead' && !u.team_id));
  };
  
  const handleViewUserProfile = (userId: string) => {
    setSelectedUserId(userId);
    setShowUserProfileDialog(true);
  };
  
  const handleCreateTeam = async (teamData: Partial<Team>) => {
    try {
      const newTeam = await databaseService.createTeam(teamData);
      setTeams(prevTeams => [...prevTeams, newTeam]);
      setShowNewTeamDialog(false);
      toast.success('Team created successfully');
    } catch (error) {
      console.error('Error creating team:', error);
      toast.error('Failed to create team');
    }
  };
  
  const handleHomeOptionChange = (value: string) => {
    setSelectedOption(value);
    switch (value) {
      case 'home':
        navigate('/');
        break;
      case 'dashboard':
        navigate('/dashboard');
        break;
      case 'completed-tasks':
        navigate('/completed-tasks');
        break;
      case 'automatic-tasks':
        navigate('/automatic-tasks');
        break;
      case 'performance':
        navigate('/performance');
        break;
    }
  };
  
  const handleRefresh = async () => {
    try {
      const [allTasks, allUsers, allTeams] = await Promise.all([
        databaseService.getTasks(),
        databaseService.getUsers(),
        databaseService.getTeams(),
      ]);
      setTasks(allTasks);
      setUsers(allUsers);
      setTeams(allTeams);
      toast.success('Data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh data');
    }
  };
  
  const handleTaskClick = (taskId: string) => {
    navigate(`/tasks/${taskId}`);
  };
  
  const handleTeamSelection = async (teamId: string) => {
    try {
      // Update the user's team_id
      const updatedUser = await databaseService.updateUser(user.id, {
        team_id: teamId
      });
      
      // Update the local user state through auth context (if available)
      if (typeof updateUser === 'function') {
        updateUser(updatedUser);
      }
      
      setShowTeamSelectionDialog(false);
      toast.success('Successfully assigned to team');
      
      // Refresh the data
      handleRefresh();
    } catch (error) {
      console.error('Error assigning team:', error);
      toast.error('Failed to assign team');
    }
  };
  
  const handleDeleteUser = async (userId: string, adminPassword: string) => {
    try {
      await databaseService.deleteUser(userId, adminPassword);
      
      // Update local state
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
      
      // If the deleted user was a team lead, their team has been deleted
      const deletedUser = users.find(u => u.id === userId);
      if (deletedUser?.role === 'team_lead' && deletedUser.team_id) {
        setTeams(prevTeams => prevTeams.filter(t => t.id !== deletedUser.team_id));
      }
      
      toast.success('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      // Error handling is done in the service
    }
  };
  
  return (
    <>
      <div className="container mx-auto p-4">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {user.name}
            </p>
            <div className="flex items-center mt-2">
              <Select
                value={selectedOption}
                onValueChange={handleHomeOptionChange}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Home" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="dashboard">Dashboard</SelectItem>
                  <SelectItem value="completed-tasks">Completed Tasks</SelectItem>
                  {user?.role !== 'team_member' && (
                    <SelectItem value="automatic-tasks">Automatic Tasks</SelectItem>
                  )}
                  <SelectItem value="performance">Performance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <NotificationBell />
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Avatar>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-right">
              <button
                onClick={() => setIsUserDetailsOpen(true)}
                className="text-sm font-medium hover:underline"
              >
                {user.name}
              </button>
              <p className="text-xs text-muted-foreground">
                {user.role.replace('_', ' ')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              Log out
            </Button>
          </div>
        </header>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userTasks.length}</div>
              <p className="text-xs text-muted-foreground">
                Assigned to {user.role === 'team_member' ? 'you' : 'your team'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedTasks}</div>
              <Progress value={completionPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {completionPercentage}% completion rate
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inProgressTasks}</div>
              <p className="text-xs text-muted-foreground">
                {pendingTasks} pending tasks
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{user.role === 'team_member' ? '-' : teamMembers.length}</div>
              <p className="text-xs text-muted-foreground">
                In {user.role === 'admin' ? 'all teams' : 'your team'}
              </p>
            </CardContent>
          </Card>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              {(user.role === 'admin' || user.role === 'team_lead') && (
                <TabsTrigger value="team">Team</TabsTrigger>
              )}
            </TabsList>
            
            <div className="flex gap-2">
              {user.role === 'admin' && (
                <Dialog open={showNewTeamDialog} onOpenChange={setShowNewTeamDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Team
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
                      <DialogTitle>Create New Team</DialogTitle>
                    </DialogHeader>
                    <div className="pt-4">
                      <TeamForm 
                        onSubmit={handleCreateTeam} 
                        availableLeads={getAvailableTeamLeads()}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {(user.role === 'admin' || user.role === 'team_lead') && activeTab === 'tasks' && (
                <Dialog open={showNewTaskDialog} onOpenChange={setShowNewTaskDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
                      <DialogTitle>Create New Task</DialogTitle>
                    </DialogHeader>
                    <div className="pt-4">
                      <TaskForm 
                        onSubmit={handleCreateTask} 
                        teamMembers={getAvailableTeamMembers()}
                        currentUser={user}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              
              {(user.role === 'admin' || user.role === 'team_lead') && activeTab === 'team' && (
                <div className="flex gap-2">
                  <Dialog open={showNewUserDialog} onOpenChange={setShowNewUserDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        {user.role === 'admin' ? 'Add User' : 'Add Team Member'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                      <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
                        <DialogTitle>
                          {user.role === 'admin' ? 'Add New User' : 'Add Team Member'}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="pt-4">
                        <UserForm 
                          onSubmit={handleCreateUser}
                          teams={teams}
                          currentUser={user}
                        />
                      </div>
                    </DialogContent>
                  </Dialog>

                  {user.role === 'admin' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setShowDeleteUserDialog(true)}
                    >
                      <UserMinus className="h-4 w-4 mr-2" />
                      Delete User
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <TabsContent value="tasks" className="space-y-4">
            <TaskList
              tasks={userTasks}
              onTaskUpdate={handleTaskUpdate}
              onTaskClick={handleTaskClick}
            />
          </TabsContent>
          
          {(user.role === 'admin' || user.role === 'team_lead') && (
            <TabsContent value="team" className="space-y-4">
              <UserList 
                users={user.role === 'admin' ? users : usersByRole} 
                teams={teams}
                onViewProfile={handleViewUserProfile}
              />
            </TabsContent>
          )}
        </Tabs>

        <Dialog open={showUserProfileDialog} onOpenChange={setShowUserProfileDialog}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
              <DialogTitle>User Profile</DialogTitle>
            </DialogHeader>
            {selectedUserId && (
              <UserProfile 
                userId={selectedUserId}
                userTasks={tasks.filter(task => 
                  task.assigned_to === selectedUserId || 
                  task.assigned_by === selectedUserId
                )}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
      <UserDetailsModal
        user={user}
        isOpen={isUserDetailsOpen}
        onClose={() => setIsUserDetailsOpen(false)}
        teams={teams}
        users={users}
      />
      
      <Dialog open={showTeamSelectionDialog} onOpenChange={setShowTeamSelectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Your Team</DialogTitle>
            <DialogDescription>
              As a team lead, you need to be assigned to a team. Please select your team from the list below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {teams.map((team) => (
              <Button
                key={team.id}
                onClick={() => handleTeamSelection(team.id)}
                variant="outline"
                className="justify-start"
              >
                {team.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {user.role === 'admin' && (
        <DeleteUserModal
          isOpen={showDeleteUserDialog}
          onClose={() => setShowDeleteUserDialog(false)}
          onConfirm={handleDeleteUser}
          users={users}
          teams={teams}
          currentUser={user}
        />
      )}
    </>
  );
};

export default Dashboard;
