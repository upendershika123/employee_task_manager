
import React, { useState } from 'react';
import { Task, User } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getUserById } from '../../utils/mockData';
import { format, isToday, isTomorrow, addDays, isBefore } from 'date-fns';
import { ArrowUp, Clock, Calendar } from 'lucide-react';
import { getInitials } from '@/utils/helpers';

interface TaskPrioritizationProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
}

const TaskPrioritization: React.FC<TaskPrioritizationProps> = ({ tasks, onTaskUpdate }) => {
  const [view, setView] = useState<'all' | 'urgent' | 'upcoming' | 'overdue'>('all');
  
  const getTasksForView = () => {
    const now = new Date();
    
    switch (view) {
      case 'urgent':
        return tasks.filter(task => 
          task.priority === 'high' && 
          task.status !== 'completed' &&
          isBefore(new Date(task.dueDate), addDays(now, 3))
        );
      case 'upcoming':
        return tasks.filter(task => 
          task.status !== 'completed' &&
          (isToday(new Date(task.dueDate)) || isTomorrow(new Date(task.dueDate)))
        );
      case 'overdue':
        return tasks.filter(task => 
          task.status !== 'completed' &&
          isBefore(new Date(task.dueDate), now)
        );
      default:
        return tasks;
    }
  };

  const getAssigneeName = (userId: string): string => {
    const user = getUserById(userId);
    return user?.name || 'Unknown User';
  };

  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return 'Today';
    } else if (isTomorrow(date)) {
      return 'Tomorrow';
    }
    return format(date, 'MMM d, yyyy');
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-green-500';
      default:
        return '';
    }
  };

  const handlePriorityChange = (taskId: string, newPriority: Task['priority']) => {
    onTaskUpdate(taskId, { priority: newPriority });
  };

  const filteredTasks = getTasksForView();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task Prioritization</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" value={view} onValueChange={(value) => setView(value as any)} className="w-full">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="all">All Tasks</TabsTrigger>
            <TabsTrigger value="urgent">Urgent</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
          </TabsList>
          
          <TabsContent value={view} className="mt-0">
            <div className="space-y-3">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No tasks in this category.
                </div>
              ) : (
                filteredTasks.map(task => (
                  <div key={task.id} className="p-3 border rounded-md flex justify-between items-center">
                    <div className="space-y-1">
                      <h3 className="font-medium">{task.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={getUserById(task.assignedTo)?.avatar} />
                            <AvatarFallback className="text-xs">
                              {getInitials(getAssigneeName(task.assignedTo))}
                            </AvatarFallback>
                          </Avatar>
                          <span>{getAssigneeName(task.assignedTo)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span className={isBefore(new Date(task.dueDate), new Date()) && task.status !== 'completed' ? 'text-red-500' : ''}>
                            {formatDueDate(task.dueDate)}
                          </span>
                        </div>
                        <Badge variant={task.status === 'completed' ? 'outline' : 'secondary'}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-end">
                        <span className="text-xs mb-1">Priority:</span>
                        <div className="flex items-center gap-1">
                          <ArrowUp className={`h-4 w-4 ${getPriorityColor(task.priority)}`} />
                          <span className={`text-sm ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        </div>
                      </div>
                      
                      {task.status !== 'completed' && (
                        <div className="flex gap-1">
                          {task.priority !== 'high' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-xs"
                              onClick={() => handlePriorityChange(task.id, 'high')}
                            >
                              Raise
                            </Button>
                          )}
                          {task.priority !== 'low' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-xs"
                              onClick={() => handlePriorityChange(task.id, 'low')}
                            >
                              Lower
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TaskPrioritization;
