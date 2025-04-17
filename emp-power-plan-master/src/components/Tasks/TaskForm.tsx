import React, { useState } from 'react';
import { Task, TaskPriority, TaskStatus, User } from '../../types';
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
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
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

    // For team leads, ensure the task is assigned to a member of their team
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
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assign To</Label>
            <Select value={assigned_to} onValueChange={setAssignedTo} required>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.length > 0 ? (
                  teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem key="no-members" value="no-members-available" disabled>
                    No team members available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
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
              <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
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
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {due_date ? format(due_date, "PPP") : "Select due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={due_date}
                  onSelect={setDueDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-end space-x-2">
          <Button type="submit">
            {initialTask ? 'Update Task' : 'Create Task'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default TaskForm;
