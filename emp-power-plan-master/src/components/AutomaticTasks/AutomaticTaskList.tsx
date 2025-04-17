import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useDatabaseService } from '@/services/DatabaseServiceContext';
import { AutomaticTask } from '@/types';
import { format } from 'date-fns';
import { Clock, CheckCircle, AlertCircle, User, Calendar } from 'lucide-react';

interface AutomaticTaskListProps {
  tasks: AutomaticTask[];
  onAssignTask?: (taskId: string) => void;
  showAssignButton?: boolean;
}

const AutomaticTaskList: React.FC<AutomaticTaskListProps> = ({ 
  tasks, 
  onAssignTask,
  showAssignButton = false
}) => {
  const databaseService = useDatabaseService();
  const [teamNames, setTeamNames] = React.useState<Record<string, string>>({});
  const [userNames, setUserNames] = React.useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = React.useState<Record<string, boolean>>({});

  // Fetch team and user names
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch teams
        const teams = await databaseService.getTeams();
        const teamNameMap: Record<string, string> = {};
        teams.forEach(team => {
          teamNameMap[team.id] = team.name;
        });
        setTeamNames(teamNameMap);
        
        // Fetch users
        const users = await databaseService.getUsers();
        const userNameMap: Record<string, string> = {};
        users.forEach(user => {
          userNameMap[user.id] = user.name;
        });
        setUserNames(userNameMap);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    
    fetchData();
  }, [databaseService]);

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'outline';
      case 'assigned':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const handleAssignTask = async (taskId: string) => {
    if (!onAssignTask) return;
    
    setIsLoading(prev => ({ ...prev, [taskId]: true }));
    try {
      await onAssignTask(taskId);
    } finally {
      setIsLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <Card key={task.taskId} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">{task.taskTitle}</CardTitle>
                <CardDescription className="mt-1">
                  {task.taskDescription || 'No description provided'}
                </CardDescription>
              </div>
              <div className="flex space-x-2">
                <Badge variant={getPriorityBadgeVariant(task.priority)}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </Badge>
                <Badge variant={getStatusBadgeVariant(task.status)}>
                  {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pb-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center text-sm text-muted-foreground">
                <Clock className="mr-2 h-4 w-4" />
                <span>Estimated time: {task.estimatedTime} hours</span>
              </div>
              
              {task.teamId && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  <span>Team: {teamNames[task.teamId] || 'Unknown Team'}</span>
                </div>
              )}
              
              {task.assignedTo && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <User className="mr-2 h-4 w-4" />
                  <span>Assigned to: {userNames[task.assignedTo] || 'Unknown User'}</span>
                </div>
              )}
              
              {task.dueDate && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-2 h-4 w-4" />
                  <span>Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                </div>
              )}
              
              {task.assignedAt && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  <span>Assigned: {format(new Date(task.assignedAt), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>
          </CardContent>
          
          {showAssignButton && task.status === 'pending' && (
            <CardFooter className="pt-2">
              <Button 
                onClick={() => handleAssignTask(task.taskId)} 
                disabled={isLoading[task.taskId]}
                className="w-full"
              >
                {isLoading[task.taskId] ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : null}
                Assign Task
              </Button>
            </CardFooter>
          )}
        </Card>
      ))}
    </div>
  );
};

export default AutomaticTaskList; 