import React, { useState, useEffect } from 'react';
import { useAuth } from '../Auth/AuthContext';
import { useDatabaseService } from '../../services/DatabaseServiceContext';
import { AutomaticTask, User, Team } from '../../types';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, CalendarIcon } from 'lucide-react';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const AutomaticTasksPage: React.FC = () => {
  const { user } = useAuth();
  const databaseService = useDatabaseService();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<AutomaticTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [newTask, setNewTask] = useState({
    taskTitle: '',
    taskDescription: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    teamId: '',
    dueDate: undefined as Date | undefined,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [tasksData, usersData, teamsData, currentUserData] = await Promise.all([
          databaseService.getAutomaticTasks(),
          databaseService.getUsers(),
          databaseService.getTeams(),
          user ? databaseService.getUserById(user.id) : null,
        ]);
        setTasks(tasksData);
        setUsers(usersData);
        setTeams(teamsData);
        setCurrentUser(currentUserData);
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [databaseService, user]);

  const handleCreateTask = async () => {
    try {
      if (!currentUser) {
        toast.error('You must be logged in to create tasks');
        return;
      }

      if (currentUser.role !== 'admin' && currentUser.role !== 'team_lead') {
        toast.error('You do not have permission to create tasks');
        return;
      }

      if (!newTask.taskTitle.trim()) {
        toast.error('Task title is required');
        return;
      }

      if (!newTask.teamId) {
        toast.error('Team selection is required');
        return;
      }

      if (!newTask.dueDate) {
        toast.error('Due date is required');
        return;
      }

      // For team leads, ensure they're creating task for their own team
      if (currentUser.role === 'team_lead' && currentUser.teamId !== newTask.teamId) {
        toast.error('You can only create tasks for your own team');
        return;
      }

      const task = await databaseService.createAutomaticTask({
        ...newTask,
        taskTitle: newTask.taskTitle.trim(),
        taskDescription: newTask.taskDescription.trim(),
        status: 'pending',
      });
      
      setTasks(prev => [...prev, task]);
      setShowNewTaskDialog(false);
      setNewTask({
        taskTitle: '',
        taskDescription: '',
        priority: 'medium',
        teamId: '',
        dueDate: undefined,
      });
      
      toast.success('Task created successfully');
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast.error(error.message || 'Failed to create task');
    }
  };

  const handleAssignTask = async (taskId: string) => {
    try {
      const task = await databaseService.assignAutomaticTask(taskId, '', user?.id || '');
      setTasks(prev => prev.map(t => t.taskId === taskId ? task : t));
      toast.success('Task assigned successfully');
    } catch (error) {
      console.error('Error assigning task:', error);
      toast.error('Failed to assign task');
    }
  };

  const handleBackToDashboard = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleBackToDashboard}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Automatic Tasks</h1>
            <p className="text-muted-foreground">
              Manage and monitor automatic task assignments
            </p>
          </div>
        </div>
        {currentUser && (currentUser.role === 'admin' || currentUser.role === 'team_lead') && (
          <Button onClick={() => setShowNewTaskDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tasks.map(task => (
          <Card key={task.taskId}>
            <CardHeader>
              <CardTitle>{task.taskTitle}</CardTitle>
              <CardDescription>{task.taskDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Priority:</span>
                  <span className={`text-sm ${
                    task.priority === 'high' ? 'text-red-500' :
                    task.priority === 'medium' ? 'text-yellow-500' :
                    'text-green-500'
                  }`}>
                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <span className={`text-sm ${
                    task.status === 'pending' ? 'text-yellow-500' :
                    task.status === 'assigned' ? 'text-blue-500' :
                    'text-green-500'
                  }`}>
                    {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Estimated Time:</span>
                  <span className="text-sm">{task.estimatedTime} hours</span>
                </div>
                {task.assignedTo && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Assigned To:</span>
                    <span className="text-sm">
                      {users.find(u => u.id === task.assignedTo)?.name || 'Unknown'}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              {task.status === 'pending' && (
                <Button 
                  className="w-full" 
                  onClick={() => handleAssignTask(task.taskId)}
                >
                  Assign Task
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {showNewTaskDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create New Automatic Task</CardTitle>
              <CardDescription>
                Fill in the details for the new automatic task
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="taskTitle">Task Title</Label>
                <Input
                  id="taskTitle"
                  value={newTask.taskTitle}
                  onChange={e => setNewTask(prev => ({ ...prev, taskTitle: e.target.value }))}
                  placeholder="Enter task title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taskDescription">Description</Label>
                <Input
                  id="taskDescription"
                  value={newTask.taskDescription}
                  onChange={e => setNewTask(prev => ({ ...prev, taskDescription: e.target.value }))}
                  placeholder="Enter task description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value: 'high' | 'medium' | 'low') => 
                    setNewTask(prev => ({ ...prev, priority: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team">Team</Label>
                <Select
                  value={newTask.teamId}
                  onValueChange={(value) => setNewTask(prev => ({ ...prev, teamId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !newTask.dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newTask.dueDate ? format(newTask.dueDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newTask.dueDate}
                      onSelect={(date) => setNewTask(prev => ({ ...prev, dueDate: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewTaskDialog(false);
                  setNewTask({
                    taskTitle: '',
                    taskDescription: '',
                    priority: 'medium',
                    teamId: '',
                    dueDate: undefined,
                  });
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateTask}>Create Task</Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AutomaticTasksPage; 