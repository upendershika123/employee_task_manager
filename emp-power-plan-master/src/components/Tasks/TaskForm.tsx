import React, { useState, useEffect } from 'react';
import { Task, TaskPriority, TaskStatus, User, UserRole } from '../../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TaskFormProps {
  onSubmit: (taskData: Partial<Task>) => void;
  teamMembers: User[];
  initialTask?: Task;
  currentUser: User;
}

const TaskForm: React.FC<TaskFormProps> = ({ 
  onSubmit, 
  teamMembers, 
  initialTask, 
  currentUser 
}) => {
  const [title, setTitle] = useState(initialTask?.title || '');
  const [description, setDescription] = useState(initialTask?.description || '');
  const [assigned_to, setAssignedTo] = useState(initialTask?.assigned_to || '');
  const [priority, setPriority] = useState<TaskPriority>(initialTask?.priority || 'medium');
  const [status, setStatus] = useState<TaskStatus>(initialTask?.status || 'pending');
  const [due_date, setDueDate] = useState<Date | undefined>(
    initialTask?.due_date ? new Date(initialTask.due_date) : undefined
  );
  
  // Filter team members based on user role
  const [filteredTeamMembers, setFilteredTeamMembers] = useState<User[]>([]);
  
  useEffect(() => {
    // Filter team members based on user role and permissions
    let availableMembers: User[] = [];
    
    if (currentUser.role === 'admin') {
      // Admins can assign to team leads and team members
      availableMembers = teamMembers.filter(member => 
        member.role === 'team_lead' || member.role === 'team_member'
      );
    } else if (currentUser.role === 'team_lead' && currentUser.team_id) {
      // Team leads can only assign to team members in their team
      availableMembers = teamMembers.filter(member => 
        member.role === 'team_member' && member.team_id === currentUser.team_id
      );
    } else if (currentUser.role === 'team_member') {
      // Team members cannot assign tasks to anyone
      availableMembers = [];
    }
    
    setFilteredTeamMembers(availableMembers);
    
    // If the current assigned_to is not in the filtered list, reset it
    if (assigned_to && !availableMembers.some(member => member.id === assigned_to)) {
      setAssignedTo('');
    }
  }, [currentUser, teamMembers, assigned_to]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent team members from creating tasks
    if (currentUser.role === 'team_member') {
      toast.error("Team members cannot create tasks. You can only work on tasks assigned to you.");
      return;
    }
    
    if (!title.trim()) {
      toast.error("Please enter a task title");
      return;
    }
    
    if (!description.trim()) {
      toast.error("Please enter a task description");
      return;
    }
    
    if (!assigned_to) {
      toast.error("Please select a team member to assign the task");
      return;
    }
    
    if (!due_date) {
      toast.error("Please select a due date");
      return;
    }
    
    // Get the team ID from the assigned user
    const assignedUser = teamMembers.find(member => member.id === assigned_to);
    if (!assignedUser) {
      toast.error("Selected user not found");
      return;
    }

    // Validate assignment based on user role
    if (currentUser.role === 'team_lead') {
      if (assignedUser.team_id !== currentUser.team_id) {
        toast.error("You can only assign tasks to members of your team");
        return;
      }
      if (assignedUser.role === 'team_lead') {
        toast.error("Team leads can only assign tasks to team members");
        return;
      }
    }
    // Admins can assign to anyone (no additional validation needed)
    
    // Create task data with all required fields
    const now = new Date();
    const taskData: Partial<Task> = {
      title,
      description,
      assigned_to,
      assigned_by: currentUser.id,
      priority,
      status,
      review_status: 'pending',
      due_date: format(due_date, 'yyyy-MM-dd'),
      team_id: assignedUser.team_id,
      created_at: format(now, 'yyyy-MM-dd'),
      updated_at: format(now, 'yyyy-MM-dd'),
      completed_at: status === 'completed' ? format(now, 'yyyy-MM-dd') : null
    };
    
    // Log the task data for debugging
    console.log('Creating task with data:', taskData);
    
    onSubmit(taskData);
    
    if (!initialTask) {
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setPriority('medium');
      setStatus('pending');
      setDueDate(undefined);
    }
  };
  
  // Determine if the user can assign tasks
  const canAssignTasks = currentUser.role === 'admin' || currentUser.role === 'team_lead';
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialTask ? 'Edit Task' : 'Create New Task'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              required
              disabled={!canAssignTasks}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description"
              required
              rows={3}
              disabled={!canAssignTasks}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assign To</Label>
            <Select 
              value={assigned_to} 
              onValueChange={setAssignedTo} 
              required
              disabled={!canAssignTasks || filteredTeamMembers.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !canAssignTasks 
                    ? "You don't have permission to assign tasks" 
                    : filteredTeamMembers.length === 0 
                      ? "No eligible team members available" 
                      : "Select team member"
                } />
              </SelectTrigger>
              <SelectContent>
                {filteredTeamMembers.length > 0 ? (
                  filteredTeamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} {member.role === 'team_lead' ? '(Team Lead)' : ''}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem key="no-members" value="no-members-available" disabled>
                    No team members available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {currentUser.role === 'team_lead' && (
              <p className="text-sm text-muted-foreground">
                As a team lead, you can only assign tasks to members of your team.
              </p>
            )}
            {currentUser.role === 'team_member' && (
              <p className="text-sm text-muted-foreground">
                As a team member, you cannot create tasks. You can only work on tasks assigned to you.
              </p>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select 
                value={priority} 
                onValueChange={(value) => setPriority(value as TaskPriority)}
                disabled={!canAssignTasks}
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
              <Label htmlFor="status">Status</Label>
              <Select 
                value={status} 
                onValueChange={(value) => setStatus(value as TaskStatus)}
                disabled={!canAssignTasks}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !due_date && "text-muted-foreground"
                  )}
                  disabled={!canAssignTasks}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {due_date ? format(due_date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={due_date}
                  onSelect={setDueDate}
                  initialFocus
                  disabled={!canAssignTasks}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
        
        <CardFooter>
          <Button 
            type="submit" 
            className="w-full"
            disabled={!canAssignTasks}
          >
            {initialTask ? 'Update Task' : 'Create Task'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default TaskForm;
