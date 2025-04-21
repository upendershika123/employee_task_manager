import React, { useState, useEffect } from 'react';
import { Task } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, format } from 'date-fns';
import { useDatabaseService } from '@/services/DatabaseServiceContext';
import { toast } from 'sonner';
import { CircularProgress } from '@/components/ui/circular-progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface TaskListProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, onTaskClick }) => {
  const [assigneeNames, setAssigneeNames] = useState<Record<string, string>>({});
  const [taskProgress, setTaskProgress] = useState<Record<string, number>>({});
  const databaseService = useDatabaseService();

  // Load task progress when tasks change
  useEffect(() => {
    const loadTaskProgress = async () => {
      for (const task of tasks) {
        try {
          const { data, error } = await supabase
            .from('task_input_history')
            .select('progress')
            .eq('task_id', task.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
            console.error(`Error loading progress for task ${task.id}:`, error);
            continue;
          }

          setTaskProgress(prev => ({
            ...prev,
            [task.id]: data?.progress || 0
          }));
        } catch (error) {
          console.error(`Error loading progress for task ${task.id}:`, error);
        }
      }
    };

    loadTaskProgress();
  }, [tasks]);

  // Load assignee names when tasks change
  React.useEffect(() => {
    const loadAssigneeNames = async () => {
      const uniqueUserIds = [...new Set(tasks.map(task => task.assigned_to).filter(Boolean))];
      
      for (const userId of uniqueUserIds) {
        try {
          const user = await databaseService.getUserById(userId);
          if (user) {
            setAssigneeNames(prev => ({
              ...prev,
              [userId]: user.name
            }));
          }
        } catch (error) {
          console.error(`Error loading user ${userId}:`, error);
        }
      }
    };
    
    loadAssigneeNames();
  }, [tasks, databaseService]);

  const getAssigneeName = (userId: string): string => {
    return assigneeNames[userId] || 'Unknown User';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tasks.map((task) => (
        <Card 
          key={task.id} 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => onTaskClick(task.id)}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="truncate">{task.title}</span>
              <div className="flex flex-col items-end gap-3">
                <Badge className={getPriorityColor(task.priority)}>
                  {task.priority}
                </Badge>
                <CircularProgress 
                  value={taskProgress[task.id] || 0} 
                  size="md"
                  className={cn(
                    task.status === 'completed' ? 'text-green-600' :
                    task.status === 'in_progress' ? 'text-blue-600' :
                    'text-gray-600'
                  )}
                />
              </div>
            </CardTitle>
            <CardDescription>
              {task.description || 'No description provided'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(task.status)}>
                  {task.status}
                </Badge>
              </div>
              {task.status === 'completed' && task.completed_at ? (
                <p className="text-sm text-gray-500">
                  Completed on {format(new Date(task.completed_at), 'MMM d, yyyy')}
                </p>
              ) : task.due_date && (
                <p className="text-sm text-gray-500">
                  Due {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                </p>
              )}
              {task.assigned_to && (
                <p className="text-sm text-gray-500">
                  Assigned to: {getAssigneeName(task.assigned_to)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {tasks.length === 0 && (
        <div className="col-span-full text-center py-8 text-gray-500">
          No tasks available
        </div>
      )}
    </div>
  );
};

export default TaskList;
