import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDatabaseService } from '@/services/DatabaseServiceContext';
import { useAuth } from '@/components/Auth/AuthContext';
import { AutomaticTask, Team } from '@/types';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutomaticTaskFormProps {
  onSubmit: (task: Partial<AutomaticTask>) => void;
  onCancel: () => void;
  initialTask?: AutomaticTask;
}

const AutomaticTaskForm: React.FC<AutomaticTaskFormProps> = ({ 
  onSubmit, 
  onCancel,
  initialTask 
}) => {
  const [title, setTitle] = useState(initialTask?.taskTitle || '');
  const [description, setDescription] = useState(initialTask?.taskDescription || '');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(initialTask?.priority || 'medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(initialTask?.dueDate ? new Date(initialTask.dueDate) : undefined);
  const [teamId, setTeamId] = useState<string | null>(initialTask?.teamId || null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const databaseService = useDatabaseService();
  const { user } = useAuth();

  // Fetch teams on component mount
  React.useEffect(() => {
    const fetchTeams = async () => {
      try {
        const fetchedTeams = await databaseService.getTeams();
        setTeams(fetchedTeams);
      } catch (error) {
        console.error('Error fetching teams:', error);
        toast.error('Failed to load teams');
      }
    };
    
    fetchTeams();
  }, [databaseService]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!title.trim()) {
      toast.error('Task title is required');
      return;
    }
    
    if (!teamId) {
      toast.error('Team selection is required');
      return;
    }

    if (!dueDate) {
      toast.error('Due date is required');
      return;
    }

    // Ensure due date is not in the past
    if (dueDate < new Date()) {
      toast.error('Due date cannot be in the past');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const taskData: Partial<AutomaticTask> = {
        taskTitle: title.trim(),
        taskDescription: description.trim() || undefined,
        priority,
        teamId,
        dueDate: dueDate.toISOString(),
        status: 'pending'
      };
      
      await onSubmit(taskData);
      toast.success('Task created successfully');
    } catch (error: any) {
      console.error('Error submitting task:', error);
      toast.error(error.message || 'Failed to create task');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{initialTask ? 'Edit Task' : 'Create New Task'}</CardTitle>
        <CardDescription>
          {initialTask 
            ? 'Update the task details below' 
            : 'Fill in the task details below to create a new automatic task'}
        </CardDescription>
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
            <Label htmlFor="description">Task Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description"
              rows={4}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={priority}
              onValueChange={(value: 'high' | 'medium' | 'low') => setPriority(value)}
            >
              <SelectTrigger id="priority">
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
              value={teamId || ''}
              onValueChange={(value) => setTeamId(value)}
            >
              <SelectTrigger id="team">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-end space-x-2">
          <Button variant="outline" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : initialTask ? 'Update Task' : 'Create Task'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default AutomaticTaskForm; 